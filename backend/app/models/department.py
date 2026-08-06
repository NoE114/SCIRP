from datetime import datetime
from app.extensions import db


class Department(db.Model):
    __tablename__ = "departments"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    description = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    users = db.relationship("User", backref="department_obj", lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


def seed_departments():
    from app.extensions import db
    from app.models.department import Department

    default_depts = [
        {"name": "Road", "description": "Roads, potholes, traffic infrastructure"},
        {"name": "Water", "description": "Water supply, leaks, drainage"},
        {"name": "Electricity", "description": "Streetlights, power lines, electrical issues"},
        {"name": "Sanitation", "description": "Garbage collection, waste management"},
    ]
    db.session.bulk_insert_mappings(Department, default_depts)
    db.session.commit()
