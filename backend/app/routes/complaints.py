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
from app.routes.notifications import create_notification

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
    user = db.session.get(User, user_id)
    if not user or not user.is_active:
        return jsonify({"msg": "Account is not active or no longer exists"}), 401
    user_name = user.name

    title = request.form.get("title")
    description = request.form.get("description")
    category = request.form.get("category", "other")
    latitude = request.form.get("latitude")
    longitude = request.form.get("longitude")
    priority_input = request.form.get("priority", "auto")

    if not title or not description or not latitude or not longitude:
        return jsonify({"msg": "title, description, latitude, and longitude are required"}), 400

    try:
        lat = float(latitude)
        lng = float(longitude)
    except ValueError:
        return jsonify({"msg": "Invalid latitude/longitude"}), 400

    # Auto-predict priority if "auto" or invalid
    from app.services.ai import detect_duplicates, predict_priority, classify_complaint_text
    if priority_input == "auto" or priority_input not in [p.value for p in ComplaintPriority]:
        priority = predict_priority(category, description, title, lat, lng)
    else:
        priority = ComplaintPriority(priority_input)

    image_filename = None
    if "image" in request.files:
        file = request.files["image"]
        if file and file.filename:
            from app.services.uploads import file_matches_ext
            ok, msg = file_matches_ext(file, {".jpg", ".jpeg", ".png", ".gif", ".webp"})
            if not ok:
                return jsonify({"msg": msg}), 400
            ext = os.path.splitext(file.filename)[1].lower()
            image_filename = f"{uuid.uuid4().hex}{ext}"
            os.makedirs(UPLOAD_FOLDER, exist_ok=True)
            file.save(os.path.join(UPLOAD_FOLDER, image_filename))

    # --- 1. Ward & Zone Auto-determination ---
    from app.models.ward import Ward
    from app.services.ai import haversine_distance
    wards = db.session.query(Ward).all()
    closest_ward = None
    min_dist = float("inf")
    for w in wards:
        dist = haversine_distance(lat, lng, float(w.latitude), float(w.longitude))
        if dist < min_dist:
            min_dist = dist
            closest_ward = w

    ward_id = closest_ward.id if closest_ward else None
    zone_id = closest_ward.zone_id if closest_ward else None

    # --- 2. Duplicate Complaint Clustering ---
    from app.models.complaint_cluster import ComplaintCluster
    cluster_id = None

    # First, look for an existing active cluster within 50m of same category
    existing_clusters = ComplaintCluster.query.filter_by(category=category, status="active").all()
    closest_cluster = None
    min_cluster_dist = float("inf")
    for cl in existing_clusters:
        dist = haversine_distance(lat, lng, float(cl.latitude), float(cl.longitude))
        if dist <= 50.0 and dist < min_cluster_dist:
            min_cluster_dist = dist
            closest_cluster = cl

    if closest_cluster:
        cluster_id = closest_cluster.id
    else:
        # Check if there is another unclustered active similar complaint within 50m
        nearby_complaint = Complaint.query.filter(
            Complaint.category == category,
            Complaint.status != ComplaintStatus.CLOSED,
            Complaint.status != ComplaintStatus.RESOLVED,
            Complaint.cluster_id.is_(None)
        ).first() # Simplify find first matching
        
        if nearby_complaint:
            nearby_dist = haversine_distance(lat, lng, float(nearby_complaint.latitude), float(nearby_complaint.longitude))
            if nearby_dist <= 50.0:
                # Create a new cluster
                new_cluster = ComplaintCluster(
                    name=f"Cluster for {category} Issues near {closest_ward.name if closest_ward else 'Location'}",
                    category=category,
                    latitude=float((lat + float(nearby_complaint.latitude)) / 2.0),
                    longitude=float((lng + float(nearby_complaint.longitude)) / 2.0),
                    status="active"
                )
                db.session.add(new_cluster)
                db.session.commit()
                
                # Assign both complaints to the new cluster
                nearby_complaint.cluster_id = new_cluster.id
                cluster_id = new_cluster.id

    complaint = Complaint(
        title=title,
        description=description,
        category=category,
        image_filename=image_filename,
        latitude=lat,
        longitude=lng,
        priority=priority,
        status=ComplaintStatus.SUBMITTED,
        user_id=user_id,
        ward_id=ward_id,
        zone_id=zone_id,
        cluster_id=cluster_id,
    )
    db.session.add(complaint)
    db.session.commit()

    # --- 3. Unique Tracking ID ---
    complaint.tracking_id = f"CMP-MUM-2026-{complaint.id:06d}"
    db.session.commit()

    # --- 4. SLA Deadline Calculation ---
    from app.services.sla import calculate_sla_deadline
    calculate_sla_deadline(complaint)

    # --- 5. Automatic Officer Assignment ---
    # Attempt auto-assign to officer (based on Department + Ward workload)
    from app.services.assignment import auto_assign_complaint
    # We must first assign a department if one matches the category
    from app.models.department import Department
    dept = db.session.query(Department).filter(
        (Department.name.ilike(category)) | (Department.name.ilike(f"%{category}%"))
    ).first()
    if dept:
        complaint.department_id = dept.id
        db.session.commit()
        # Attempt auto-assignment
        auto_assign_complaint(complaint)

    # --- 6. Audit Trail Logging ---
    from app.services.audit import log_audit_event
    log_audit_event(
        user_id=user_id,
        action="create",
        entity_type="complaint",
        entity_id=complaint.id,
        new_value=complaint.tracking_id,
        metadata={"title": complaint.title, "category": complaint.category, "ward": closest_ward.name if closest_ward else "None"}
    )

    # Notify citizen who filed the complaint
    create_notification(
        user_id=user_id,
        title="Complaint Submitted",
        message=f"Your complaint #{complaint.id} ({complaint.tracking_id}) has been received and is awaiting review.",
        category="status_change",
        complaint_id=complaint.id,
    )

    # Notify admins about new complaint
    admins = User.query.filter_by(role=UserRole.ADMIN, is_active=True).all()
    for admin in admins:
        create_notification(
            user_id=admin.id,
            title="New Complaint Filed",
            message=f"{user_name} filed a new complaint #{complaint.id}: {complaint.title}",
            category="new_complaint",
            complaint_id=complaint.id,
        )

    # Run duplicate detection for the response
    duplicates = detect_duplicates(lat, lng, category, description, title, complaint.id)

    return jsonify({
        "msg": "Complaint created",
        "complaint": complaint.to_dict(),
        "predicted_priority": complaint.priority.value,
        "duplicates_found": len(duplicates),
        "duplicates": duplicates,
    }), 201


