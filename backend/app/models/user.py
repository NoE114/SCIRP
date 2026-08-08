import enum
from datetime import datetime
from app.extensions import db
from werkzeug.security import generate_password_hash, check_password_hash


class UserRole(str, enum.Enum):
    CITIZEN = "citizen"
    OFFICER = "officer"
    DEPT_HEAD = "dept_head"
    ADMIN = "admin"


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    phone = db.Column(db.String(20))
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.Enum(UserRole), default=UserRole.CITIZEN, nullable=False)
    department_id = db.Column(db.Integer, db.ForeignKey("departments.id"), nullable=True)
    ward_id = db.Column(db.Integer, db.ForeignKey("wards.id"), nullable=True)
    zone_id = db.Column(db.Integer, db.ForeignKey("zones.id"), nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    email_notifications = db.Column(db.Boolean, default=True, server_default="1", nullable=False)
    id_proof_filename = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    ward = db.relationship("Ward", foreign_keys=[ward_id], backref=db.backref("users", lazy=True))
    zone = db.relationship("Zone", foreign_keys=[zone_id], backref=db.backref("users", lazy=True))

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "phone": self.phone,
            "role": self.role.value,
            "department_id": self.department_id,
            "department_name": self.department.name if self.department else None,
            "ward_id": self.ward_id,
            "ward_name": self.ward.name if self.ward else None,
            "zone_id": self.zone_id,
            "zone_name": self.zone.name if self.zone else None,
            "is_active": self.is_active,
            "email_notifications": self.email_notifications,
            "id_proof_url": f"/api/auth/users/{self.id}/id-proof" if self.id_proof_filename else None,
            "created_at": self.created_at.isoformat(),
        }


def seed_users():
    from app.extensions import db
    from app.models.user import User, UserRole
    from app.models.department import Department
    from app.models.ward import Ward
    from app.models.zone import Zone

    # Get departments to map officers
    road_dept = db.session.query(Department).filter_by(name="Road").first()
    water_dept = db.session.query(Department).filter_by(name="Water").first()

    # Get wards/zones for assignment
    ward_1 = db.session.query(Ward).filter_by(name="Ward 1 (Airport Area)").first()
    ward_3 = db.session.query(Ward).filter_by(name="Ward 3 (Colaba)").first()
    zone_a = db.session.query(Zone).filter_by(name="Zone A (North)").first()
    zone_b = db.session.query(Zone).filter_by(name="Zone B (South)").first()

    demo_users = [
        {
            "name": "System Admin",
            "email": "admin@civicpulse.com",
            "password": "adminpass123",
            "role": UserRole.ADMIN,
            "department_id": None,
            "ward_id": None,
            "zone_id": None,
        },
        {
            "name": "Ashish Jain",
            "email": "ashish@civicpulse.com",
            "password": "citizenpass123",
            "role": UserRole.CITIZEN,
            "department_id": None,
            "ward_id": None,
            "zone_id": None,
        },
        {
            "name": "Officer John",
            "email": "john@civicpulse.com",
            "password": "officerpass123",
            "role": UserRole.OFFICER,
            "department_id": road_dept.id if road_dept else None,
            "ward_id": ward_1.id if ward_1 else None,
            "zone_id": zone_a.id if zone_a else None,
        },
        {
            "name": "Officer Sarah",
            "email": "sarah@civicpulse.com",
            "password": "officerpass123",
            "role": UserRole.OFFICER,
            "department_id": water_dept.id if water_dept else None,
            "ward_id": ward_3.id if ward_3 else None,
            "zone_id": zone_b.id if zone_b else None,
        },
        {
            "name": "Head of Road Dept",
            "email": "depthead@civicpulse.com",
            "password": "deptpass123",
            "role": UserRole.DEPT_HEAD,
            "department_id": road_dept.id if road_dept else None,
            "ward_id": None,
            "zone_id": None,
        }
    ]

    for u_data in demo_users:
        if not db.session.query(User).filter_by(email=u_data["email"]).first():
            user = User(
                name=u_data["name"],
                email=u_data["email"],
                role=u_data["role"],
                department_id=u_data["department_id"],
                ward_id=u_data["ward_id"],
                zone_id=u_data["zone_id"],
            )
            user.set_password(u_data["password"])
            db.session.add(user)
    
    db.session.commit()