# SupportMitra

IT Infrastructure Support Portal for Indian SMBs and SAP Shops.

Customers pay a flat fee to open a support ticket; a vetted freelance engineer resolves the issue remotely.

---

## Quick Start (Docker — recommended for beginners)

**Prerequisites:** [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.

```bash
# 1. Copy the environment template and fill in your values
cp .env.example .env

# 2. Build and start every service (Django, React, PostgreSQL, Redis)
docker compose up --build

# 3. In a new terminal — run database migrations (first time only)
docker compose exec backend python manage.py migrate

# 4. Create your admin login
docker compose exec backend python manage.py createsuperuser
```

| Service | URL |
|---|---|
| React frontend | http://localhost:5173 |
| Django API | http://localhost:8000/api/ |
| Django Admin | http://localhost:8000/django-admin/ |

---

## Manual Start (without Docker)

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
pip install -r requirements-dev.txt
python manage.py migrate
python manage.py runserver
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## Running Tests

```bash
# Django tests (run from the backend/ directory)
cd backend
pytest tests/ -v

# Frontend lint check
cd frontend
npm run lint
```

---

## Project Layout

```
SupportMitra/
├── backend/          Django REST API
├── frontend/         React + Vite + Tailwind
├── .env.example      Template — copy to .env and fill in secrets
├── docker-compose.yml         Local development
└── docker-compose.prod.yml    Production overrides
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS |
| Backend | Django 4.2, Django REST Framework |
| Auth | JWT (SimpleJWT) |
| Database | PostgreSQL 15 |
| Cache / Queue | Redis + Celery |
| Payments | Razorpay |
| Notifications | SendGrid (email), Gupshup (WhatsApp) |

---

## Environment Variables

All configuration lives in `.env`. See `.env.example` for every variable with explanations.

**Never commit `.env` to git.**
