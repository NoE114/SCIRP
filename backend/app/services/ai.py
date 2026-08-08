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


def classify_complaint_text(title, description):
    """
    Perform heuristic AI analysis on a complaint title and description to suggest
    category, issue type, department, priority, and generate a short summary.
    """
    text = f"{title or ''} {description or ''}".lower()

    # Default values
    category = "other"
    issue_type = "General Inquiry"
    department = "Road"  # Default fallback
    priority = "medium"

    # Category matching
    if any(k in text for k in ["pothole", "road", "street", "asphalt", "tar", "crack", "path"]):
        category = "Road"
        department = "Road"
        issue_type = "Pothole / Road Damage"
    elif any(k in text for k in ["leak", "pipe", "burst", "water supply", "faucet", "valve", "hydrant"]):
        category = "Water"
        department = "Water"
        issue_type = "Pipe Leakage"
    elif any(k in text for k in ["drain", "sewer", "gutter", "clog", "blocked", "overflow", "stink", "smell"]):
        category = "Water"
        department = "Water"
        issue_type = "Drainage / Sewer Blockage"
    elif any(k in text for k in ["streetlight", "lamp", "dark", "electricity", "power", "wire", "shock", "electric"]):
        category = "Electricity"
        department = "Electricity"
        issue_type = "Streetlight / Electrical Failure"
    elif any(k in text for k in ["garbage", "trash", "waste", "dumpster", "refuse", "litter", "bin", "cleanup"]):
        category = "Sanitation"
        department = "Sanitation"
        issue_type = "Garbage Accumulation"

    # Priority determination
    priority_score = 0
    if any(k in text for k in ["urgent", "emergency", "immediate", "critical", "danger", "hazard", "risk", "injure", "accident"]):
        priority_score += 4
    if any(k in text for k in ["block", "obstruct", "cannot pass", "closed", "shut", "stop", "leak"]):
        priority_score += 2
    if len(text.split()) > 30:  # Longer descriptions imply complex/severe issues
        priority_score += 1

    if priority_score >= 5:
        priority = "urgent"
    elif priority_score >= 3:
        priority = "high"
    elif priority_score >= 1:
        priority = "medium"
    else:
        priority = "low"

    # Summary generator
    short_desc = description.strip() if description else ""
    if len(short_desc) > 80:
        summary_sentence = short_desc[:80] + "..."
    else:
        summary_sentence = short_desc or "No description provided."

    return {
        "category": category,
        "issue_type": issue_type,
        "department": department,
        "priority": priority,
        "summary": f"{title}: {summary_sentence}"
    }


def generate_complaint_summary(complaint):
    """
    Generate an AI summary, main issue, suggested action, and keywords for a complaint.
    Returns a dictionary to be displayed on ComplaintDetail for officers.
    """
    category = complaint.category or "other"
    desc = complaint.description or ""
    title = complaint.title or ""

    # Keywords extraction (simple frequency of non-stopwords)
    stopwords = {"the", "a", "an", "and", "or", "but", "is", "are", "was", "were", "in", "on", "at", "to", "for", "with", "of", "about"}
    words = [w.strip(".,!?()\"'") for w in (title + " " + desc).lower().split()]
    keywords = sorted(list(set([w for w in words if w and w not in stopwords and len(w) > 3])))[:6]

    # Heuristic suggested actions
    actions = {
        "Road": "Schedule a road maintenance crew to inspect the asphalt, patch any potholes/cracks, and restore surface safety.",
        "Water": "Dispatch a pipeline repair technician to isolate the leak location, close the supply valve if necessary, and replace the broken pipe section.",
        "Electricity": "Dispatch an electrician to inspect transformer connections, replace dead streetlight bulbs, or secure loose high-voltage cables.",
        "Sanitation": "Arrange for a sanitation crew/garbage collection vehicle to clear the accumulated refuse and clean the surrounding area.",
        "other": "Schedule an inspector from the municipal grievance redressing cell to perform a site visit and recommend corrective measures."
    }
    suggested_action = actions.get(category, actions["other"])

    # Main issue sentence
    main_issue = f"Reported {category.lower()} issue: '{title}'"

    return {
        "summary": desc[:150] + "..." if len(desc) > 150 else desc,
        "main_issue": main_issue,
        "suggested_action": suggested_action,
        "keywords": keywords
    }
