import os
import uuid
from datetime import datetime

from flask import (
    Blueprint,
    request,
    jsonify,
    send_from_directory,
    current_app,
)
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from werkzeug.utils import secure_filename

from app.extensions import db
from app.models.user import User, UserRole
from app.models.complaint import Complaint, ComplaintStatus, ComplaintPriority
from app.models.complaint_log import ComplaintLog

UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")

complaints_bp = Blueprint("complaints", __name__)

VALID_TRANSITIONS = {
    ComplaintStatus.SUBMITTED: {
        ComplaintStatus.VERIFIED,
        ComplaintStatus.ASSIGNED,
        ComplaintStatus.IN_PROGRESS,
        ComplaintStatus.RESOLVED,
        ComplaintStatus.CLOSED,
    },
    ComplaintStatus.VERIFIED: {
        ComplaintStatus.ASSIGNED,
        ComplaintStatus.IN_PROGRESS,
        ComplaintStatus.RESOLVED,
        ComplaintStatus.CLOSED,
    },
    ComplaintStatus.ASSIGNED: {
        ComplaintStatus.IN_PROGRESS,
        ComplaintStatus.RESOLVED,
        ComplaintStatus.CLOSED,
    },
    ComplaintStatus.IN_PROGRESS: {
        ComplaintStatus.RESOLVED,
        ComplaintStatus.CLOSED,
    },
    ComplaintStatus.RESOLVED: {
        ComplaintStatus.CLOSED,
    },
    ComplaintStatus.CLOSED: set(),
}


def is_valid_transition(old_status, new_status, role):
    if role == "admin":
        return True
    return new_status in VALID_TRANSITIONS.get(old_status, set())


@complaints_bp.route("", methods=["POST"])
@jwt_required()
def create_complaint():
    user_id = int(get_jwt_identity())

    title = request.form.get("title")
    description = request.form.get("description")
    category = request.form.get("category", "other")
    latitude = request.form.get("latitude")
    longitude = request.form.get("longitude")
    priority = request.form.get("priority", ComplaintPriority.MEDIUM.value)

    if not title or not description or not latitude or not longitude:
        return jsonify({"msg": "title, description, latitude, and longitude are required"}), 400

    try:
        lat = float(latitude)
        lng = float(longitude)
    except ValueError:
        return jsonify({"msg": "Invalid latitude/longitude"}), 400

    if priority not in [p.value for p in ComplaintPriority]:
        return jsonify({"msg": "Invalid priority"}), 400

    image_filename = None
    if "image" in request.files:
        file = request.files["image"]
        if file and file.filename:
            ext = os.path.splitext(file.filename)[1].lower()
            if ext not in (".jpg", ".jpeg", ".png", ".gif", ".webp"):
                return jsonify({"msg": "Unsupported image format"}), 400
            image_filename = f"{uuid.uuid4().hex}{ext}"
            os.makedirs(UPLOAD_FOLDER, exist_ok=True)
            file.save(os.path.join(UPLOAD_FOLDER, image_filename))

    complaint = Complaint(
        title=title,
        description=description,
        category=category,
        image_filename=image_filename,
        latitude=lat,
        longitude=lng,
        priority=ComplaintPriority(priority),
        status=ComplaintStatus.SUBMITTED,
        user_id=user_id,
    )
    db.session.add(complaint)
    db.session.commit()

    return jsonify({"msg": "Complaint created", "complaint": complaint.to_dict()}), 201


@complaints_bp.route("", methods=["GET"])
@jwt_required()
def list_complaints():
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)

    query = Complaint.query

    if user.role == UserRole.CITIZEN:
        query = query.filter_by(user_id=user_id)
    elif user.role == UserRole.OFFICER:
        pass
    elif user.role == UserRole.ADMIN:
        pass

    complaints = query.order_by(Complaint.created_at.desc()).all()
    return jsonify({"complaints": [c.to_dict() for c in complaints]})


@complaints_bp.route("/<int:complaint_id>", methods=["GET"])
@jwt_required()
def get_complaint(complaint_id):
    complaint = db.session.get(Complaint, complaint_id)
    if not complaint:
        return jsonify({"msg": "Complaint not found"}), 404

    logs = (
        db.session.query(ComplaintLog)
        .filter_by(complaint_id=complaint_id)
        .order_by(ComplaintLog.created_at.asc())
        .all()
    )

    return jsonify({
        "complaint": complaint.to_dict(),
        "logs": [log.to_dict() for log in logs],
    })


@complaints_bp.route("/<int:complaint_id>", methods=["PUT"])
@jwt_required()
def update_complaint(complaint_id):
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    claims = get_jwt()
    role = claims.get("role")

    if role not in ("officer", "admin"):
        return jsonify({"msg": "Only officers and admins can update complaints"}), 403

    complaint = db.session.get(Complaint, complaint_id)
    if not complaint:
        return jsonify({"msg": "Complaint not found"}), 404

    data = request.get_json()
    if not data:
        return jsonify({"msg": "Missing JSON body"}), 400

    old_status = complaint.status
    new_status_str = data.get("status")
    remarks = data.get("remarks", "")

    if new_status_str:
        try:
            new_status = ComplaintStatus(new_status_str)
        except ValueError:
            return jsonify({"msg": "Invalid status"}), 400

        if not is_valid_transition(old_status, new_status, role):
            return jsonify({
                "msg": f"Invalid status transition: {old_status.value} → {new_status.value}",
            }), 400

        complaint.status = new_status

        log = ComplaintLog(
            complaint_id=complaint_id,
            old_status=old_status.value,
            new_status=new_status.value,
            officer_id=user_id,
            remarks=remarks,
        )
        db.session.add(log)

    if "priority" in data:
        try:
            complaint.priority = ComplaintPriority(data["priority"])
        except ValueError:
            return jsonify({"msg": "Invalid priority"}), 400

    if "category" in data:
        complaint.category = data["category"]

    db.session.commit()

    logs = (
        db.session.query(ComplaintLog)
        .filter_by(complaint_id=complaint_id)
        .order_by(ComplaintLog.created_at.asc())
        .all()
    )

    return jsonify({
        "msg": "Complaint updated",
        "complaint": complaint.to_dict(),
        "logs": [log.to_dict() for log in logs],
    })


@complaints_bp.route("/<int:complaint_id>/image", methods=["GET"])
def get_complaint_image(complaint_id):
    complaint = db.session.get(Complaint, complaint_id)
    if not complaint or not complaint.image_filename:
        return jsonify({"msg": "Image not found"}), 404

    return send_from_directory(
        UPLOAD_FOLDER,
        complaint.image_filename,
    )
