# SCIRP - Civic Complaint Redressal System

A full-stack civic complaint platform where citizens report issues (potholes, garbage, broken streetlights, etc.), officers track and resolve them, and admins manage the system.

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- MySQL 8.0+ (or MariaDB 10.6+)

### 1. Clone and Set Up the Repository

```bash
git clone https://github.com/NoE114/SCIRP
cd SCIRP
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate  # Linux/macOS
# .venv\Scripts\activate    # Windows

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your MySQL credentials

# Run migrations and start server
flask run
```

The backend API will be available at `http://localhost:5000`.

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173`.

### 4. Testing the MySQL Connection

```bash
# With the backend running:
curl http://localhost:5000/api/health
# Expected: {"status": "ok", "message": "SCIRP backend is running"}

curl http://localhost:5000/api/test-db
# Expected: {"status": "success", "message": "Read/write to MySQL works", ...}
```

## Project Structure

```
SCIRP/
├── backend/
│   ├── app.py              # Entry point
│   ├── config.py           # Configuration (dev/prod)
│   ├── requirements.txt
│   ├── .env.example        # Environment template
│   ├── app/
│   │   ├── __init__.py     # App factory
│   │   ├── extensions.py   # Shared extensions (db)
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   └── user.py
│   │   └── routes/
│   │       ├── __init__.py
│   │       └── test.py
│   └── uploads/            # Image uploads
├── frontend/
│   ├── vite.config.js
│   ├── tailwind.config.cjs
│   ├── package.json
│   └── src/
│       ├── App.jsx
│       ├── main.jsx
│       └── pages/
└── README.md
```

## Configuration

### Backend (.env)

| Variable        | Description                        | Default                                   |
|-----------------|------------------------------------|-------------------------------------------|
| `FLASK_APP`     | Flask app module                   | `app.py`                                  |
| `FLASK_ENV`     | Environment                        | `development`                             |
| `SECRET_KEY`    | Session/JWT signing key            | `dev-secret-key-change-me`                |
| `DATABASE_URL`  | SQLAlchemy database URL            | `mysql+pymysql://user:pass@localhost:3306/scirp` |

### Frontend (.env)

| Variable         | Description                | Default     |
|------------------|----------------------------|-------------|
| `VITE_API_BASE`  | Backend API base path      | `/api`      |

## Development

### Starting MariaDB (local binary, no root required)

```bash
# If using a local MariaDB binary
mariadbd-safe --datadir=./mysql-data --socket=./mysql-data/mysql.sock --port=3306 &
```

### Running Tests

```bash
# Backend
cd backend && python -m pytest tests/

# Frontend
cd frontend && npm run test
```

### Production Deployment

```bash
# Backend (gunicorn)
cd backend
gunicorn -w 4 -b 0.0.0.0:5000 app:app

# Frontend (build)
cd frontend
npm run build
# Serve dist/ with any static server
```

## License

MIT
