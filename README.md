# CivicPulse - Smart Civic Issue Reporting & Resolution Platform

CivicPulse is a full-stack, state-of-the-art civic complaint redressal and geo-routing platform. It connects citizens directly with municipal departments through automated geolocation mapping, workload-balanced officer auto-assignments, multi-level SLA escalations, and interactive analytical visualization dashboards.

---

## Major Upgrade Features

1. **Geographic Localization & Mapping**: Integrated Mumbai-based Wards and Zones centroids. Auto-determines the closest Ward/Zone for any reported complaint via Haversine distance calculations.
2. **Duplicate Clustering**: Detects active complaints within 50m of the same category and dynamically groups them into duplicates clusters. Resolving a cluster leader automatically cascades and resolves all sibling duplicate tickets.
3. **Automatic Officer Assignment**: Dynamically dispatches new complaints to the active officer inside the complaint's Ward and Department who has the lowest active ticket workload.
4. **SLA & Escalation Engine**: Automated resolution deadlines based on ticket priority configurations (low, medium, high, urgent). Tracks and escalates overdue tickets across hierarchies (Officer &rarr; Department Head &rarr; Admin).
5. **Interactive Civic Map**: View all complaints plotted on an interactive Leaflet map, filterable by status, priority, ward, and department, with a toggleable heatmap density layer.
6. **Public Tracker**: Allows any anonymous user to lookup ticket status history and timeline logs using a unique, padded tracking ID (e.g., `CMP-MUM-2026-000001`) with strict privacy filters.
7. **Department Head Portal**: A dedicated supervisor panel for monitoring workloads, routing tasks, and reviewing escalated complaints.
8. **Operations Analytics**: Rich charting dashboards showing SLA compliance rates, satisfaction ratings, citizen feedback, ward distributions, and staff workloads.
9. **Interactive AI intake helpers**: Real-time heuristic AI suggestions for category, priority, and recommendations during complaint filing.
10. **Secure ID Verification & Cascades**: Secure ID proof upload for citizen registration with admin-only document previews, and secure account deactivation/cascading deletion actions.

---

## Seed Accounts and Credentials

| Role | Email | Password | Scope / Ward / Zone |
| :--- | :--- | :--- | :--- |
| **System Admin** | `admin@civicpulse.com` | `adminpass123` | Global System Access |
| **Department Head** | `depthead@civicpulse.com` | `deptpass123` | Road Department |
| **Officer (Roads)** | `officer1@civicpulse.com` | `officerpass123` | Road / Ward 1 |
| **Officer (Water)** | `officer2@civicpulse.com` | `officerpass123` | Water / Ward 2 |
| **Citizen** | `citizen@civicpulse.com` | `citizenpass123` | Ward 1 (Airport Area) |

---

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+

### 1. Backend Setup
1. Navigate to `backend/`
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv .venv
   # Windows:
   .venv\Scripts\activate
   # Linux/macOS:
   source .venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Copy `.env.example` to `.env` and configure credentials:
   ```bash
   cp .env.example .env
   ```
5. Start the backend:
   ```bash
   flask run
   ```
   *The database is automatically created and seeded with zones, wards, departments, SLA rules, and default accounts upon first start.*

### 2. Frontend Setup
1. Navigate to `frontend/`
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   *Open `http://localhost:5173` to access the platform. Use the **Demo Accounts Portal** at the bottom of the sign-in page to quickly test any role.*
