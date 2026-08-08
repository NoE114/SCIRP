from datetime import datetime
from app.extensions import db


class SlaConfig(db.Model):
    __tablename__ = "sla_configs"

    priority = db.Column(db.String(50), primary_key=True)
    duration_hours = db.Column(db.Integer, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "priority": self.priority,
            "duration_hours": self.duration_hours,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


def seed_sla_configs():
    from app.extensions import db
    from app.models.sla_config import SlaConfig

    default_configs = [
        {"priority": "low", "duration_hours": 168},       # 7 days
        {"priority": "medium", "duration_hours": 120},    # 5 days
        {"priority": "high", "duration_hours": 72},       # 3 days
        {"priority": "urgent", "duration_hours": 24},     # 24 hours
    ]

    for config in default_configs:
        if not db.session.query(SlaConfig).filter_by(priority=config["priority"]).first():
            db.session.add(SlaConfig(
                priority=config["priority"],
                duration_hours=config["duration_hours"]
            ))
    db.session.commit()
