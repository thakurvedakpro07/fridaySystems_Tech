"""
Gunicorn production configuration for ResolveHQ.

Gunicorn is the WSGI server that runs Django in production.
In development, Django's built-in runserver is used instead.

Reference: https://docs.gunicorn.org/en/stable/settings.html
"""

import multiprocessing

# ── Binding ───────────────────────────────────────────────────────────────────
# Nginx (on the host) proxies /api/* to this port.
# 0.0.0.0 means "all interfaces inside the container".
bind = "0.0.0.0:8000"

# ── Workers ───────────────────────────────────────────────────────────────────
# The classic formula: (2 × CPU cores) + 1.
# On a 2-core VPS this gives 5 workers; a 4-core gives 9.
# Each worker is a separate OS process that can handle one request at a time.
workers = multiprocessing.cpu_count() * 2 + 1

# sync worker: one request at a time per worker — safe default for Django.
# Switch to "gevent" or "gthread" only if you add async views or websockets.
worker_class = "sync"

# ── Timeouts ──────────────────────────────────────────────────────────────────
# Kill a worker that hasn't finished a request in this many seconds.
# Increase if you have long-running views (PDF export, large imports).
timeout = 60

# Keep connections open for this many seconds before closing.
# Reduces TCP handshake overhead for users who make multiple requests.
keepalive = 5

# ── Worker recycling ──────────────────────────────────────────────────────────
# Restart each worker after handling this many requests.
# Prevents slow memory leaks from accumulating indefinitely.
max_requests = 1000

# Add random jitter so all workers don't restart at the same time.
max_requests_jitter = 100

# ── Logging ───────────────────────────────────────────────────────────────────
# "-" means stdout/stderr — Docker's logging driver captures these.
# Do NOT log to files inside the container; use a log aggregation service.
accesslog = "-"
errorlog = "-"
loglevel = "info"

# Log format: includes response time, status code, and request path.
access_log_format = '%(h)s "%(r)s" %(s)s %(b)s %(D)sµs'

# ── Proxy ─────────────────────────────────────────────────────────────────────
# Trust X-Forwarded-For from all IPs since Nginx is the only entry point.
# Change to the Nginx container/host IP for stricter control.
forwarded_allow_ips = "*"

# ── Process naming ────────────────────────────────────────────────────────────
proc_name = "supportmitra"
