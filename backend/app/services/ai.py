import math

from app.extensions import db
from app.models.complaint import Complaint, ComplaintPriority
from datetime import datetime, timedelta

# Keyword sets for urgency detection
URGENCY_KEYWORDS = {
    "urgent", "emergency", "immediate", "critical", "dangerous",
    "flooding", "flood", "gas leak", "power outage", "down line",
    "accident", "collision", "blocked", "hazard", "unsafe",
    "sewer", "contamination", "outage", "broken", "danger",
}

# Category-based priority weights (0-10)
CATEGORY_PRIORITY = {
    "gas_leak": 10,
    "power_outage": 9,
    "flooding": 9,
    "sewer": 8,
    "traffic_light": 8,
    "pothole": 5,
    "streetlight": 4,
    "garbage": 3,
    "water_leak": 6,
    "drainage": 5,
    "other": 2,
}

# Search radius in meters for duplicate detection
DUPLICATE_RADIUS_METERS = 500
DUPLICATE_TIME_WINDOW_DAYS = 7


def haversine_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two coordinates in meters."""
    R = 6371000  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def detect_duplicates(latitude, longitude, category, description, title, current_id=None):
    """
    Find similar complaints in nearby locations within the time window.
    Returns a list of potential duplicate complaint dicts.
    """
    time_threshold = datetime.utcnow() - timedelta(days=DUPLICATE_TIME_WINDOW_DAYS)

    query = (
        db.session.query(Complaint)
        .filter(
            Complaint.created_at >= time_threshold,
            Complaint.is_spam.is_(False),
        )
        .filter(Complaint.latitude.isnot(None))
    )

    if current_id:
        query = query.filter(Complaint.id != current_id)

    candidates = query.all()

    duplicates = []
    desc_lower = (description or "").lower()
    title_lower = (title or "").lower()
    keywords = set(desc_lower.split() + title_lower.split())

    for c in candidates:
        distance = haversine_distance(
            float(latitude), float(longitude),
            float(c.latitude), float(c.longitude),
        )
        if distance > DUPLICATE_RADIUS_METERS:
            continue

        # Category match is a strong signal
        category_match = c.category == category

        # Text overlap: at least 2 keyword matches in description or title
        c_text = f"{c.title or ''} {c.description or ''}".lower().split()
        c_keywords = set(c_text)
        overlap = len(keywords & c_keywords)

        # A complaint is a potential duplicate if:
        # - Same category AND within radius AND (text overlap >= 2 OR distance < 100m)
        # - OR distance < 50m (very close = likely same issue)
        if category_match and (overlap >= 2 or distance < 100):
            duplicates.append({
                "id": c.id,
                "title": c.title,
                "distance_m": round(distance, 1),
                "created_at": c.created_at.isoformat(),
                "category": c.category,
                "status": c.status.value,
                "text_overlap": overlap,
            })

    return duplicates


def predict_priority(category, description, title, latitude=None, longitude=None):
    """
    Predict complaint priority using heuristic rules.
    Returns a ComplaintPriority enum value.
    """
    text = f"{title or ''} {description or ''}".lower()

    # Start with category base score
    score = CATEGORY_PRIORITY.get(category, 2)

    # Boost for urgency keywords
    for keyword in URGENCY_KEYWORDS:
        if keyword in text:
            score += 3

    # Check for multiple urgency keywords (escalation)
    urgency_hits = sum(1 for kw in URGENCY_KEYWORDS if kw in text)
    if urgency_hits >= 2:
        score += 2

    # Boost for nearby duplicates (cluster effect)
    if latitude is not None and longitude is not None:
        duplicates = detect_duplicates(
            latitude, longitude, category, description, title
        )
        if len(duplicates) >= 3:
            score += 4
        elif len(duplicates) >= 1:
            score += 2

    # Map score to priority
    if score >= 9:
        return ComplaintPriority.URGENT
    elif score >= 6:
        return ComplaintPriority.HIGH
    elif score >= 4:
        return ComplaintPriority.MEDIUM
    else:
        return ComplaintPriority.LOW
