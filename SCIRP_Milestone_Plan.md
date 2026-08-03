# SCIRP Development Plan — Milestone-Based

No fixed calendar dates. Each milestone has a clear goal, deliverables, and an **exit criteria checklist**. Move to the next milestone only when the current one's exit criteria are met. This keeps progress honest and demo-ready at every stage.

---

## M0 — Foundation Setup
**Goal:** A working skeleton that runs end-to-end with no real features yet.

**Deliverables**
- GitHub repo initialized with `frontend/` and `backend/` folder structure
- Flask app boots (`app.py`, `config.py`, blueprint structure in `app/routes/`)
- React app boots with Tailwind + React Router configured
- MySQL database created and connected via SQLAlchemy
- `.env` / config separation for dev vs prod

**Exit Criteria**
- [x] `flask run` starts backend with no errors
- [x] `npm run dev` starts frontend with no errors
- [x] Backend can read/write a test row to MySQL
- [x] Repo has a README with setup instructions
**Status:** ✅ COMPLETE — Aug 3, 2026

---

## M1 — Authentication & Roles
**Goal:** Citizens, Officers, and Admins can register, log in, and be told apart.

**Deliverables**
- `POST /register`, `POST /login`, `GET /profile`
- JWT issuing + middleware to protect routes
- Role field on User model (citizen / officer / admin)
- Forgot password flow
- React auth pages (Login, Register) + protected route wrapper

**Exit Criteria**
- [x] All three roles can register and log in
- [x] JWT correctly blocks access to role-restricted routes
- [x] Frontend redirects unauthenticated users to login
- [x] Passwords are hashed (never stored plain)
**Status:** ✅ COMPLETE — Aug 3, 2026

---

## M2 — Complaint Submission Core
**Goal:** A citizen can file a complaint with photo + location.

**Deliverables**
- Complaint model (title, description, category, image, lat/long, priority, status, timestamps)
- `POST /complaints`, `GET /complaints`, `GET /complaints/{id}`
- Image upload handling (local `uploads/` folder for now)
- Leaflet map picker for location on the "Report Issue" page
- "My Complaints" list view for citizens

**Exit Criteria**
- [ ] Citizen can submit a complaint with image + pinned location
- [ ] Complaint appears immediately in "My Complaints"
- [ ] Uploaded images render correctly on complaint detail page

---

## M3 — Complaint Tracking & Status Workflow
**Goal:** Every complaint has a visible, auditable lifecycle.

**Deliverables**
- Status enum enforced: Submitted → Verified → Assigned → In Progress → Resolved → Closed
- Complaint Logs table (every status change recorded with officer_id + remarks)
- Timeline UI component on Complaint Details page
- `PUT /complaints/{id}` for status/field updates

**Exit Criteria**
- [ ] Status can only move through valid transitions (no skipping/backwards without reason)
- [ ] Every status change produces a log entry
- [ ] Citizen sees a readable timeline, not just a status label

---

## M4 — Officer / Department Dashboard
**Goal:** Officers can manage the complaints assigned to their department.

**Deliverables**
- Department model + seed data (Road, Water, Electricity, Sanitation)
- `GET /department/complaints`, `PUT /complaints/status`, `POST /upload-proof`
- Officer dashboard UI: Pending / In Progress / Completed / Urgent views
- Proof-of-resolution image upload

**Exit Criteria**
- [ ] Officer only sees complaints for their own department
- [ ] Officer can accept, update, and close a complaint with proof image
- [ ] Urgent/high-priority complaints are visually flagged

---

## M5 — Admin Dashboard & Management
**Goal:** Admin has full oversight and control of the system.

**Deliverables**
- `GET /dashboard`, `POST /department`, `POST /officer`
- Admin UI: manage users, manage officers, manage departments, assign/reassign complaints, remove spam
- Spam/duplicate flagging mechanism (manual, pre-AI)

**Exit Criteria**
- [ ] Admin can create a department and assign an officer to it
- [ ] Admin can reassign a complaint between departments
- [ ] Admin can deactivate a spam complaint or user

---

## M6 — Analytics Dashboard
**Goal:** Data tells a story: where issues happen, how fast they're resolved.

**Deliverables**
- `GET /analytics` aggregation endpoint(s)
- Chart.js visuals: monthly complaints, department-wise breakdown, resolution rate, average resolution time
- Leaflet heatmap of complaint density

**Exit Criteria**
- [ ] Charts reflect real data (not mock/static)
- [ ] Heatmap correctly plots complaint coordinates
- [ ] Dashboard loads in a reasonable time with realistic sample data volume

---

## M7 — Notifications & Citizen Feedback
**Goal:** Citizens stay informed and can rate outcomes.

**Deliverables**
- Email notification on status change (SMTP or a free-tier email API)
- In-app notification indicator
- Feedback model + `POST` endpoint (star rating + comment) triggered after "Resolved"

**Exit Criteria**
- [ ] Citizen receives an email/in-app alert when their complaint's status changes
- [ ] Citizen can rate and comment once a complaint is resolved
- [ ] Feedback is visible to admin/officer for that complaint

---

## M8 — AI Enhancements
**Goal:** The features that make this stand out from a plain CRUD app.

Pick these up **one at a time**, in order of impact vs. effort — don't block on all four before demoing progress.

**Deliverables**
1. **Automatic Category Detection** — image → predicted category (Pothole/Garbage/Streetlight/etc.)
2. **Duplicate Complaint Detection** — nearby existing complaint → "join instead of create new" prompt
3. **Priority Prediction** — location/context-based priority scoring
4. **Chat Assistant** — conversational complaint creation + FAQ + status lookup

**Exit Criteria (per feature, mark independently)**
- [ ] Category detection returns a sensible label on real uploaded images
- [ ] Duplicate detection correctly surfaces at least nearby test cases within a defined radius
- [ ] Priority prediction produces different priorities for genuinely different inputs
- [ ] Chat assistant can create a complaint and answer a basic FAQ end-to-end

---

## M9 — Hardening, Testing & Demo Readiness
**Goal:** The system survives a live demo and a code review.

**Deliverables**
- Manual QA pass across all three roles' full flows
- Fix known bugs, edge cases (empty states, failed uploads, invalid JWT)
- Basic performance check (dashboard/analytics load time)
- Seed script with realistic demo data
- Prepared demo script + slide/README summary

**Exit Criteria**
- [ ] A cold run-through of Citizen → Officer → Admin flow works without errors
- [ ] No console errors on core pages
- [ ] Demo data tells a coherent story (varied categories, statuses, locations)
- [ ] README documents setup, architecture, and AI features clearly

---

## How to Use This Plan
- Treat each milestone as a **branch or checkpoint** — don't start the next until the current one's checklist is fully checked.
- If a milestone stalls, it's a signal to descope (e.g., skip SMS notifications, defer 2 of the 4 AI features) rather than let it block everything downstream.
- M8 (AI) is intentionally modular — even shipping just "Automatic Category Detection" well is a strong differentiator if time runs short.
