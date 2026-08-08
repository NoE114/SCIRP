from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from app.extensions import db
from app.models.announcement import Announcement
from app.models.user import User, UserRole
from app.routes.notifications import create_notification
from app.services.audit import log_audit_event

announcements_bp = Blueprint("announcements", __name__)


@announcements_bp.route("/announcements", methods=["GET"])
@jwt_required()
def list_announcements():
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)

    # Base query: Announcements matching All Wards and All Zones
    query = Announcement.query

    # Citizens or staff filter announcements matching their Ward / Zone
    if user and user.role == UserRole.CITIZEN:
        # If user has a specific ward/zone, match them
        # SQLite / MySQL compatibility: filter announcement matching ward/zone OR NULL
        query = query.filter(
            (Announcement.ward_id.is_(None) | (Announcement.ward_id == user.ward_id)) &
            (Announcement.zone_id.is_(None) | (Announcement.zone_id == user.zone_id))
        )

    announcements = query.order_by(Announcement.created_at.desc()).all()
    return jsonify({"announcements": [a.to_dict() for a in announcements]})


@announcements_bp.route("/announcements", methods=["POST"])
@jwt_required()
def create_announcement():
    claims = get_jwt()
    if claims.get("role") != "admin":
        return jsonify({"msg": "Only admins can post announcements"}), 403

    user_id = int(get_jwt_identity())
    data = request.get_json()
    if not data or not data.get("title") or not data.get("message"):
        return jsonify({"msg": "title and message are required"}), 400

    announcement = Announcement(
        title=data["title"],
        message=data["message"],
        category=data.get("category", "general"),
        zone_id=data.get("zone_id"),
        ward_id=data.get("ward_id")
    )
    db.session.add(announcement)
    db.session.commit()

    # Log Audit Event
    log_audit_event(
        user_id=user_id,
        action="create_announcement",
        entity_type="announcement",
        entity_id=announcement.id,
        new_value=announcement.title,
        metadata={"category": announcement.category}
    )

    # Broadcast as dynamic notification alerts to all targeted citizens
    citizen_query = User.query.filter_by(role=UserRole.CITIZEN)
    if announcement.ward_id:
        citizen_query = citizen_query.filter_by(ward_id=announcement.ward_id)
    if announcement.zone_id:
        citizen_query = citizen_query.filter_by(zone_id=announcement.zone_id)

    targeted_citizens = citizen_query.all()
    for citizen in targeted_citizens:
        create_notification(
            user_id=citizen.id,
            title=f"🔔 Announcement: {announcement.title}",
            message=announcement.message,
            category="announcement"
        )

    return jsonify({"msg": "Announcement posted", "announcement": announcement.to_dict()}), 201
