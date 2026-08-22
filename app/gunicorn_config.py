import multiprocessing
import os

# Bind
bind = "0.0.0.0:5002"

# Workers - optimized for 200 users with sync workers
# Formula: (2 * CPU cores) + 1, capped at reasonable max
workers = min(multiprocessing.cpu_count() * 2 + 1, 8)
worker_class = "sync"
worker_connections = 1000

# Timeouts
timeout = 60
graceful_timeout = 30
keepalive = 5

# Request limits
limit_request_fields = 100
limit_request_field_size = 8190
limit_request_line = 4094

# Logging
accesslog = "-"
errorlog = "-"
loglevel = os.getenv("LOG_LEVEL", "info")
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# Process management
preload_app = True
max_requests = 1000
max_requests_jitter = 100

# Security
limit_request_body = 10485760  # 10MB

# Worker recycling
worker_tmp_dir = "/dev/shm"

# SSL (if terminating at gunicorn - not needed with nginx)
# keyfile = "/etc/ssl/private/key.pem"
# certfile = "/etc/ssl/certs/cert.pem"

def on_starting(server):
    server.log.info("Starting Marinasan Purchase System")

def on_reload(server):
    server.log.info("Reloading Marinasan Purchase System")

def worker_int(worker):
    worker.log.info("Worker received INT or QUIT signal")

def pre_fork(server, worker):
    server.log.info(f"Worker spawned (pid: {worker.pid})")

def post_fork(server, worker):
    server.log.info(f"Worker started (pid: {worker.pid})")

def post_worker_init(worker):
    worker.log.info(f"Worker initialized (pid: {worker.pid})")

def worker_abort(worker):
    worker.log.info(f"Worker aborted (pid: {worker.pid})")