from datetime import datetime
from app.extensions import db


class Ward(db.Model):
    __tablename__ = "wards"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    zone_id = db.Column(db.Integer, db.ForeignKey("zones.id"), nullable=False)
    latitude = db.Column(db.Numeric(10, 8), nullable=False)
    longitude = db.Column(db.Numeric(11, 8), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    zone = db.relationship("Zone", backref=db.backref("wards", lazy=True))

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "zone_id": self.zone_id,
            "zone_name": self.zone.name if self.zone else None,
            "latitude": float(self.latitude),
            "longitude": float(self.longitude),
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


def seed_wards():
    from app.extensions import db
    from app.models.zone import Zone
    from app.models.ward import Ward

    zone_a = db.session.query(Zone).filter_by(name="Zone A (North)").first()
    zone_b = db.session.query(Zone).filter_by(name="Zone B (South)").first()
    zone_c = db.session.query(Zone).filter_by(name="Zone C (East)").first()
    zone_d = db.session.query(Zone).filter_by(name="Zone D (West)").first()

    default_wards = [
        # Zone A
        {"name": "Ward 1 (Airport Area)", "zone_id": zone_a.id if zone_a else 1, "latitude": 19.0896, "longitude": 72.8656},
        {"name": "Ward 2 (Santacruz)", "zone_id": zone_a.id if zone_a else 1, "latitude": 19.0843, "longitude": 72.8360},
        # Zone B
        {"name": "Ward 3 (Colaba)", "zone_id": zone_b.id if zone_b else 2, "latitude": 18.9067, "longitude": 72.8147},
        {"name": "Ward 4 (Marine Drive)", "zone_id": zone_b.id if zone_b else 2, "latitude": 18.9438, "longitude": 72.8236},
        # Zone C
        {"name": "Ward 5 (Chembur)", "zone_id": zone_c.id if zone_c else 3, "latitude": 19.0622, "longitude": 72.8974},
        {"name": "Ward 6 (Ghatkopar)", "zone_id": zone_c.id if zone_c else 3, "latitude": 19.0863, "longitude": 72.9090},
        # Zone D
        {"name": "Ward 7 (Bandra)", "zone_id": zone_d.id if zone_d else 4, "latitude": 19.0596, "longitude": 72.8295},
        {"name": "Ward 8 (Juhu)", "zone_id": zone_d.id if zone_d else 4, "latitude": 19.1025, "longitude": 72.8270},
    ]

    for w in default_wards:
        if not db.session.query(Ward).filter_by(name=w["name"]).first():
            db.session.add(Ward(
                name=w["name"],
                zone_id=w["zone_id"],
                latitude=w["latitude"],
                longitude=w["longitude"]
            ))
    db.session.commit()
