from datetime import datetime, timedelta
from app.extensions import db
from app.models.complaint import Complaint, ComplaintStatus
from app.models.user import User, UserRole
from app.models.sla_config import SlaConfig
from app.services.audit import log_audit_event
from app.routes.notifications import create_notification


def calculate_sla_deadline(complaint):
    """
    Calculate and save the SLA deadline for a complaint based on its priority.
    """
    try:
        priority_str = complaint.priority.value if hasattr(complaint.priority, 'value') else str(complaint.priority)
        config = db.session.get(SlaConfig, priority_str)
        
        # Fallback defaults if config is missing
        default_hours = {
            "low": 168,       # 7 days
            "medium": 120,    # 5 days
            "high": 72,       # 3 days
            "urgent": 24      # 1 day
        }
        hours = config.duration_hours if config else default_hours.get(priority_str, 120)

        base_time = complaint.created_at or datetime.utcnow()
        complaint.sla_deadline = base_time + timedelta(hours=hours)
        db.session.commit()
        return True
    except Exception as e:
        print(f"[SLA ERROR] Failed to calculate SLA deadline: {e}")
        db.session.rollback()
    return False


def run_sla_escalations():
    """
    Scans all unresolved complaints, checks for SLA breaches,
    and escalates them along the chain: Officer -> Dept Head -> Admin.
    """
    try:
        now = datetime.utcnow()
        # Query unresolved complaints that have breached their SLA
        breached_complaints = Complaint.query.filter(
            Complaint.status.notin_([ComplaintStatus.RESOLVED, ComplaintStatus.CLOSED]),
            Complaint.sla_deadline.isnot(None),
            Complaint.sla_deadline < now,
            Complaint.is_spam.is_(False)
        ).all()

        escalated_count = 0
        for c in breached_complaints:
            old_level = c.escalation_level

            if old_level == 0:
                # Escalate to Department Head (Level 1)
                c.escalation_level = 1
                db.session.commit()
                escalated_count += 1

                # Audit Log
                log_audit_event(
                    user_id=None,
                    action="sla_escalate",
                    entity_type="complaint",
                    entity_id=c.id,
                    old_value="0 (Officer)",
                    new_value="1 (Dept Head)",
                    metadata={"reason": "SLA deadline breached", "deadline": c.sla_deadline.isoformat()}
                )

                # Notifications
                # Notify citizen
                create_notification(
                    user_id=c.user_id,
                    title="SLA Escalated",
                    message=f"Your complaint #{c.id} has breached its resolution deadline and is escalated to the Department Head.",
                    category="status_change",
                    complaint_id=c.id
                )

                # Notify Assigned Officer (if any)
                if c.officer_id:
                    create_notification(
                        user_id=c.officer_id,
                        title="Breach Warning: SLA Escalated",
                        message=f"Task #{c.id} has breached its deadline and has been escalated to your Department Head.",
                        category="status_change",
                        complaint_id=c.id
                    )

                # Notify Department Heads of that department
                if c.department_id:
                    heads = User.query.filter_by(
                        role=UserRole.DEPT_HEAD,
                        department_id=c.department_id,
                        is_active=True
                    ).all()
                    for head in heads:
                        create_notification(
                            user_id=head.id,
                            title="SLA Escalation Alert",
                            message=f"Complaint #{c.id} (Dept: {c.department.name if c.department else 'N/A'}) has breached its SLA and is escalated to you.",
                            category="status_change",
                            complaint_id=c.id
                        )

            elif old_level == 1:
                # Escalate to Admin (Level 2)
                c.escalation_level = 2
                db.session.commit()
                escalated_count += 1

                # Audit Log
                log_audit_event(
                    user_id=None,
                    action="sla_escalate",
                    entity_type="complaint",
                    entity_id=c.id,
                    old_value="1 (Dept Head)",
                    new_value="2 (Admin)",
                    metadata={"reason": "Secondary SLA breach under Dept Head review", "deadline": c.sla_deadline.isoformat()}
                )

                # Notifications
                # Notify citizen
                create_notification(
                    user_id=c.user_id,
                    title="Critical SLA Escalation",
                    message=f"Your complaint #{c.id} remains unresolved and is now escalated to the Chief Administrator.",
                    category="status_change",
                    complaint_id=c.id
                )

                # Notify Department Heads
                if c.department_id:
                    heads = User.query.filter_by(
                        role=UserRole.DEPT_HEAD,
                        department_id=c.department_id,
                        is_active=True
                    ).all()
                    for head in heads:
                        create_notification(
                            user_id=head.id,
                            title="Critical Breach: Escalated to Admin",
                            message=f"Complaint #{c.id} under your review has been escalated to the Chief Admin.",
                            category="status_change",
                            complaint_id=c.id
                        )

                # Notify Admins
                admins = User.query.filter_by(role=UserRole.ADMIN, is_active=True).all()
                for admin in admins:
                    create_notification(
                        user_id=admin.id,
                        title="Critical SLA Breach Alert",
                        message=f"Complaint #{c.id} has breached its secondary SLA threshold and is escalated to Admin.",
                        category="status_change",
                        complaint_id=c.id
                    )

        return escalated_count

    except Exception as e:
        print(f"[SLA ESCALATION ERROR] Failed to run escalations: {e}")
        db.session.rollback()
    return 0
