"""
Marinasan | Purchase Request System API
Production-ready Flask application with structured logging, error handling, and monitoring.
"""
import os
import sys
import signal
import logging
import uuid
import time
import threading
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from functools import wraps
from typing import Optional

import jwt
from flask import Flask, request, jsonify, g
from werkzeug.security import check_password_hash, generate_password_hash
from werkzeug.exceptions import HTTPException

# Prometheus metrics (optional)
try:
    from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST
    PROMETHEUS_AVAILABLE = True
except ImportError:
    PROMETHEUS_AVAILABLE = False

from database import (
    get_connection, init_db, rows_to_list, dict_from_row,
    close_pool, get_redis, close_redis
)
from workflow import build_approval_steps, submit_decision, WorkflowError
from email_service import send_purchase_request_notification, test_smtp_connection


# =============================================================================
# Prometheus Metrics
# =============================================================================
try:
    from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST
    PROMETHEUS_AVAILABLE = True
except ImportError:
    PROMETHEUS_AVAILABLE = False

if PROMETHEUS_AVAILABLE:
    REQUEST_COUNT = Counter(
        'marinasan_http_requests_total',
        'Total HTTP requests',
        ['method', 'endpoint', 'status']
    )
    REQUEST_LATENCY = Histogram(
        'marinasan_http_request_duration_seconds',
        'HTTP request latency',
        ['method', 'endpoint']
    )
    ACTIVE_REQUESTS = Gauge(
        'marinasan_active_requests',
        'Active HTTP requests'
    )
    DB_CONNECTIONS = Gauge(
        'marinasan_db_connections_active',
        'Active database connections'
    )
    PURCHASE_REQUESTS = Counter(
        'marinasan_purchase_requests_total',
        'Total purchase requests',
        ['status']
    )
    APPROVAL_DECISIONS = Counter(
        'marinasan_approval_decisions_total',
        'Total approval decisions',
        ['decision']
    )
else:
    # Dummy classes when prometheus_client not available
    class _Dummy:
        def __call__(self, *args, **kwargs): return self
        def inc(self, *args, **kwargs): pass
        def dec(self, *args, **kwargs): pass
        def observe(self, *args, **kwargs): pass
        def set(self, *args, **kwargs): pass
    REQUEST_COUNT = REQUEST_LATENCY = ACTIVE_REQUESTS = DB_CONNECTIONS = PURCHASE_REQUESTS = APPROVAL_DECISIONS = _Dummy()


# =============================================================================
# Configuration
# =============================================================================
class Config:
    """Application configuration from environment variables."""
    JWT_SECRET = os.environ.get("MARINASAN_JWT_SECRET")
    JWT_ALGO = "HS256"
    TOKEN_EXPIRY_HOURS = int(os.environ.get("JWT_EXPIRY_HOURS", "12"))
    FLASK_ENV = os.environ.get("FLASK_ENV", "production")
    LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO")
    RATE_LIMIT_ENABLED = os.environ.get("RATE_LIMIT_ENABLED", "true").lower() == "true"
    LOGIN_RATE_LIMIT = int(os.environ.get("LOGIN_RATE_LIMIT", "5"))
    LOGIN_RATE_WINDOW_SECONDS = int(os.environ.get("LOGIN_RATE_WINDOW_SECONDS", "300"))
    CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]

    @classmethod
    def validate(cls):
        """Validate required configuration."""
        errors = []
        if cls.FLASK_ENV == "production" and not cls.JWT_SECRET:
            errors.append("MARINASAN_JWT_SECRET must be set in production")
        if errors:
            raise RuntimeError("Configuration errors: " + "; ".join(errors))


