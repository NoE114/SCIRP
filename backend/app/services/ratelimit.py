import time
from functools import wraps
from threading import Lock
from collections import defaultdict, deque

from flask import jsonify, request

# Simple in-memory sliding-window rate limiter. Suitable for the single
# gunicorn worker this app deploys with (see Procfile/render.yaml). For
# multi-worker deployments swap this for flask-limiter backed by Redis.
_events = defaultdict(deque)
_lock = Lock()


def rate_limit(max_hits, window_seconds):
    """Allow `max_hits` requests per `window_seconds` per client IP."""

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            ip = request.remote_addr or "unknown"
            now = time.monotonic()
            with _lock:
                q = _events[(ip, fn.__name__)]
                while q and now - q[0] > window_seconds:
                    q.popleft()
                if len(q) >= max_hits:
                    retry = int(window_seconds - (now - q[0])) + 1
                    return jsonify({
                        "msg": "Too many requests. Please try again later.",
                    }), 429
                q.append(now)
            return fn(*args, **kwargs)
        return wrapper
    return decorator