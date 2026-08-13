from collections import Counter
from datetime import datetime

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash

from app.extensions import db
from app.models.user import User, UserRole
from app.models.complaint import Complaint, ComplaintStatus, ComplaintPriority
from app.models.complaint_log import ComplaintLog
from app.models.department import Department

admin_bp = Blueprint("admin", __name__)


@admin_bp.route("/dashboard", methods=["GET"])
@jwt_required()
def dashboard():
    user = db.session.get(User, int(get_jwt_identity()))
    if not user or not user.is_active or user.role != UserRole.ADMIN:
        return jsonify({"msg": "Only admins can access the dashboard"}), 403

    users = db.session.query(User).all()
    complaints = db.session.query(Complaint).all()
    departments = db.session.query(Department).all()

    users_by_role = Counter(u.role.value for u in users)
    complaints_by_status = Counter(c.status.value for c in complaints)
    complaints_by_category = Counter(c.category for c in complaints)
    complaints_by_dept = Counter(
        c.department.name if c.department else "Unassigned" for c in complaints
    )

    recent_complaints = (
        db.session.query(Complaint)
        .order_by(Complaint.created_at.desc())
        .limit(10)
        .all()
    )

    return jsonify({
        "stats": {
            "total_users": len(users),
            "users_by_role": dict(users_by_role),
            "total_complaints": len(complaints),
            "complaints_by_status": dict(complaints_by_status),
            "complaints_by_category": dict(complaints_by_category),
            "complaints_by_department": dict(complaints_by_dept),
            "total_departments": len(departments),
        },
        "recent_complaints": [c.to_dict() for c in recent_complaints],
    })


@admin_bp.route("/officer", methods=["POST"])
@jwt_required()
def create_officer():
    user = db.session.get(User, int(get_jwt_identity()))
    if not user or not user.is_active or user.role != UserRole.ADMIN:
        return jsonify({"msg": "Only admins can create officers"}), 403

    data = request.get_json()
    if not data:
        return jsonify({"msg": "Missing JSON body"}), 400

    name = data.get("name")
    email = data.get("email")
    password = data.get("password")
    phone = data.get("phone")
    department_id = data.get("department_id")

    if not name or not email or not password:
        return jsonify({"msg": "name, email, and password are required"}), 400

    if db.session.query(User).filter_by(email=email).first():
        return jsonify({"msg": "Email already registered"}), 409

    if department_id:
        dept = db.session.get(Department, department_id)
        if not dept:
            return jsonify({"msg": "Department not found"}), 404

    officer = User(
        name=name,
        email=email,
        phone=phone,
        role=UserRole.OFFICER,
        department_id=department_id,
    )
    officer.set_password(password)
    db.session.add(officer)
    db.session.commit()

    return jsonify({"msg": "Officer created", "officer": officer.to_dict()}), 201


@admin_bp.route("/users", methods=["GET"])
@jwt_required()
def list_users():
    user = db.session.get(User, int(get_jwt_identity()))
    if not user or not user.is_active or user.role != UserRole.ADMIN:
        return jsonify({"msg": "Only admins can list users"}), 403

    users = db.session.query(User).all()
    return jsonify({"users": [u.to_dict() for u in users]})


@admin_bp.route("/users/<int:user_id>", methods=["PUT"])
@jwt_required()
def update_user(user_id):
    user = db.session.get(User, int(get_jwt_identity()))
    if not user or not user.is_active or user.role != UserRole.ADMIN:
        return jsonify({"msg": "Only admins can update users"}), 403

    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"msg": "User not found"}), 404

    data = request.get_json()
    if not data:
        return jsonify({"msg": "Missing JSON body"}), 400

    if "is_active" in data:
        user.is_active = data["is_active"]

    if "department_id" in data:
        if data["department_id"]:
            dept = db.session.get(Department, data["department_id"])
            if not dept:
                return jsonify({"msg": "Department not found"}), 404
        user.department_id = data["department_id"]

    if "name" in data:
        user.name = data["name"]

    if "role" in data:
        try:
            user.role = UserRole(data["role"])
        except ValueError:
            return jsonify({"msg": "Invalid role"}), 400

    db.session.commit()
    return jsonify({"msg": "User updated", "user": user.to_dict()})


@admin_bp.route("/complaints/<int:complaint_id>/spam", methods=["PUT"])
@jwt_required()
def flag_spam(complaint_id):
    user = db.session.get(User, int(get_jwt_identity()))
    if not user or not user.is_active or user.role != UserRole.ADMIN:
        return jsonify({"msg": "Only admins can flag complaints"}), 403

    complaint = db.session.get(Complaint, complaint_id)
    if not complaint:
        return jsonify({"msg": "Complaint not found"}), 404

    data = request.get_json() or {}
    is_spam = data.get("is_spam", True)
    complaint.is_spam = is_spam

    db.session.commit()

    return jsonify({"msg": "Complaint updated", "is_spam": complaint.is_spam}), 200


