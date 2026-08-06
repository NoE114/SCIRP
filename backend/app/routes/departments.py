import os
import uuid

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
from app.models.department import Department, seed_departments

departments_bp = Blueprint("departments", __name__)

UPLOAD_FOLDER = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads"
)


@departments_bp.route("/departments", methods=["GET"])
@jwt_required()
def list_departments():
    depts = db.session.query(Department).all()
    return jsonify({"departments": [d.to_dict() for d in depts]})


@departments_bp.route("/departments", methods=["POST"])
@jwt_required()
def create_department():
    claims = get_jwt()
    if claims.get("role") != "admin":
        return jsonify({"msg": "Only admins can create departments"}), 403

    data = request.get_json()
    if not data or not data.get("name"):
        return jsonify({"msg": "name is required"}), 400

    if db.session.query(Department).filter_by(name=data["name"]).first():
        return jsonify({"msg": "Department already exists"}), 409

    dept = Department(
        name=data["name"],
        description=data.get("description", ""),
    )
    db.session.add(dept)
    db.session.commit()

    return jsonify({"msg": "Department created", "department": dept.to_dict()}), 201


@departments_bp.route("/department/complaints", methods=["GET"])
@jwt_required()
def department_complaints():
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)

    if user.role == UserRole.CITIZEN:
        return jsonify({"msg": "Citizens do not have access to department complaints"}), 403

    query = Complaint.query

    if user.role == UserRole.OFFICER:
        query = query.filter_by(department_id=user.department_id)

    complaints = query.order_by(Complaint.created_at.desc()).all()
    return jsonify({"complaints": [c.to_dict() for c in complaints]})