@complaints_bp.route("", methods=["GET"])
@jwt_required()
def list_complaints():
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    if not user or not user.is_active:
        return jsonify({"msg": "Account is not active or no longer exists"}), 401

    query = Complaint.query

    if user.role == UserRole.CITIZEN:
        query = query.filter_by(user_id=user_id)
    elif user.role in (UserRole.OFFICER, UserRole.DEPT_HEAD):
        if not user.department_id:
            return jsonify({"complaints": []}), 200
        query = query.filter_by(department_id=user.department_id)
    elif user.role == UserRole.ADMIN:
        pass

    complaints = query.order_by(Complaint.created_at.desc()).all()
    return jsonify({"complaints": [c.to_dict() for c in complaints]})


@complaints_bp.route("/<int:complaint_id>", methods=["GET"])
@jwt_required()
def get_complaint(complaint_id):
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    complaint = db.session.get(Complaint, complaint_id)
    if not complaint:
        return jsonify({"msg": "Complaint not found"}), 404

    # Citizens may only read their own complaints; staff may read within
    # their department (admins dept heads see everything).
    if user.role == UserRole.CITIZEN and complaint.user_id != user_id:
        return jsonify({"msg": "You do not have permission to view this complaint"}), 403
    if user.role == UserRole.OFFICER:
        if not user.department_id:
            return jsonify({"msg": "You do not have permission to view this complaint"}), 403
        if complaint.department_id != user.department_id:
            return jsonify({"msg": "You do not have permission to view this complaint"}), 403

    logs = (
        db.session.query(ComplaintLog)
        .filter_by(complaint_id=complaint_id)
        .order_by(ComplaintLog.created_at.asc())
        .all()
    )

    # --- 1. AI Summary Assistance ---
    from app.services.ai import generate_complaint_summary
    ai_assistance = generate_complaint_summary(complaint)

    # --- 2. Cluster Complaints Sibling Fetching ---
    cluster_siblings = []
    cluster_details = None
    if complaint.cluster_id:
        from app.models.complaint_cluster import ComplaintCluster
        cluster = db.session.get(ComplaintCluster, complaint.cluster_id)
        if cluster:
            cluster_details = cluster.to_dict()
            siblings = Complaint.query.filter(
                Complaint.cluster_id == complaint.cluster_id,
                Complaint.id != complaint.id
            ).all()
            cluster_siblings = [
                {
                    "id": s.id,
                    "tracking_id": s.tracking_id,
                    "title": s.title,
                    "status": s.status.value,
                    "priority": s.priority.value,
                    "created_at": s.created_at.isoformat()
                }
                for s in siblings
            ]

    return jsonify({
        "complaint": complaint.to_dict(),
        "logs": [log.to_dict() for log in logs],
        "ai_assistance": ai_assistance,
        "cluster_details": cluster_details,
        "cluster_siblings": cluster_siblings,
    })