@admin_bp.route("/users/<int:user_id>", methods=["DELETE"])
@jwt_required()
def delete_user(user_id):
    user = db.session.get(User, int(get_jwt_identity()))
    if not user or not user.is_active or user.role != UserRole.ADMIN:
        return jsonify({"msg": "Only admins can delete users"}), 403

    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"msg": "User not found"}), 404

    # Prevent deleting oneself
    current_admin_id = int(get_jwt_identity())
    if user.id == current_admin_id:
        return jsonify({"msg": "You cannot delete your own admin account"}), 400

    from app.models.notification import Notification
    from app.models.complaint import Complaint
    from app.models.complaint_log import ComplaintLog

    # 1. Delete notifications sent to this user
    Notification.query.filter_by(user_id=user_id).delete()

    # 2. Nullify officer reference in complaint logs
    ComplaintLog.query.filter_by(officer_id=user_id).update({ComplaintLog.officer_id: None})

    # 3. Handle complaints filed by this user (if any)
    user_complaints = Complaint.query.filter_by(user_id=user_id).all()
    for c in user_complaints:
        # Delete logs for this complaint
        ComplaintLog.query.filter_by(complaint_id=c.id).delete()
        # Delete notifications referencing this complaint
        Notification.query.filter_by(related_complaint_id=c.id).delete()
        # Delete the complaint
        db.session.delete(c)

    # 4. Delete the user
    db.session.delete(user)
    db.session.commit()

    return jsonify({"msg": "User account and all related records deleted successfully"}), 200


@admin_bp.route("/sla/configs", methods=["GET"])
@jwt_required()
def list_sla_configs():
    user = db.session.get(User, int(get_jwt_identity()))
    if not user or not user.is_active or user.role != UserRole.ADMIN:
        return jsonify({"msg": "Only admins can view SLA configurations"}), 403

    from app.models.sla_config import SlaConfig
    configs = db.session.query(SlaConfig).all()
    return jsonify({"configs": [c.to_dict() for c in configs]})


@admin_bp.route("/sla/configs/<string:priority>", methods=["PUT"])
@jwt_required()
def update_sla_config(priority):
    user = db.session.get(User, int(get_jwt_identity()))
    if not user or not user.is_active or user.role != UserRole.ADMIN:
        return jsonify({"msg": "Only admins can update SLA configurations"}), 403

    from app.models.sla_config import SlaConfig
    config = db.session.get(SlaConfig, priority)
    if not config:
        return jsonify({"msg": "SlaConfig not found"}), 404

    data = request.get_json()
    if not data or "duration_hours" not in data:
        return jsonify({"msg": "duration_hours is required"}), 400

    try:
        hours = int(data["duration_hours"])
        if hours <= 0:
            raise ValueError()
    except ValueError:
        return jsonify({"msg": "duration_hours must be a positive integer"}), 400

    old_hours = config.duration_hours
    config.duration_hours = hours
    db.session.commit()

    # Log Audit Trail
    from app.services.audit import log_audit_event
    log_audit_event(
        user_id=int(get_jwt_identity()),
        action="update_sla",
        entity_type="sla_config",
        entity_id=None,
        old_value=str(old_hours),
        new_value=str(hours),
        metadata={"priority": priority}
    )

    return jsonify({"msg": "SLA config updated", "config": config.to_dict()})


@admin_bp.route("/audit-logs", methods=["GET"])
@jwt_required()
def get_audit_logs():
    user = db.session.get(User, int(get_jwt_identity()))
    if not user or not user.is_active or user.role != UserRole.ADMIN:
        return jsonify({"msg": "Only admins can access audit logs"}), 403

    from app.models.audit_log import AuditLog
    logs = db.session.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(100).all()
    return jsonify({"audit_logs": [log.to_dict() for log in logs]})


@admin_bp.route("/sla/trigger-escalations", methods=["POST"])
@jwt_required()
def force_trigger_escalations():
    """
    Manual override endpoint for admins/cron to run the SLA escalations checking job.
    """
    user = db.session.get(User, int(get_jwt_identity()))
    if not user or not user.is_active or user.role != UserRole.ADMIN:
        return jsonify({"msg": "Only admins can trigger manual SLA check"}), 403

    from app.services.sla import run_sla_escalations
    escalated_count = run_sla_escalations()
    return jsonify({"msg": "SLA escalation check completed", "escalated_count": escalated_count}), 200

