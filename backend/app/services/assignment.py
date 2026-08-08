from app.extensions import db
from app.models.user import User, UserRole
from app.models.complaint import Complaint, ComplaintStatus
from app.services.audit import log_audit_event
from app.routes.notifications import create_notification


def auto_assign_complaint(complaint):
    """
    Automatically assign a complaint to the most suitable officer.
    Considers department, ward, and officer workload.
    """
    try:
        # Auto-assignment requires a department and ward
        if not complaint.department_id:
            return False

        # 1. Query candidate officers in the same department
        candidates = User.query.filter_by(
            role=UserRole.OFFICER,
            department_id=complaint.department_id,
            is_active=True
        )

        # 2. Filter by same ward first if possible (Ward-based localization)
        ward_candidates = []
        if complaint.ward_id:
            ward_candidates = candidates.filter_by(ward_id=complaint.ward_id).all()

        # If no officer belongs to this specific ward, fall back to all department officers
        candidate_list = ward_candidates if len(ward_candidates) > 0 else candidates.all()

        if not candidate_list:
            print(f"[AUTO-ASSIGN] No active officer found for department {complaint.department_id}")
            return False

        # 3. Compute workload for each candidate
        # Workload = count of active complaints (status == ASSIGNED or IN_PROGRESS)
        best_officer = None
        min_workload = float('inf')

        for officer in candidate_list:
            workload = db.session.query(Complaint).filter(
                Complaint.officer_id == officer.id,
                Complaint.status.in_([ComplaintStatus.ASSIGNED, ComplaintStatus.IN_PROGRESS])
            ).count()

            if workload < min_workload:
                min_workload = workload
                best_officer = officer

        if best_officer:
            # Assign the officer
            old_officer_id = complaint.officer_id
            complaint.officer_id = best_officer.id
            complaint.status = ComplaintStatus.ASSIGNED

            db.session.commit()

            # Audit log
            log_audit_event(
                user_id=None,  # System action
                action="auto_assign",
                entity_type="complaint",
                entity_id=complaint.id,
                old_value=old_officer_id,
                new_value=best_officer.id,
                metadata={"reason": "intelligent workload auto-assignment", "workload": min_workload}
            )

            # Notifications
            # Notify officer
            create_notification(
                user_id=best_officer.id,
                title="New Task Assigned (Auto)",
                message=f"Complaint #{complaint.id} has been automatically assigned to you based on workload and location.",
                category="status_change",
                complaint_id=complaint.id
            )

            # Notify citizen
            create_notification(
                user_id=complaint.user_id,
                title="Complaint Assigned",
                message=f"Your complaint #{complaint.id} has been assigned to Officer {best_officer.name}.",
                category="status_change",
                complaint_id=complaint.id
            )

            return True

    except Exception as e:
        print(f"[AUTO-ASSIGN ERROR] Failed to run auto-assignment: {e}")
        db.session.rollback()

    return False