@complaints_bp.route("/<int:complaint_id>", methods=["PUT"])
@jwt_required()
def update_complaint(complaint_id):
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    role = user.role.value

    if role not in ("officer", "dept_head", "admin"):
        return jsonify({"msg": "Only officers, department heads, and admins can update complaints"}), 403

    if not user.is_active:
        return jsonify({"msg": "Account is not active"}), 401

    complaint = db.session.get(Complaint, complaint_id)
    if not complaint:
        return jsonify({"msg": "Complaint not found"}), 404

    # Department Heads can only edit complaints in their department
    if role == "dept_head":
        if not user.department_id:
            return jsonify({"msg": "Your account has no department assigned"}), 403
        if complaint.department_id != user.department_id:
            return jsonify({"msg": "Department heads can only manage complaints within their department"}), 403

    # Officers can only edit complaints assigned to their department
    if role == "officer":
        if not user.department_id:
            return jsonify({"msg": "Your account has no department assigned"}), 403
        if complaint.department_id != user.department_id:
            return jsonify({"msg": "Officers can only manage complaints within their department"}), 403

    data = request.get_json()
    if not data:
        return jsonify({"msg": "Missing JSON body"}), 400

    from app.services.audit import log_audit_event

    old_status = complaint.status
    new_status_str = data.get("status")
    remarks = data.get("remarks", "")

    old_priority = complaint.priority
    old_dept_id = complaint.department_id
    old_officer_id = complaint.officer_id

    # Handle status change
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

        # Audit Log
        log_audit_event(
            user_id=user_id,
            action="status_change",
            entity_type="complaint",
            entity_id=complaint_id,
            old_value=old_status.value,
            new_value=new_status.value,
            metadata={"remarks": remarks}
        )

        # Notify citizen
        create_notification(
            user_id=complaint.user_id,
            title="Complaint Status Updated",
            message=f"Your complaint #{complaint_id} ({complaint.tracking_id}) status has changed from {old_status.value} to {new_status.value}.",
            category="status_change",
            complaint_id=complaint_id,
        )

        # Cascading resolution for clusters
        if new_status == ComplaintStatus.RESOLVED and complaint.cluster_id:
            siblings = Complaint.query.filter(
                Complaint.cluster_id == complaint.cluster_id,
                Complaint.id != complaint.id,
                Complaint.status.notin_([ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED])
            ).all()

            for s in siblings:
                old_sib_status = s.status
                s.status = ComplaintStatus.RESOLVED

                sib_log = ComplaintLog(
                    complaint_id=s.id,
                    old_status=old_sib_status.value,
                    new_status=ComplaintStatus.RESOLVED.value,
                    officer_id=user_id,
                    remarks=f"[Cluster Resolution Cascade] Automatically resolved due to resolution of cluster leader complaint #{complaint.id}.",
                )
                db.session.add(sib_log)

                # Sibling Audit Log
                log_audit_event(
                    user_id=user_id,
                    action="status_change",
                    entity_type="complaint",
                    entity_id=s.id,
                    old_value=old_sib_status.value,
                    new_value=ComplaintStatus.RESOLVED.value,
                    metadata={"cascade_source_id": complaint.id, "remarks": "cluster cascade"}
                )

                # Sibling Notification
                create_notification(
                    user_id=s.user_id,
                    title="Complaint Resolved (Cluster Cascade)",
                    message=f"Your complaint #{s.id} ({s.tracking_id}) has been marked as RESOLVED because a linked issue in the same cluster was resolved.",
                    category="status_change",
                    complaint_id=s.id,
                )

    # Handle priority change
    if "priority" in data:
        try:
            new_priority = ComplaintPriority(data["priority"])
            if old_priority != new_priority:
                complaint.priority = new_priority
                log_audit_event(
                    user_id=user_id,
                    action="priority_change",
                    entity_type="complaint",
                    entity_id=complaint_id,
                    old_value=old_priority.value,
                    new_value=new_priority.value
                )
                # Re-calculate SLA deadline based on new priority!
                from app.services.sla import calculate_sla_deadline
                calculate_sla_deadline(complaint)
        except ValueError:
            return jsonify({"msg": "Invalid priority"}), 400

    # Handle department change
    if "department_id" in data:
        new_dept_id = data["department_id"]
        if new_dept_id != old_dept_id:
            if role == "officer":
                return jsonify({"msg": "Officers cannot change a complaint's department"}), 403
            complaint.department_id = new_dept_id
            log_audit_event(
                user_id=user_id,
                action="department_change",
                entity_type="complaint",
                entity_id=complaint_id,
                old_value=old_dept_id,
                new_value=new_dept_id
            )

    # Handle officer assignment change
    if "officer_id" in data:
        new_officer_id = data["officer_id"]
        if new_officer_id != old_officer_id:
            if role == "officer":
                return jsonify({"msg": "Officers cannot assign complaints to other officers"}), 403

            # Verify officer exists and belongs to the department
            if new_officer_id:
                officer = db.session.get(User, new_officer_id)
                if not officer or officer.role != UserRole.OFFICER:
                    return jsonify({"msg": "Invalid officer ID"}), 400
                if complaint.department_id and officer.department_id != complaint.department_id:
                    return jsonify({"msg": "Officer must belong to the complaint's department"}), 400

            complaint.officer_id = new_officer_id
            
            # Automatically transition status to ASSIGNED if currently SUBMITTED/VERIFIED
            if new_officer_id and complaint.status in (ComplaintStatus.SUBMITTED, ComplaintStatus.VERIFIED):
                complaint.status = ComplaintStatus.ASSIGNED

            log_audit_event(
                user_id=user_id,
                action="officer_assign",
                entity_type="complaint",
                entity_id=complaint_id,
                old_value=old_officer_id,
                new_value=new_officer_id
            )

            # Notify newly assigned officer
            if new_officer_id:
                create_notification(
                    user_id=new_officer_id,
                    title="Task Assigned to You",
                    message=f"Complaint #{complaint_id} has been manually assigned to you.",
                    category="status_change",
                    complaint_id=complaint_id
                )

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


