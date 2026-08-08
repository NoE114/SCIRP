from datetime import datetime
from app.extensions import db


class Zone(db.Model):
    __tablename__ = "zones"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


def seed_zones():
    from app.extensions import db
    from app.models.zone import Zone

    default_zones = [
        {"name": "Zone A (North)"},
        {"name": "Zone B (South)"},
        {"name": "Zone C (East)"},
        {"name": "Zone D (West)"},
    ]
    for z in default_zones:
        if not db.session.query(Zone).filter_by(name=z["name"]).first():
            db.session.add(Zone(name=z["name"]))
    db.session.commit()
