import os
import smtplib
import json
from datetime import datetime
from email.mime.text import MIMEText

from flask import Blueprint, request, jsonify, Response, stream_with_context
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt

from app.extensions import db
from app.models.user import User
from app.models.notification import Notification
from app.models.complaint import Complaint

notifications_bp = Blueprint("notifications", __name__)

# Simple in-memory SSE client registry
_sse_clients = []


def _send_email(recipient_email, subject, body):
    smtp_host = os.environ.get("SMTP_HOST")
    smtp_port = os.environ.get("SMTP_PORT")
    smtp_user = os.environ.get("SMTP_USER")
    smtp_pass = os.environ.get("SMTP_PASS")

    if not smtp_host:
        print(f"[DEV EMAIL] To: {recipient_email}\nSubject: {subject}\n{body}")
        return

    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = smtp_user or "noreply@scirp.local"
    msg["To"] = recipient_email

    try:
        with smtplib.SMTP(smtp_host, int(smtp_port or 587)) as server:
            server.starttls()
            if smtp_user and smtp_pass:
                server.login(smtp_user, smtp_pass)
            server.send_message(msg)
    except Exception as e:
        print(f"[EMAIL ERROR] {e}")


def _broadcast_notification(user_id, notification_data):
    """Queue notification for SSE clients and return."""
    payload = {"user_id": user_id, "notification": notification_data}
    payload_str = "data: " + json.dumps(payload) + "\n\n"
    for client_id in _sse_clients:
        try:
            client_id.append(payload_str)
        except Exception:
            pass


@notifications_bp.route("/notifications", methods=["GET"])
@jwt_required()
def list_notifications():
    user_id = int(get_jwt_identity())
    unread_only = request.args.get("unread_only", "").lower() == "true"

    query = Notification.query.filter_by(user_id=user_id).order_by(Notification.created_at.desc())
    if unread_only:
        query = query.filter_by(is_read=False)

    notifications = query.all()
    return jsonify({"notifications": [n.to_dict() for n in notifications]})


@notifications_bp.route("/notifications/stream", methods=["GET"])
@jwt_required()
def stream_notifications():
    user_id = int(get_jwt_identity())

    def event_stream():
        client_queue = []
        _sse_clients.append(client_queue)
        try:
            while True:
                if client_queue:
                    msg = client_queue.pop(0)
                    # Only send notifications meant for this user
                    data = json.loads(msg.replace("data: ", "").replace("\n\n", ""))
                    if data["user_id"] == user_id:
                        yield msg
                import time
                time.sleep(1)
        except GeneratorExit:
            pass
        finally:
            if client_queue in _sse_clients:
                _sse_clients.remove(client_queue)

    return Response(stream_with_context(event_stream()), mimetype="text/event-stream")


@notifications_bp.route("/notifications/<int:notification_id>/read", methods=["PUT"])
@jwt_required()
def mark_read(notification_id):
    user_id = int(get_jwt_identity())
    notification = db.session.get(Notification, notification_id)

    if not notification or notification.user_id != user_id:
        return jsonify({"msg": "Notification not found"}), 404

    notification.is_read = True
    db.session.commit()
    return jsonify({"msg": "Notification marked as read", "notification": notification.to_dict()})


@notifications_bp.route("/notifications/preferences", methods=["GET", "PUT"])
@jwt_required()
def notification_preferences():
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"msg": "User not found"}), 404

    if request.method == "GET":
        return jsonify({"email_notifications": user.email_notifications})

    data = request.get_json()
    if data is None:
        return jsonify({"msg": "Missing JSON body"}), 400

    if "email_notifications" in data:
        user.email_notifications = bool(data["email_notifications"])

    db.session.commit()
    return jsonify({"msg": "Preferences updated", "email_notifications": user.email_notifications})


def create_notification(user_id, title, message, category, complaint_id=None):
    """Helper to create a notification + send email + broadcast via SSE."""
    notification = Notification(
        user_id=user_id,
        title=title,
        message=message,
        category=category,
        related_complaint_id=complaint_id,
    )
    db.session.add(notification)
    db.session.commit()

    # Send email if user opted in
    user = db.session.get(User, user_id)
    if user and user.email_notifications:
        subject = f"[SCIRP] {title}"
        body = f"{message}\n\n"
        if complaint_id:
            body += f"Complaint #{complaint_id}\n"
        _send_email(user.email, subject, body)

    # Broadcast to SSE clients
    _broadcast_notification(user_id, notification.to_dict())

    return notification
