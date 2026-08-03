import os
import uuid

from flask import (
    Blueprint,
    request,
    jsonify,
    send_from_directory,
    current_app,
)
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename

from app.extensions import db
from app.models.user import User, UserRole
from app.models.complaint import Complaint, ComplaintStatus, ComplaintPriority

UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")

complaints_bp = Blueprint("complaints", __name__)


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
    return jsonify({"complaint": complaint.to_dict()})


@complaints_bp.route("/<int:complaint_id>/image", methods=["GET"])
def get_complaint_image(complaint_id):
    complaint = db.session.get(Complaint, complaint_id)
    if not complaint or not complaint.image_filename:
        return jsonify({"msg": "Image not found"}), 404

    return send_from_directory(
        UPLOAD_FOLDER,
        complaint.image_filename,
    )
