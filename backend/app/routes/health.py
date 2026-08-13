from flask import Blueprint, jsonify

# Production-safe endpoint. In development the dev_only blueprint below adds
# extra diagnostic routes; none of them ship to production.

health_bp = Blueprint("health", __name__)


@health_bp.route("/health")
def health():
    return jsonify({"status": "ok", "message": "SCIRP backend is running"})