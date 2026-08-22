"""
Database layer with connection pooling for production.

Supports:
- SQLite (development)
- PostgreSQL with psycopg2 pool (production)
- Redis for caching/sessions
"""
import os
import sqlite3
import threading
from contextlib import contextmanager
from typing import Optional, Any, Dict, List
from urllib.parse import urlparse

# PostgreSQL
try:
    import psycopg2
    import psycopg2.extras
    import psycopg2.pool
    PSYCOPG2_AVAILABLE = True
except ImportError:
    PSYCOPG2_AVAILABLE = False

# Redis
try:
    import redis
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False


# Configuration
DB_PATH = os.path.join(os.path.dirname(__file__), "marinasan.db")
SCHEMA_PATH_SQLITE = os.path.join(os.path.dirname(__file__), "schema.sql")
SCHEMA_PATH_POSTGRES = os.path.join(os.path.dirname(__file__), "schema_postgres.sql")

DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()
IS_POSTGRES = DATABASE_URL.startswith("postgres")

REDIS_URL = os.environ.get("REDIS_URL", "redis://redis:6379/0")
REDIS_AVAILABLE = REDIS_AVAILABLE and REDIS_URL

# Thread-local storage for SQLite connections
_sqlite_local = threading.local()


class _PGCursor:
    """Adapter: make psycopg2 cursor behave like sqlite3 cursor (placeholder ? instead of %s)."""

    def __init__(self, raw_cursor):
        self._cur = raw_cursor

    def execute(self, query, params=()):
        self._cur.execute(query.replace("?", "%s"), params)
        return self

    def fetchone(self):
        return self._cur.fetchone()

    def fetchall(self):
        return self._cur.fetchall()

    def __getattr__(self, name):
        return getattr(self._cur, name)


class _PGConnection:
    """Adapter: make psycopg2 connection behave like sqlite3.Connection."""

    def __init__(self, dsn):
        self._conn = psycopg2.connect(dsn)

    def cursor(self):
        return _PGCursor(self._conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor))

    def execute(self, query, params=()):
        return self.cursor().execute(query, params)

    def executescript(self, script):
        raw = self._conn.cursor()
        raw.execute(script)
        raw.close()

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        self._conn.close()

    def __getattr__(self, name):
        return getattr(self._conn, name)


class _PooledPGConnection:
    """Connection wrapper that returns connection to pool on close."""

    def __init__(self, pool: 'psycopg2.pool.ThreadedConnectionPool'):
        self._pool = pool
        self._conn = pool.getconn()

    def cursor(self):
        return _PGCursor(self._conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor))

    def execute(self, query, params=()):
        return self.cursor().execute(query, params)

    def executescript(self, script):
        raw = self._conn.cursor()
        raw.execute(script)
        raw.close()

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        if self._conn:
            self._conn.commit()
            self._pool.putconn(self._conn)
            self._conn = None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
        return False


# Global connection pool
_pg_pool: Optional['psycopg2.pool.ThreadedConnectionPool'] = None
_pool_lock = threading.Lock()


def _get_pg_pool() -> 'psycopg2.pool.ThreadedConnectionPool':
    """Get or create PostgreSQL connection pool."""
    global _pg_pool
    if _pg_pool is None:
        with _pool_lock:
            if _pg_pool is None:
                parsed = urlparse(DATABASE_URL)
                min_conn = int(os.environ.get("DB_POOL_MIN", "2"))
                max_conn = int(os.environ.get("DB_POOL_MAX", "10"))
                _pg_pool = psycopg2.pool.ThreadedConnectionPool(
                    min_conn, max_conn,
                    host=parsed.hostname,
                    port=parsed.port or 5432,
                    database=parsed.path.lstrip('/'),
                    user=parsed.username,
                    password=parsed.password,
                    cursor_factory=psycopg2.extras.RealDictCursor,
                )
    return _pg_pool


def get_connection():
    """
    Get a database connection.
    - PostgreSQL: connection from pool
    """
    if not IS_POSTGRES:
        raise RuntimeError("DATABASE_URL must be set to a PostgreSQL connection string (postgresql://...)")
    if not PSYCOPG2_AVAILABLE:
        raise RuntimeError("psycopg2 not installed but DATABASE_URL is PostgreSQL")
    pool = _get_pg_pool()
    return _PooledPGConnection(pool)


@contextmanager
def connection():
    """Context manager for database connections."""
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        if IS_POSTGRES:
            conn.close()


def init_db(reset: bool = False):
    """
    Initialize database from schema.
    reset=True: WARNING - destroys all data! Only for development.
    """
    if not IS_POSTGRES:
        raise RuntimeError("DATABASE_URL must be set to a PostgreSQL connection string (postgresql://...)")
    if not PSYCOPG2_AVAILABLE:
        raise RuntimeError("psycopg2 not installed")
    with connection() as conn:
        if reset:
            conn.executescript("DROP SCHEMA public CASCADE; CREATE SCHEMA public;")
        with open(SCHEMA_PATH_POSTGRES, "r", encoding="utf-8") as f:
            conn.executescript(f.read())


def close_pool():
    """Close PostgreSQL connection pool (call on shutdown)."""
    global _pg_pool
    if _pg_pool:
        _pg_pool.closeall()
        _pg_pool = None


# Redis client
_redis_client: Optional['redis.Redis'] = None
_redis_lock = threading.Lock()


def get_redis() -> Optional['redis.Redis']:
    """Get Redis client (singleton)."""
    global _redis_client
    if not REDIS_AVAILABLE:
        return None

    if _redis_client is None:
        with _redis_lock:
            if _redis_client is None:
                _redis_client = redis.from_url(
                    REDIS_URL,
                    decode_responses=True,
                    socket_connect_timeout=5,
                    socket_timeout=5,
                    retry_on_timeout=True,
                    health_check_interval=30,
                )
    return _redis_client


def close_redis():
    """Close Redis connection."""
    global _redis_client
    if _redis_client:
        _redis_client.close()
        _redis_client = None


def dict_from_row(row):
    return dict(row) if row is not None else None


def rows_to_list(rows):
    return [dict(r) for r in rows] if rows else []