@complaints_bp.route("/<int:complaint_id>/proof", methods=["POST"])
@jwt_required()
def upload_proof(complaint_id):
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    role = user.role.value

    if role not in ("officer", "admin", "dept_head"):
        return jsonify({"msg": "Only officers, department heads, and admins can upload proof"}), 403

    if not user.is_active:
        return jsonify({"msg": "Account is not active"}), 401

    complaint = db.session.get(Complaint, complaint_id)
    if not complaint:
        return jsonify({"msg": "Complaint not found"}), 404

    if role in ("officer", "dept_head"):
        if not user.department_id:
            return jsonify({"msg": "Your account has no department assigned"}), 403
        if complaint.department_id != user.department_id:
            return jsonify({"msg": "You can only upload proof for complaints in your department"}), 403

    if "image" not in request.files:
        return jsonify({"msg": "No image provided"}), 400

    file = request.files["image"]
    if not file or not file.filename:
        return jsonify({"msg": "No image selected"}), 400

    from app.services.uploads import file_matches_ext
    ok, msg = file_matches_ext(file, {".jpg", ".jpeg", ".png", ".gif", ".webp"})
    if not ok:
        return jsonify({"msg": msg}), 400

    ext = os.path.splitext(file.filename)[1].lower()

    proof_filename = f"proof_{uuid.uuid4().hex}{ext}"
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    file.save(os.path.join(UPLOAD_FOLDER, proof_filename))

    complaint.proof_image_filename = proof_filename
    complaint.proof_uploaded_at = datetime.utcnow()
    complaint.proof_uploaded_by_id = user_id
    complaint.proof_remarks = request.form.get("remarks", "")
    
    lat_val = request.form.get("latitude")
    lng_val = request.form.get("longitude")
    if lat_val and lng_val:
        try:
            complaint.proof_latitude = float(lat_val)
            complaint.proof_longitude = float(lng_val)
        except ValueError:
            pass

    # Transition to RESOLVED automatically when proof is uploaded if current status is active
    if complaint.status in (ComplaintStatus.ASSIGNED, ComplaintStatus.IN_PROGRESS):
        old_status = complaint.status
        complaint.status = ComplaintStatus.RESOLVED
        
        # Add log entry
        log = ComplaintLog(
            complaint_id=complaint_id,
            old_status=old_status.value,
            new_status=ComplaintStatus.RESOLVED.value,
            officer_id=user_id,
            remarks=f"Resolution proof uploaded. Remarks: {complaint.proof_remarks}"
        )
        db.session.add(log)

        # Audit event
        from app.services.audit import log_audit_event
        log_audit_event(
            user_id=user_id,
            action="status_change",
            entity_type="complaint",
            entity_id=complaint_id,
            old_value=old_status.value,
            new_value=ComplaintStatus.RESOLVED.value,
            metadata={"reason": "Resolution proof uploaded"}
        )

        # Notify citizen
        create_notification(
            user_id=complaint.user_id,
            title="Complaint Resolved (Proof Uploaded)",
            message=f"Officer {user.name} has uploaded resolution proof for your complaint #{complaint_id} ({complaint.tracking_id}) and marked it RESOLVED.",
            category="status_change",
            complaint_id=complaint_id
        )

    db.session.commit()

    return jsonify({
        "msg": "Proof uploaded successfully",
        "proof_image_url": f"/api/complaints/{complaint_id}/proof-image",
        "complaint": complaint.to_dict()
    }), 200