# =============================================================================
# Structured Logging
# =============================================================================
class JSONFormatter(logging.Formatter):
    """JSON log formatter for structured logging."""

    def format(self, record: logging.LogRecord) -> str:
        log_data = {
            "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }
        # Add extra fields
        for key, value in record.__dict__.items():
            if key not in ["name", "msg", "args", "levelname", "levelno", "pathname",
                          "filename", "module", "lineno", "funcName", "created",
                          "msecs", "relativeCreated", "thread", "threadName",
                          "processName", "process", "message", "exc_info",
                          "exc_text", "stack_info", "getMessage"]:
                log_data[key] = value
        import json
        return json.dumps(log_data, ensure_ascii=False)


def setup_logging():
    """Configure application logging."""
    log_level = getattr(logging, os.environ.get("LOG_LEVEL", "INFO").upper(), logging.INFO)

    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)

    # Clear existing handlers
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)

    # Console handler with JSON formatting
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(JSONFormatter())
    root_logger.addHandler(console_handler)

    # Reduce noise from third-party loggers
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("psycopg2").setLevel(logging.WARNING)
    logging.getLogger("werkzeug").setLevel(logging.WARNING)

    return logging.getLogger(__name__)


logger = setup_logging()


# =============================================================================
# Flask App Factory
# =============================================================================
def create_app() -> Flask:
    """Create and configure Flask application."""
    Config.validate()

    app = Flask(__name__)
    app.config["JSON_SORT_KEYS"] = False
    app.config["JSONIFY_PRETTYPRINT_REGULAR"] = False

    # Request ID middleware
    @app.before_request
    def before_request():
        g.request_id = request.headers.get("X-Request-ID", uuid.uuid4().hex[:8])
        g.start_time = time.time()
        logger.info("Request started",
                    extra={"request_id": g.request_id, "method": request.method,
                           "path": request.path, "ip": request.remote_addr})

    @app.after_request
    def after_request(response):
        duration_ms = int((time.time() - g.start_time) * 1000)
        logger.info("Request completed",
                    extra={"request_id": g.request_id, "status": response.status_code,
                           "duration_ms": duration_ms})

        response.headers["X-Request-ID"] = g.request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Content-Security-Policy"] = "default-src 'self'"

        origin = request.headers.get("Origin")
        if origin and origin in Config.CORS_ORIGINS:
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Request-ID"

        return response

    @app.route("/<path:path>", methods=["OPTIONS"])
    def handle_options(path):
        response = jsonify({})
        response.headers["Access-Control-Allow-Origin"] = request.headers.get("Origin", "*")
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Request-ID"
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Max-Age"] = "3600"
        return response

    @app.errorhandler(Exception)
    def handle_error(e):
        request_id = getattr(g, "request_id", "unknown")
        if isinstance(e, HTTPException):
            logger.warning("HTTP error",
                          extra={"request_id": request_id, "status": e.code, "error": str(e)})
            return jsonify({"error": e.description}), e.code

        logger.exception("Unhandled error", extra={"request_id": request_id})
        if Config.FLASK_ENV == "production":
            return jsonify({"error": "خطای داخلی سرور"}), 500
        return jsonify({"error": str(e), "type": type(e).__name__}), 500

    def signal_handler(signum, frame):
        logger.info("Shutdown signal received", extra={"signal": signum})
        close_pool()
        close_redis()
        sys.exit(0)

    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)

    # =============================================================================
    # Authentication
    # =============================================================================
    JWT_SECRET = os.environ.get("MARINASAN_JWT_SECRET")
    JWT_ALGO = "HS256"
    TOKEN_EXPIRY_HOURS = int(os.environ.get("JWT_EXPIRY_HOURS", "12"))

    def make_token(employee: dict) -> str:
        payload = {
            "employee_id": employee["id"],
            "personnel_number": employee["personnel_number"],
            "full_name": employee["full_name"],
            "position": employee["position"],
            "exp": datetime.now(timezone.utc) + timedelta(hours=12),
            "iat": datetime.now(timezone.utc),
        }
        return jwt.encode(payload, os.environ.get("MARINASAN_JWT_SECRET"), algorithm="HS256")


    def require_auth(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            auth_header = request.headers.get("Authorization", "")
            if not auth_header.startswith("Bearer "):
                return jsonify({"error": "توکن احراز هویت ارسال نشده است."}), 401
            token = auth_header.split(" ", 1)[1]
            try:
                payload = jwt.decode(token, os.environ.get("MARINASAN_JWT_SECRET"), algorithms=["HS256"])
            except jwt.ExpiredSignatureError:
                return jsonify({"error": "نشست شما منقضی شده، دوباره وارد شوید."}), 401
            except jwt.InvalidTokenError as e:
                logger.warning("Invalid token", extra={"request_id": g.request_id, "error": str(e)})
                return jsonify({"error": "توکن نامعتبر است."}), 401
            request.current_employee = payload
            return f(*args, **kwargs)
        return wrapper


    # =============================================================================
    # Login rate limiting (brute-force protection)
    # =============================================================================
    _login_attempts_memory: dict = defaultdict(deque)
    _login_attempts_lock = threading.Lock()


    def _login_rate_limit_key(personnel_number: str) -> str:
        # Keyed by IP + personnel number so one attacker can't lock out a real
        # employee, while still throttling repeated guesses against one account.
        return f"{request.remote_addr}:{personnel_number}"


    def _check_login_rate_limit(key: str) -> bool:
        """Returns True if this attempt is allowed, False if the caller should be
        rate-limited. Uses Redis when available (shared across workers/replicas),
        falling back to an in-process sliding window otherwise."""
        if not os.environ.get("RATE_LIMIT_ENABLED", "true").lower() == "true":
            return True

        window = int(os.environ.get("LOGIN_RATE_WINDOW_SECONDS", "300"))
        limit = int(os.environ.get("LOGIN_RATE_LIMIT", "5"))

        redis_client = get_redis()
        if redis_client:
            try:
                rkey = f"loginattempts:{key}"
                count = redis_client.incr(rkey)
                if count == 1:
                    redis_client.expire(rkey, window)
                return count <= limit
            except Exception:
                logger.warning("Redis rate limiter failed, falling back to in-memory", exc_info=True)

        now = time.time()
        with _login_attempts_lock:
            attempts = _login_attempts_memory[key]
            while attempts and now - attempts[0] > window:
                attempts.popleft()
            attempts.append(now)
            return len(attempts) <= limit


    # =============================================================================
    # API Routes
    # =============================================================================

    @app.post("/api/auth/login")
    def login():
        data = request.get_json(silent=True) or {}
        personnel_number = data.get("personnel_number")
        password = data.get("password")

        if not personnel_number or not password:
            return jsonify({"error": "شماره پرسنلی و رمز عبور الزامی است."}), 400

        rate_key = _login_rate_limit_key(personnel_number)
        if not _check_login_rate_limit(rate_key):
            logger.warning("Login rate limit exceeded",
                           extra={"request_id": g.request_id, "personnel_number": personnel_number,
                                  "ip": request.remote_addr})
            return jsonify({"error": "تلاش‌های ناموفق زیاد بوده. چند دقیقه دیگر دوباره امتحان کنید."}), 429

        conn = get_connection()
        employee = conn.execute(
            "SELECT * FROM employees WHERE personnel_number = ? AND is_active = true",
            (personnel_number,),
        ).fetchone()
        conn.close()

        if employee is None or not check_password_hash(employee["password_hash"], password):
            logger.warning("Failed login attempt",
                           extra={"request_id": g.request_id, "personnel_number": personnel_number})
            return jsonify({"error": "شماره پرسنلی یا رمز عبور اشتباه است."}), 401

        token = make_token(employee)
        logger.info("User logged in",
                    extra={"request_id": g.request_id, "employee_id": employee["id"]})
        return jsonify({
            "token": token,
            "employee": {
                "id": employee["id"],
                "personnel_number": employee["personnel_number"],
                "full_name": employee["full_name"],
                "position": employee["position"],
            }
        })


    @app.post("/api/purchase-requests")
    @require_auth
    def create_purchase_request():
        data = request.get_json(silent=True) or {}
        title = data.get("title")
        items = data.get("items") or []
        documents = data.get("documents")

        if not title or not str(title).strip():
            return jsonify({"error": "عنوان درخواست الزامی است."}), 400
        if len(str(title)) > 200:
            return jsonify({"error": "عنوان درخواست بیش از حد طولانی است."}), 400
        if not items or not isinstance(items, list):
            return jsonify({"error": "حداقل یک قلم کالا باید ثبت شود."}), 400

        # Validate every item up front so a bad value fails fast with a clear
        # 400 error instead of raising an uncaught exception mid-transaction.
        parsed_items = []
        for idx, item in enumerate(items, start=1):
            if not isinstance(item, dict):
                return jsonify({"error": f"قلم شماره {idx} نامعتبر است."}), 400
            item_name = str(item.get("item_name") or "").strip()
            if not item_name:
                return jsonify({"error": f"نام کالا برای قلم شماره {idx} الزامی است."}), 400
            if len(item_name) > 200:
                return jsonify({"error": f"نام کالا برای قلم شماره {idx} بیش از حد طولانی است."}), 400
            try:
                quantity = float(item.get("quantity"))
                unit_price = float(item.get("unit_price"))
            except (TypeError, ValueError):
                return jsonify({"error": f"مقدار یا قیمت واحد قلم شماره {idx} نامعتبر است."}), 400
            if quantity <= 0 or unit_price <= 0:
                return jsonify({"error": f"مقدار و قیمت واحد قلم شماره {idx} باید بزرگ‌تر از صفر باشد."}), 400
            parsed_items.append({"item_name": item_name, "quantity": quantity, "unit_price": unit_price})

        total_amount = sum(i["quantity"] * i["unit_price"] for i in parsed_items)

        conn = get_connection()
        cur = conn.cursor()

        # Use a temporary unique placeholder, then derive the human-readable
        # request_number from the auto-generated primary key. This avoids the
        # race condition of two concurrent requests reading the same COUNT(*)
        # and colliding on the UNIQUE(request_number) constraint.
        placeholder_number = f"TEMP-{uuid.uuid4().hex[:12]}"
        cur.execute(
            """INSERT INTO purchase_requests
               (request_number, requester_id, title, description, total_amount, status, current_step_order, documents)
               VALUES (?, ?, ?, ?, ?, 'pending', 1, ?)
               RETURNING id""",
            (placeholder_number, request.current_employee["employee_id"], title,
             data.get("description"), total_amount, documents),
        )
        purchase_request_id = cur.fetchone()["id"]

        request_number = f"PR-{1000 + purchase_request_id}"
        cur.execute(
            "UPDATE purchase_requests SET request_number = ? WHERE id = ?",
            (request_number, purchase_request_id),
        )

        for item in parsed_items:
            cur.execute(
                """INSERT INTO purchase_request_items (purchase_request_id, item_name, quantity, unit_price)
                   VALUES (?, ?, ?, ?)""",
                (purchase_request_id, item["item_name"], item["quantity"], item["unit_price"]),
            )

        try:
            build_approval_steps(conn, purchase_request_id, total_amount)
        except WorkflowError as e:
            conn.rollback()
            conn.close()
            return jsonify({"error": str(e)}), 422

        conn.commit()
        conn.close()

        logger.info("Purchase request created",
                    extra={"request_id": g.request_id, "pr_id": purchase_request_id,
                           "request_number": request_number, "amount": total_amount})
        
        # Send notification to approvers
        try:
            send_purchase_request_notification(
                purchase_request_id=purchase_request_id,
                event_type="created",
                requester_id=request.current_employee["employee_id"],
                request_number=request_number,
                total_amount=total_amount,
            )
        except Exception as e:
            logger.warning("Failed to send creation notification", 
                         extra={"request_id": g.request_id, "error": str(e)})

        return jsonify({"id": purchase_request_id, "request_number": request_number,
                         "total_amount": total_amount, "status": "pending"}), 201


    @app.get("/api/purchase-requests")
    @require_auth
    def list_purchase_requests():
        conn = get_connection()
        rows = conn.execute(
            """SELECT pr.*, e.full_name AS requester_name, e.personnel_number AS requester_personnel_number
               FROM purchase_requests pr
               JOIN employees e ON e.id = pr.requester_id
               WHERE pr.requester_id = ?
               ORDER BY pr.created_at DESC""",
            (request.current_employee["employee_id"],)
        ).fetchall()
        conn.close()
        return jsonify(rows_to_list(rows))


    @app.get("/api/purchase-requests/<int:purchase_request_id>")
    @require_auth
    def get_purchase_request(purchase_request_id):
        conn = get_connection()
        # Allow both requester and current step approver to view
        pr = conn.execute(
            """SELECT pr.*, e.full_name AS requester_name, e.personnel_number AS requester_personnel_number
               FROM purchase_requests pr
               JOIN employees e ON e.id = pr.requester_id
               WHERE pr.id = ? AND (
                   pr.requester_id = ? 
                   OR pr.id IN (
                       SELECT purchase_request_id FROM approval_steps 
                       WHERE purchase_request_id = pr.id AND approver_id = ?
                   )
               )""",
            (purchase_request_id, request.current_employee["employee_id"], request.current_employee["employee_id"]),
        ).fetchone()

        if pr is None:
            conn.close()
            return jsonify({"error": "درخواست یافت نشد."}), 404

        items = conn.execute(
            "SELECT * FROM purchase_request_items WHERE purchase_request_id = ?",
            (purchase_request_id,),
        ).fetchall()

        steps = conn.execute(
            """SELECT s.*, e.full_name AS approver_name, e.personnel_number AS approver_personnel_number,
                      e.position AS approver_position
               FROM approval_steps s
               JOIN employees e ON e.id = s.approver_id
               WHERE s.purchase_request_id = ?
               ORDER BY s.step_order""",
            (purchase_request_id,),
        ).fetchall()

        signatures = conn.execute(
            """SELECT * FROM approval_signatures
               WHERE purchase_request_id = ?
               ORDER BY step_order""",
            (purchase_request_id,),
        ).fetchall()
        conn.close()

        result = dict_from_row(pr)
        result["items"] = rows_to_list(items)
        result["approval_steps"] = rows_to_list(steps)
        result["signatures"] = rows_to_list(signatures)
        return jsonify(result)


    @app.post("/api/purchase-requests/<int:purchase_request_id>/decision")
    @require_auth
    def decide_purchase_request(purchase_request_id):
        data = request.get_json(silent=True) or {}
        decision = data.get("decision")
        comment = data.get("comment")
        signature_image = data.get("signature_image")

        conn = get_connection()
        try:
            result = submit_decision(
                conn,
                purchase_request_id=purchase_request_id,
                employee_id=request.current_employee["employee_id"],
                decision=decision,
                comment=comment,
                signature_image=signature_image,
                ip_address=request.remote_addr,
                device_info=request.headers.get("User-Agent"),
            )
        except WorkflowError as e:
            conn.close()
            return jsonify({"error": str(e)}), 422
        finally:
            conn.close()

        logger.info("Decision submitted",
                    extra={"request_id": g.request_id, "pr_id": purchase_request_id,
                           "decision": decision, "employee_id": request.current_employee["employee_id"]})
        
        # Get request details for notification
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(
            "SELECT requester_id, request_number, total_amount FROM purchase_requests WHERE id = ?",
            (purchase_request_id,)
        )
        pr = cur.fetchone()
        conn.close()
        
        # Send notification based on decision
        try:
            if decision == "approved":
                event_type = "approved"
            elif decision == "rejected":
                event_type = "rejected"
            elif decision == "returned_for_documents":
                event_type = "returned_for_documents"
            else:
                event_type = None
            
            if event_type and pr:
                send_purchase_request_notification(
                    purchase_request_id=purchase_request_id,
                    event_type=event_type,
                    requester_id=pr["requester_id"],
                    request_number=pr["request_number"],
                    total_amount=pr["total_amount"],
                    comment=comment,
                )
        except Exception as e:
            logger.warning("Failed to send decision notification", 
                         extra={"request_id": g.request_id, "error": str(e)})

        return jsonify(result)


    @app.post("/api/purchase-requests/<int:purchase_request_id>/documents")
    @require_auth
    def update_purchase_request_documents(purchase_request_id):
        """Update documents for a purchase request (only requester can do this when status is returned_for_documents)."""
        data = request.get_json(silent=True) or {}
        documents = data.get("documents")

        conn = get_connection()
        pr = conn.execute(
            "SELECT * FROM purchase_requests WHERE id = ?",
            (purchase_request_id,),
        ).fetchone()

        if pr is None:
            conn.close()
            return jsonify({"error": "درخواست یافت نشد."}), 404

        if pr["requester_id"] != request.current_employee["employee_id"]:
            conn.close()
            return jsonify({"error": "فقط درخواست‌دهنده می‌تواند مدارک را به‌روزرسانی کند."}), 403

        if pr["status"] != "returned_for_documents":
            conn.close()
            return jsonify({"error": "این درخواست در وضعیت بازگشت برای تکمیل مدارک نیست."}), 400

        conn.execute(
            "UPDATE purchase_requests SET documents = ?, updated_at = ? WHERE id = ?",
            (documents, datetime.utcnow().isoformat(), purchase_request_id),
        )
        conn.commit()
        conn.close()

        # Send notification to approver(s) that documents have been updated
        try:
            send_purchase_request_notification(
                purchase_request_id=purchase_request_id,
                event_type="resubmitted",  # or a new event type
                requester_id=request.current_employee["employee_id"],
                request_number=pr["request_number"],
                total_amount=pr["total_amount"],
            )
        except Exception as e:
            logger.warning("Failed to send documents update notification",
                         extra={"request_id": g.request_id, "error": str(e)})

        return jsonify({"success": True, "message": "مدارک با موفقیت به‌روزرسانی شد."})


    @app.post("/api/purchase-requests/<int:purchase_request_id>/resubmit")
    @require_auth
    def resubmit_purchase_request(purchase_request_id):
        """Resubmit a purchase request after adding documents (only requester when status is returned_for_documents)."""
        conn = get_connection()
        pr = conn.execute(
            "SELECT * FROM purchase_requests WHERE id = ?",
            (purchase_request_id,),
        ).fetchone()

        if pr is None:
            conn.close()
            return jsonify({"error": "درخواست یافت نشد."}), 404

        if pr["requester_id"] != request.current_employee["employee_id"]:
            conn.close()
            return jsonify({"error": "فقط درخواست‌دهنده می‌تواند درخواست را مجدداً ارسال کند."}), 403

        if pr["status"] != "returned_for_documents":
            conn.close()
            return jsonify({"error": "این درخواست در وضعیت بازگشت برای تکمیل مدارک نیست."}), 400

        if not pr["documents"]:
            conn.close()
            return jsonify({"error": "ابتدا باید مدارک را آپلود کنید."}), 400

        # Reset status to pending, keep current_step_order as is (continue from where it was returned)
        conn.execute(
            "UPDATE purchase_requests SET status = 'pending', updated_at = ? WHERE id = ?",
            (datetime.utcnow().isoformat(), purchase_request_id),
        )

        # Reset only the returned step to pending, keep others as is
        conn.execute(
            "UPDATE approval_steps SET status = 'pending' WHERE purchase_request_id = ? AND status = 'returned_for_documents'",
            (purchase_request_id,),
        )

        conn.commit()
        conn.close()

        # Send notification to approvers that request has been resubmitted
        try:
            send_purchase_request_notification(
                purchase_request_id=purchase_request_id,
                event_type="resubmitted",
                requester_id=request.current_employee["employee_id"],
                request_number=pr["request_number"],
                total_amount=pr["total_amount"],
            )
        except Exception as e:
            logger.warning("Failed to send resubmit notification", 
                         extra={"request_id": g.request_id, "error": str(e)})

        return jsonify({"success": True, "message": "درخواست با موفقیت مجدداً ارسال شد.", "status": "pending"})


    @app.get("/api/purchase-requests/pending-for-me")
    @require_auth
    def pending_for_me():
        conn = get_connection()
        rows = conn.execute(
            """SELECT pr.id, pr.request_number, pr.title, pr.total_amount, pr.current_step_order,
                      e.full_name AS requester_name
               FROM purchase_requests pr
               JOIN approval_steps s
                 ON s.purchase_request_id = pr.id AND s.step_order = pr.current_step_order
               JOIN employees e ON e.id = pr.requester_id
               WHERE pr.status = 'pending' AND s.approver_id = ?
               ORDER BY pr.created_at""",
            (request.current_employee["employee_id"],),
        ).fetchall()
        conn.close()
        return jsonify(rows_to_list(rows))


    @app.get("/api/employees/me")
    @require_auth
    def get_me():
        conn = get_connection()
        employee = conn.execute(
            "SELECT id, personnel_number, full_name, position, department, email, is_active, signature_image, created_at FROM employees WHERE id = ?",
            (request.current_employee["employee_id"],),
        ).fetchone()
        conn.close()
        if not employee:
            return jsonify({"error": "کارمند یافت نشد."}), 404
        return jsonify({"employee": dict_from_row(employee)})


    @app.get("/api/employees/me/signature")
    @require_auth
    def get_my_signature():
        conn = get_connection()
        employee = conn.execute(
            "SELECT signature_image FROM employees WHERE id = ?",
            (request.current_employee["employee_id"],),
        ).fetchone()
        conn.close()
        return jsonify({"signature_image": employee["signature_image"] if employee else None})


    @app.post("/api/employees/me/signature")
    @require_auth
    def save_my_signature():
        data = request.get_json(silent=True) or {}
        signature_image = data.get("signature_image")

        if not signature_image:
            return jsonify({"error": "signature_image الزامی است."}), 400

        if not signature_image.startswith("data:image/png;base64,"):
            return jsonify({"error": "فرمت امضا باید base64 PNG باشد."}), 400

        conn = get_connection()
        conn.execute(
            "UPDATE employees SET signature_image = ? WHERE id = ?",
            (signature_image, request.current_employee["employee_id"]),
        )
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": "امضا با موفقیت ذخیره شد."})


    @app.delete("/api/employees/me/signature")
    @require_auth
    def delete_my_signature():
        conn = get_connection()
        conn.execute(
            "UPDATE employees SET signature_image = NULL WHERE id = ?",
            (request.current_employee["employee_id"],),
        )
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": "امضا حذف شد."})


    @app.get("/api/health")
    def health():
        checks = {"api": "ok", "database": "unknown", "redis": "unknown"}

        try:
            conn = get_connection()
            conn.execute("SELECT 1").fetchone()
            conn.close()
            checks["database"] = "ok"
        except Exception as e:
            logger.error("Database health check failed", extra={"error": str(e)})
            checks["database"] = "failed"

        try:
            redis_client = get_redis()
            if redis_client:
                redis_client.ping()
                checks["redis"] = "ok"
            else:
                checks["redis"] = "not_configured"
        except Exception as e:
            logger.error("Redis health check failed", extra={"error": str(e)})
            checks["redis"] = "failed"

        status_code = 200 if all(v in ("ok", "not_configured") for v in checks.values()) else 503
        return jsonify({"status": "ok" if status_code == 200 else "degraded", "checks": checks}), status_code


    @app.get("/api/purchase-requests/<int:purchase_request_id>/printed-document")
    @require_auth
    def get_printed_document(purchase_request_id):
        """Get the printed document (PDF or HTML) for an approved purchase request."""
        conn = get_connection()
        try:
            # Check if request exists and is approved
            pr = conn.execute(
                "SELECT * FROM purchase_requests WHERE id = ? AND status = 'approved'",
                (purchase_request_id,)
            ).fetchone()

            if not pr:
                return jsonify({"error": "درخواست تایید شده یافت نشد."}), 404

            cur = conn.cursor()
            cur.execute(
                """SELECT * FROM printed_documents WHERE purchase_request_id = ?""",
                (purchase_request_id,)
            )
            doc = cur.fetchone()

            if not doc:
                return jsonify({"error": "سند چاپی برای این درخواست وجود ندارد."}), 404

            from flask import send_file
            import io
            
            # If PDF is available, serve it
            if doc["document_pdf"]:
                return send_file(
                    io.BytesIO(doc["document_pdf"]),
                    mimetype='application/pdf',
                    as_attachment=False,
                    download_name=f"{pr['request_number']}.pdf"
                )
            
            # Fallback to HTML document
            html_content = doc["document_html"]
            return send_file(
                io.BytesIO(html_content.encode('utf-8')),
                mimetype='text/html; charset=utf-8',
                as_attachment=False,
                download_name=f"{pr['request_number']}.html"
            )
        finally:
            conn.close()


    @app.get("/metrics")
    def metrics():
        """Prometheus metrics endpoint."""
        from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
        return generate_latest(), 200, {'Content-Type': CONTENT_TYPE_LATEST}


    return app


if __name__ == "__main__":
    # For local development only - requires DATABASE_URL postgresql://...
    if os.environ.get("FLASK_ENV") == "development":
        init_db()
    app = create_app()
    app.run(host="0.0.0.0", port=5002, debug=False)