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
| **Officer (Roads)** | `john@civicpulse.com` | `officerpass123` | Road / Ward 1 |
| **Officer (Water)** | `sarah@civicpulse.com` | `officerpass123` | Water / Ward 2 |
| **Citizen** | `ashish@civicpulse.com` | `citizenpass123` | Ward 1 (Airport Area) |

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

### 3. Password Reset (development)
With no SMTP configured, the reset token is printed to the backend console in `DEBUG` mode only:
1. `POST /api/auth/forgot-password` with `{"email": "..."}` — the token appears in the console log.
2. `POST /api/auth/reset-password` with `{"token": "...", "password": "..."}`. Each token is single-use and expires after 1 hour.

---

## Configuration

The backend selects its config from `APP_ENV` (or `FLASK_ENV`): `development` (default), `testing`, or `production`.

| Variable | Required | Notes |
| :--- | :--- | :--- |
| `APP_ENV` | no | `development` / `testing` / `production` |
| `SECRET_KEY` | **yes (prod)** | Flask session signing key |
| `JWT_SECRET_KEY` | **yes (prod)** | JWT signing key |
| `DATABASE_URL` | **yes (prod)** | e.g. `postgresql://user:pass@host:5432/db` |
| `CORS_ORIGINS` | no | Comma-separated allowed frontend origins (defaults: Render frontend + localhost) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | no | Enable real notification emails; else dev prints to console (DEBUG only) |

Production is **fail-fast**: `create_app()` raises `RuntimeError` at startup if the required secrets/DB URL are missing or still set to the known development defaults.

### Production security posture
- `DEBUG=False`, `SEED_DEMO_USERS=False`, force-secure cookies.
- No `/api/test-db` or dev-only routes registered in production.
- Password-reset tokens are opaque, signed, time-limited, and single-use (stored as SHA-256 hashes). They cannot be used as JWTs.
- Complaint images, proof images, and ID proofs are served only to authorized users (`@jwt_required()` + role/ownership checks).
- Login, register, forgot-password, and reset-password are rate-limited per IP.
- Uploaded files are validated by extension **and** magic bytes.
- JWT roles are re-validated against the DB on every request, so demoted/deactivated users lose access immediately.

---

## Deployment

### Render (recommended)
`render.yaml` defines two services — a Python **API** (`civicpulse-api`) and a static **UI** (`civicpulse-ui`) — plus the root `Procfile`.
1. Push this repo to GitHub and create a **New → Blueprint** app on Render.
2. In the API service, set `DATABASE_URL` manually (PostgreSQL add-on or MariaDB), `SECRET_KEY`, and `JWT_SECRET_KEY` (auto-generated if left blank).
3. Render sets `APP_ENV=production` automatically. No test/dev routes are registered.
4. The UI service builds `frontend/dist` and proxies `/api/*` to the API service. Set `VITE_ENABLE_DEMO_ACCOUNTS=false` so the demo login panel is hidden.

> **Note**: The app uses a single gunicorn worker (see `Procfile`) intentionally — in-memory SSE broadcasts and the rate limiter assume one process. If you scale up, switch the notification streaming and rate limiting to a Redis-backed implementation.

### Self-hosted (nginx)
1. Build the frontend: `cd frontend && npm ci && npm run build`.
2. Run the backend with gunicorn: `cd backend && gunicorn --bind 127.0.0.1:5000 --workers 1 --threads 4 wsgi:app` (set `APP_ENV=production` and secrets).
3. Serve with `nginx.conf.example` (SPA fallback + `/api` reverse proxy + security headers).

---

## Recreating the test suites

The pytest and Vitest suites were recreated outside this repo's history on a divergent branch (`b42a7f9`). When adding tests back here, place Flask tests under `backend/tests/` and frontend component tests under `frontend/src/__tests__/`, and pin dependencies (`requirements-dev.txt`, `devDependencies`).