@complaints_bp.route("/<int:complaint_id>/image", methods=["GET"])
@jwt_required()
def get_complaint_image(complaint_id):
    """Serve the citizen's attached complaint image.

    Only the owning citizen (or any officer/admin/dept_head) may view it.
    """
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    allowed_roles = (UserRole.OFFICER, UserRole.DEPT_HEAD, UserRole.ADMIN)
    complaint = db.session.get(Complaint, complaint_id)
    if not complaint or not complaint.image_filename:
        return jsonify({"msg": "Image not found"}), 404

    if user.role not in allowed_roles and complaint.user_id != user_id:
        return jsonify({"msg": "You do not have permission to view this image"}), 403

    return send_from_directory(
        UPLOAD_FOLDER,
        complaint.image_filename,
    )


@complaints_bp.route("/<int:complaint_id>/proof-image", methods=["GET"])
@jwt_required()
def get_complaint_proof_image(complaint_id):
    """Serve resolution-proof images, restricted to authorized parties.

    Officers can view proofs for complaints in their own department; dept
    heads/admins can view any; the owning citizen can view their own.
    """
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)

    complaint = db.session.get(Complaint, complaint_id)
    if not complaint or not complaint.proof_image_filename:
        return jsonify({"msg": "Proof image not found"}), 404

    if user.role == UserRole.ADMIN or user.role == UserRole.DEPT_HEAD:
        pass  # full access
    elif user.role == UserRole.OFFICER:
        if user.department_id and complaint.department_id != user.department_id:
            return jsonify({"msg": "You do not have permission to view this proof"}), 403
    elif complaint.user_id != user_id:
        return jsonify({"msg": "You do not have permission to view this proof"}), 403
    else:
        return jsonify({"msg": "You do not have permission to view this proof"}), 403

    return send_from_directory(
        UPLOAD_FOLDER,
        complaint.proof_image_filename,
    )


