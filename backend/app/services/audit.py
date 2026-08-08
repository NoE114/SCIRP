import json
from datetime import datetime
from app.extensions import db
from app.models.audit_log import AuditLog
from app.models.user import User


def log_audit_event(user_id, action, entity_type, entity_id=None, old_value=None, new_value=None, metadata=None):
    """
    Utility helper to write an entry to the Audit Log database table.
    Can be safely called anywhere in backend controller/service logic.
    """
    try:
        actor_name = "System"
        actor_role = "system"

        if user_id:
            user = db.session.get(User, user_id)
            if user:
                actor_name = user.name
                actor_role = user.role.value

        metadata_str = None
        if metadata:
            metadata_str = json.dumps(metadata)

        log_entry = AuditLog(
            timestamp=datetime.utcnow(),
            user_id=user_id,
            actor_name=actor_name,
            actor_role=actor_role,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            old_value=str(old_value) if old_value is not None else None,
            new_value=str(new_value) if new_value is not None else None,
            metadata_json=metadata_str
        )
        db.session.add(log_entry)
        db.session.commit()
    except Exception as e:
        # Prevent database logging failure from crashing critical user flows
        print(f"[AUDIT LOG ERROR] Failed to write audit event: {e}")
        db.session.rollback()