@complaints_bp.route("/<int:complaint_id>/reopen", methods=["POST"])
@jwt_required()
def reopen_complaint(complaint_id):
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    if user.role != UserRole.CITIZEN:
        return jsonify({"msg": "Only citizens can reopen complaints"}), 403

    complaint = db.session.get(Complaint, complaint_id)
    if not complaint:
        return jsonify({"msg": "Complaint not found"}), 404

    if complaint.user_id != user_id:
        return jsonify({"msg": "You can only reopen complaints filed by yourself"}), 403

    if complaint.status not in (ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED):
        return jsonify({"msg": "Only resolved or closed complaints can be reopened"}), 400

    data = request.get_json() or {}
    reason = data.get("reason")
    if not reason:
        return jsonify({"msg": "Reason for reopening is required"}), 400

    old_status = complaint.status
    complaint.status = ComplaintStatus.IN_PROGRESS
    complaint.escalation_level = 0  # Reset escalation level

    # Add log entry
    log = ComplaintLog(
        complaint_id=complaint_id,
        old_status=old_status.value,
        new_status=ComplaintStatus.IN_PROGRESS.value,
        officer_id=user_id,
        remarks=f"Reopened by citizen. Reason: {reason}"
    )
    db.session.add(log)

    # Audit Trail
    from app.services.audit import log_audit_event
    log_audit_event(
        user_id=user_id,
        action="reopen",
        entity_type="complaint",
        entity_id=complaint_id,
        old_value=old_status.value,
        new_value=ComplaintStatus.IN_PROGRESS.value,
        metadata={"reason": reason}
    )

    # Notify officer assigned (if any)
    if complaint.officer_id:
        create_notification(
            user_id=complaint.officer_id,
            title="Task Reopened by Citizen",
            message=f"Complaint #{complaint_id} ({complaint.tracking_id}) has been reopened. Reason: {reason}",
            category="status_change",
            complaint_id=complaint_id
        )

    # Notify admins
    admins = User.query.filter_by(role=UserRole.ADMIN, is_active=True).all()
    for admin in admins:
        create_notification(
            user_id=admin.id,
            title="Complaint Reopened",
            message=f"Citizen reopened complaint #{complaint_id} ({complaint.tracking_id}). Reason: {reason}",
            category="status_change",
            complaint_id=complaint_id
        )

    db.session.commit()
    return jsonify({"msg": "Complaint reopened", "complaint": complaint.to_dict()}), 200


@complaints_bp.route("/<int:complaint_id>/confirm-resolution", methods=["POST"])
@jwt_required()
def confirm_resolution(complaint_id):
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    if user.role != UserRole.CITIZEN:
        return jsonify({"msg": "Only citizens can confirm resolutions"}), 403

    complaint = db.session.get(Complaint, complaint_id)
    if not complaint:
        return jsonify({"msg": "Complaint not found"}), 404

    if complaint.user_id != user_id:
        return jsonify({"msg": "You can only confirm complaints filed by yourself"}), 403

    if complaint.status != ComplaintStatus.RESOLVED:
        return jsonify({"msg": "You can only confirm resolution for complaints currently marked as RESOLVED"}), 400

    complaint.status = ComplaintStatus.CLOSED
    
    # Add log entry
    log = ComplaintLog(
        complaint_id=complaint_id,
        old_status=ComplaintStatus.RESOLVED.value,
        new_status=ComplaintStatus.CLOSED.value,
        officer_id=user_id,
        remarks="Citizen confirmed resolution."
    )
    db.session.add(log)

    # Audit Trail
    from app.services.audit import log_audit_event
    log_audit_event(
        user_id=user_id,
        action="confirm_resolution",
        entity_type="complaint",
        entity_id=complaint_id,
        old_value=ComplaintStatus.RESOLVED.value,
        new_value=ComplaintStatus.CLOSED.value
    )

    db.session.commit()
    return jsonify({"msg": "Resolution confirmed. Ticket closed.", "complaint": complaint.to_dict()}), 200


@complaints_bp.route("/<int:complaint_id>/upvote", methods=["POST"])
@jwt_required()
def upvote_complaint(complaint_id):
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    if user.role != UserRole.CITIZEN:
        return jsonify({"msg": "Only citizens can upvote complaints"}), 403

    complaint = db.session.get(Complaint, complaint_id)
    if not complaint:
        return jsonify({"msg": "Complaint not found"}), 404

    from app.models.complaint_confirmation import ComplaintConfirmation
    existing_upvote = ComplaintConfirmation.query.filter_by(user_id=user_id, complaint_id=complaint_id).first()
    if existing_upvote:
        return jsonify({"msg": "You have already upvoted this complaint"}), 409

    upvote = ComplaintConfirmation(user_id=user_id, complaint_id=complaint_id)
    db.session.add(upvote)
    db.session.commit()

    # Log audit event
    from app.services.audit import log_audit_event
    log_audit_event(
        user_id=user_id,
        action="upvote",
        entity_type="complaint",
        entity_id=complaint_id
    )

    # If the upvote count exceeds 5, and it has high duplicates/confidence, automatically elevate its priority!
    upvote_count = complaint.confirmations.count()
    if upvote_count >= 5 and complaint.priority == ComplaintPriority.LOW:
        complaint.priority = ComplaintPriority.MEDIUM
        db.session.commit()
        # Recalculate SLA
        from app.services.sla import calculate_sla_deadline
        calculate_sla_deadline(complaint)

    return jsonify({"msg": "Complaint upvoted successfully", "upvotes": upvote_count}), 200


@complaints_bp.route("/<int:complaint_id>/feedback", methods=["POST"])
@jwt_required()
def submit_feedback(complaint_id):
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    if user.role != UserRole.CITIZEN:
        return jsonify({"msg": "Only citizens can submit feedback"}), 403

    complaint = db.session.get(Complaint, complaint_id)
    if not complaint:
        return jsonify({"msg": "Complaint not found"}), 404

    if complaint.user_id != user_id:
        return jsonify({"msg": "You can only submit feedback for complaints filed by yourself"}), 403

    if complaint.status != ComplaintStatus.CLOSED:
        return jsonify({"msg": "Feedback can only be submitted after the complaint is resolved and closed"}), 400

    if complaint.rating is not None:
        return jsonify({"msg": "You have already submitted feedback for this complaint"}), 409

    data = request.get_json() or {}
    rating = data.get("rating")
    satisfaction_status = data.get("satisfaction_status")
    feedback = data.get("feedback", "")

    if rating is None or rating not in (1, 2, 3, 4, 5):
        return jsonify({"msg": "Valid rating (1-5 stars) is required"}), 400

    if not satisfaction_status or satisfaction_status not in ("satisfied", "unsatisfied"):
        return jsonify({"msg": "Satisfaction status (satisfied/unsatisfied) is required"}), 400

    complaint.rating = int(rating)
    complaint.satisfaction_status = satisfaction_status
    complaint.feedback = feedback

    db.session.commit()

    # Log audit event
    from app.services.audit import log_audit_event
    log_audit_event(
        user_id=user_id,
        action="feedback",
        entity_type="complaint",
        entity_id=complaint_id,
        metadata={"rating": rating, "satisfaction": satisfaction_status}
    )

    return jsonify({"msg": "Feedback submitted successfully", "complaint": complaint.to_dict()}), 200


@complaints_bp.route("/public/track/<string:tracking_id>", methods=["GET"])
def public_track_complaint(tracking_id):
    complaint = Complaint.query.filter_by(tracking_id=tracking_id).first()
    if not complaint:
        return jsonify({"msg": "Complaint tracking ID not found"}), 404

    logs = (
        db.session.query(ComplaintLog)
        .filter_by(complaint_id=complaint.id)
        .order_by(ComplaintLog.created_at.asc())
        .all()
    )

    # Sanitize logs to hide officer names
    sanitized_logs = []
    for log in logs:
        sanitized_logs.append({
            "id": log.id,
            "old_status": log.old_status,
            "new_status": log.new_status,
            "remarks": log.remarks if "cascade" not in (log.remarks or "").lower() else "Cluster resolution cascade applied",
            "created_at": log.created_at.isoformat()
        })

    return jsonify({
        "complaint": {
            "tracking_id": complaint.tracking_id,
            "category": complaint.category,
            "title": complaint.title,
            "status": complaint.status.value,
            "priority": complaint.priority.value,
            "department_name": complaint.department.name if complaint.department else None,
            "ward_name": complaint.ward.name if complaint.ward else None,
            "created_at": complaint.created_at.isoformat()
        },
        "logs": sanitized_logs
    }), 200



