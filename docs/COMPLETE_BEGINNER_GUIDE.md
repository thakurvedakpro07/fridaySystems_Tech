# SupportMitra — Complete Beginner's Guide
### Your personal learning manual for understanding the entire project

> **Who this is for:** Someone who is new to full-stack development, Docker, Django, and React.
> Every technical word is explained. Every "why" is answered. Start from the beginning, read in order.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Folder Structure](#2-folder-structure)
3. [File-by-File Explanation](#3-file-by-file-explanation)
4. [Docker — The Engine That Runs Everything](#4-docker--the-engine-that-runs-everything)
5. [Django — The Backend Brain](#5-django--the-backend-brain)
6. [React + Vite — The Frontend Face](#6-react--vite--the-frontend-face)
7. [PostgreSQL — The Database](#7-postgresql--the-database)
8. [Redis + Celery — Background Work](#8-redis--celery--background-work)
9. [Daily Development Workflow](#9-daily-development-workflow)
10. [Complete Debugging Guide](#10-complete-debugging-guide)
11. [Complete Request Flow](#11-complete-request-flow)
12. [Security Explained](#12-security-explained)
13. [Git + GitHub Explained](#13-git--github-explained)
14. [Important Code Explained Line-by-Line](#14-important-code-explained-line-by-line)
15. [Learning Roadmap](#15-learning-roadmap)
17. [Authentication Architecture Deep Dive](#17-authentication-architecture-deep-dive)
18. [Production Engineering — Stability & Safety](#18-production-engineering--stability--safety)
19. [QA, Testing & Bug-Fix Workflow](#19-qa-testing--bug-fix-workflow)
20. [Project Status & Roadmap](#20-project-status--roadmap)
16. [Glossary + Command Cheat Sheet](#16-glossary--command-cheat-sheet)

---

## 1. Project Overview

### What is SupportMitra?

**Simple explanation:**
SupportMitra is an IT support marketplace for Indian small businesses. When a company's computer or server has a problem, they come to SupportMitra, pay a consulting fee, raise a support ticket, and a vetted IT freelancer fixes their problem remotely.

Think of it like Swiggy — but instead of delivering food, it delivers IT support. The "restaurant" is a freelance IT engineer, the "customer" is an Indian SMB (small-medium business), and the "food" is a fixed server or configured laptop.

**Who uses it:**
- **Customers** — Indian SMBs (companies with 10–500 employees) who need IT help
- **Freelancers** — Skilled IT engineers who resolve tickets and earn money
- **Admins** — You (the platform operator) who manages everything

**What the platform does:**
1. Customer registers and opens a support ticket
2. Customer pays a consulting fee via Razorpay (India's payment gateway)
3. Admin assigns the ticket to a vetted freelancer
4. Freelancer resolves the issue remotely
5. Customer rates the service (CSAT score)
6. Freelancer gets paid via bank transfer or UPI

**Current project status (Phase 8 complete):**
The core MVP is built and tested. All three user roles work end-to-end. 73 automated tests pass. Stability score: **8.15 / 10 — Ready for Controlled Beta Launch.** See [Section 20](#20-project-status--roadmap) for the full roadmap.

---

### Overall Architecture

**Simple explanation:**
Your project has multiple "parts" that talk to each other. Think of it like a restaurant:
- The **menu/waiter** = React frontend (what the customer sees)
- The **kitchen** = Django backend (where the work happens)
- The **pantry** = PostgreSQL database (where data is stored)
- The **delivery system** = Celery/Redis (background tasks like sending emails)
- The **building** = Docker (keeps everything in one place)

**Technical architecture diagram:**

```
┌─────────────────────────────────────────────────────────────┐
│                     YOUR COMPUTER                           │
│                                                             │
│  Browser (Chrome/Firefox)                                   │
│       │                                                     │
│       │  http://localhost:5173                              │
│       ▼                                                     │
│  ┌─────────────────┐                                        │
│  │  FRONTEND       │  React + Vite                          │
│  │  (port 5173)    │  Shows the website UI                  │
│  └────────┬────────┘                                        │
│           │  /api/* requests (via Vite proxy)               │
│           ▼                                                  │
│  ┌─────────────────┐                                        │
│  │  BACKEND        │  Django + Gunicorn                     │
│  │  (port 8000)    │  Processes business logic              │
│  └────────┬────────┘                                        │
│           │                                                  │
│     ┌─────┼──────────────────┐                             │
│     ▼     ▼                  ▼                             │
│  ┌──────┐ ┌───────┐ ┌──────────────┐                      │
│  │  DB  │ │ Redis │ │   Celery     │                      │
│  │ 5432 │ │  6379 │ │  (worker +   │                      │
│  │      │ │       │ │   beat)      │                      │
│  └──────┘ └───────┘ └──────────────┘                      │
│  Postgres   Cache    Background tasks                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
           All 6 services run inside Docker containers
```

---

### How the Frontend Talks to the Backend

**Simple explanation:**
The React website can't talk to Django directly from your browser (they're different programs). So React sends HTTP requests to a URL starting with `/api/`. Vite (the development tool) automatically forwards these requests to Django running on port 8000.

**Flow:**
```
User clicks "Submit Ticket" button
         │
         ▼
React makes a POST request to /api/tickets/
         │
         ▼
Vite dev server sees /api/ and forwards it to http://backend:8000/api/tickets/
         │
         ▼
Django receives the request, validates the data, saves to PostgreSQL
         │
         ▼
Django sends back a JSON response { "id": "...", "status": "pending_payment" }
         │
         ▼
React receives the response and updates what the user sees
```

---

## 2. Folder Structure

Here is every important folder and what it contains:

```
fridaySystems_Tech/              ← Your project root
│
├── backend/                     ← ALL Django (Python) code lives here
│   ├── supportmitra/            ← Django project config (settings, URLs, Celery)
│   ├── support_app/             ← Your actual app (models, views, APIs)
│   │   ├── migrations/          ← Database change history
│   │   ├── services/            ← Business logic layer
│   │   ├── integrations/        ← Third-party connections (Razorpay, etc.)
│   │   └── tests/               ← Automated test files
│   ├── tests/                   ← More test files
│   ├── requirements.txt         ← Python packages list
│   ├── .env                     ← SECRET values (never commit this)
│   └── manage.py                ← Django command-line tool
│
├── frontend/                    ← ALL React (JavaScript) code lives here
│   ├── src/                     ← Your actual source code
│   │   ├── api/                 ← Functions that call the Django API
│   │   ├── components/          ← Reusable UI pieces
│   │   ├── hooks/               ← Reusable logic pieces
│   │   ├── pages/               ← Full page components
│   │   └── store/               ← Global state (auth, etc.)
│   ├── package.json             ← JavaScript packages list
│   └── vite.config.js           ← Vite development server config
│
├── docs/                        ← All project documentation
├── prompts/                     ← Claude AI session prompts
│
├── docker-compose.yml           ← Defines all 6 Docker services
├── Dockerfile.backend           ← Recipe to build the backend container
├── Dockerfile.frontend          ← Recipe to build the frontend container
├── .dockerignore                ← Files NOT to copy into Docker
├── .gitignore                   ← Files NOT to commit to GitHub
└── .env.example                 ← Template for creating your .env file
```

### Folder-by-Folder Deep Dive

---

**`backend/`**

*Simple:* All your Python/Django code. This is the "brain" of the app.

*Technical:* Contains the Django project structure. When you run `python manage.py runserver` or `gunicorn`, this is what gets executed.

*What breaks if deleted:* Everything. No backend = no API = no data = broken app.

*Interacts with:* `docker-compose.yml` (mounts this folder into the container), `Dockerfile.backend` (copies this into the image).

---

**`backend/supportmitra/`**

*Simple:* Django's main configuration folder. Named after your project.

*Technical:* Contains `settings.py`, `urls.py`, `wsgi.py`, `asgi.py`, and `celery.py`. This is the "headquarters" folder that Django reads first on startup.

*Common mistake:* Beginners think this is where all code goes. It's only config. Your actual app code is in `support_app/`.

---

**`backend/support_app/`**

*Simple:* Your actual application. All the models, views, APIs, and business logic.

*Technical:* A Django "app" — a self-contained module. `INSTALLED_APPS` in settings.py registers it. Could theoretically be reused in another Django project.

*What breaks if deleted:* All database tables disappear, all API endpoints break, Celery tasks stop.

---

**`backend/support_app/migrations/`**

*Simple:* A diary of every change ever made to the database structure. Like a version history for your database.

*Technical:* Each file is a numbered Python script that Django runs in order to create/alter database tables. Running `python manage.py migrate` executes these files.

*What breaks if deleted:* Django cannot create or update the database. You would have to re-run `makemigrations` to recreate them.

*Never manually edit these files unless you know exactly what you're doing.*

---

**`backend/support_app/services/`**

*Simple:* The "business logic" layer. Code that does the actual work (e.g., create a Razorpay payment order, send an email) lives here.

*Technical:* Separates concerns — views handle HTTP, services handle business rules. This makes code testable without a running web server.

*Currently implemented:*
| Service file | What it does |
|---|---|
| `ticket_service.py` | `create_ticket`, `assign_ticket`, `unassign_ticket`, `update_status`, `add_comment` — all wrapped in `transaction.atomic()` |
| `notification_service.py` | Creates `Notification` records when status changes, assignments, or comments happen |

All operations use Django's `transaction.atomic()` so if a step fails midway, the entire operation rolls back — no partial data ever lands in the database.

---

**`frontend/`**

*Simple:* All your React/JavaScript code. This is what the user sees in the browser.

*Technical:* A Vite-powered React application. `npm run dev` starts the development server; `npm run build` creates a production-ready bundle.

*What breaks if deleted:* Users have no UI. The backend still works but nobody can use it.

---

**`frontend/node_modules/`**

*Simple:* Thousands of JavaScript helper packages that your code depends on. Downloaded automatically by `npm install`.

*Technical:* Never committed to Git (in `.gitignore`). Never copied into Docker (in `.dockerignore`). The Docker image runs `npm install` itself inside the container.

*Common mistake:* Editing files inside `node_modules`. They will be overwritten next time you run `npm install`.

---

**`backend/staticfiles/`**

*Simple:* The collected CSS, JavaScript, and images that Django's admin panel needs to look good.

*Technical:* Created when you run `python manage.py collectstatic`. Django gathers static files from all installed apps and copies them here. WhiteNoise then serves them from this folder.

*Not committed to Git* (in `.gitignore`) because it's always rebuilt on container startup.

---

## 3. File-by-File Explanation

### Backend Files

---

**`backend/manage.py`**

*Simple:* A command-line remote control for your Django project. You use it to run migrations, create superusers, start the dev server, etc.

*Technical:* A Python script Django generates automatically. It sets `DJANGO_SETTINGS_MODULE` and calls `django.core.management.execute_from_command_line()`.

*Common commands:*
```bash
python manage.py migrate          # apply database changes
python manage.py makemigrations   # detect model changes and create migration
python manage.py createsuperuser  # create admin account
python manage.py shell            # open interactive Python with Django loaded
python manage.py collectstatic    # gather static files
```

*In Docker:*
```bash
docker compose exec backend python manage.py migrate
```

---

**`backend/supportmitra/settings.py`**

*Simple:* The master configuration file for your entire Django project. Every important setting lives here.

*Technical:* A Python module loaded at Django startup. Settings are accessed via `from django.conf import settings`.

*Key sections:*

```python
SECRET_KEY        # like a password for cryptography — keep secret
DEBUG             # True = development mode (detailed errors), False = production
ALLOWED_HOSTS     # which hostnames Django will respond to
INSTALLED_APPS    # list of all enabled Django modules
MIDDLEWARE        # chain of functions that process every request/response
DATABASES         # PostgreSQL connection info (read from DATABASE_URL env var)
STATIC_URL        # URL prefix for static files (/static/)
STATIC_ROOT       # folder where collectstatic puts files
CELERY_*          # all Celery configuration
```

*What breaks if misconfigured:*
- Wrong `DATABASES` → database connection error
- Missing app in `INSTALLED_APPS` → features silently missing
- Wrong `ALLOWED_HOSTS` → Django returns 400 Bad Request

---

**`backend/supportmitra/urls.py`**

*Simple:* The "directory" of your website. Maps URLs to the code that handles them.

*Technical:* The root URL configuration. Django reads this file when deciding which view to call for an incoming request.

```python
urlpatterns = [
    path("admin/", admin.site.urls),      # → Django admin panel
    path("api/", include("support_app.urls")),  # → All your API endpoints
    path("metrics/", prometheus_exports...),    # → Monitoring data
]
```

*Chain:* `supportmitra/urls.py` → `support_app/urls.py` → specific view function

---

**`backend/supportmitra/wsgi.py`**

*Simple:* A plug that connects Django to the web server (Gunicorn).

*Technical:* WSGI = Web Server Gateway Interface. It's the standard Python interface between web servers and web applications. Gunicorn calls this file's `application` object to handle every HTTP request.

*Analogy:* Think of it as an electrical adapter — Django is the device, Gunicorn is the power socket, WSGI is the adapter that makes them compatible.

---

**`backend/supportmitra/celery.py`**

*Simple:* Sets up the background task system (Celery) for your Django project.

*Technical:*
```python
app = Celery("supportmitra")               # create a Celery application
app.config_from_object("django.conf:settings", namespace="CELERY")  # read settings
app.autodiscover_tasks()                   # find all tasks.py files automatically
```

*Why it exists:* Without this file, Celery has no idea your Django project exists and can't find your tasks.

---

**`backend/support_app/models.py`**

*Simple:* Defines the shape of your database. Every class = one database table. Every attribute = one column.

*Technical:* Django ORM models. Django reads these classes and generates SQL `CREATE TABLE` statements (stored in migrations).

*Your 14 models:*
| Model | What it stores |
|-------|---------------|
| `Customer` | SMB company accounts |
| `Freelancer` | IT engineer profiles |
| `Ticket` | Support requests |
| `TicketComment` | Messages on tickets (public or internal) |
| `TicketAttachment` | Files uploaded to tickets |
| `TicketAssignment` | History of every freelancer assignment to a ticket |
| `TicketActivityLog` | Immutable audit trail: every action on every ticket |
| `Notification` | In-app notifications for status changes, assignments, comments |
| `Payment` | Transaction records |
| `Subscription` | Monthly plan records |
| `SLAPolicy` | Response time rules |
| `SLALog` | SLA event records |
| `CSATSurvey` | Customer ratings (1–5) after resolution |
| `AuditLog` | Security audit trail |

*Example model explained:*
```python
class Ticket(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # ↑ UUID = universally unique identifier (looks like: a3f7-c2e1-...)
    # primary_key = this is the unique ID for each row
    # default=uuid.uuid4 = auto-generate a new UUID
    # editable=False = user can't manually set this

    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, ...)
    # ↑ ForeignKey = "this ticket belongs to one customer"
    # on_delete=PROTECT = if you try to delete a customer with tickets, Django refuses

    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default="pending_payment")
    # ↑ CharField = text field
    # choices = only these values are allowed
    # default = new tickets start as "pending_payment"
```

---

**`backend/support_app/views.py`**

*Simple:* The "switchboard operators" — functions that receive web requests, do work, and send back responses.

*Technical:* Django REST Framework (DRF) views. Each view class or function handles a specific URL and HTTP method (GET, POST, PUT, DELETE).

*Key views in your project:*
```
health_check              →  GET /api/health/     → returns {"status":"ok"}
RegisterView              →  POST /api/auth/register/
CustomTokenObtainPairView →  POST /api/auth/login/  (returns access + refresh token + user info)
logout_view               →  POST /api/auth/logout/
CustomerMeView            →  GET/PUT /api/customers/me/
TicketListCreateView      →  GET /api/tickets/       (list) or POST (create)
TicketDetailView          →  GET/PUT /api/tickets/{id}/
AdminTicketListView       →  GET /api/admin/tickets/
```

---

**`backend/support_app/serializers.py`**

*Simple:* Translators between Python objects and JSON. They also validate incoming data.

*Technical:* DRF serializers convert Python model instances → JSON (for sending to frontend) and JSON → Python objects (for saving to database).

*Analogy:* A serializer is like a form. It defines what fields are required, what types they must be, and what can/can't be sent back.

*Example:*
```
User submits: {"title": "Server down", "service_type": "linux", "severity": "high"}
Serializer:   validates all fields exist and have correct types
              creates a Ticket object
              saves to database
              returns the full ticket JSON (including auto-generated ID and ticket_number)
```

---

**`backend/support_app/admin.py`**

*Simple:* Configures the Django admin panel. Controls what you see at `http://127.0.0.1:8000/admin/`.

*Technical:* Registers models with `admin.site.register()`. Defines `list_display`, `search_fields`, `list_filter` to make the admin useful.

*What breaks if removed:* The admin panel becomes empty — models still exist in the database but you can't manage them through the browser UI.

---

**`backend/support_app/apps.py`**

*Simple:* The "ID card" of your Django app. Also the place where Django connects signal handlers.

*Technical:*
```python
class SupportAppConfig(AppConfig):
    def ready(self):
        import support_app.signals   # load signals when the app starts
```

*Why signals need to be imported here:* Django's signal system uses Python's import mechanism. If `signals.py` is never imported, the `@receiver` decorators never run, so the ticket number auto-generator is never connected.

---

**`backend/support_app/signals.py`**

*Simple:* Automatic reactions to database events. "When X happens, automatically do Y."

*Technical:* Django signals. `pre_save` fires before a model is saved to the database. `post_save` fires after.

*Your signal:*
```python
@receiver(pre_save, sender=Ticket)
def auto_generate_ticket_number(sender, instance, **kwargs):
    if not instance.ticket_number:
        short = str(instance.id).replace("-", "")[-8:].upper()
        instance.ticket_number = f"TKT-{short}"
```
*What this does:* Before every Ticket save, if the ticket has no number yet, generate one like `TKT-A3F7C2E1`.

*Why 8 characters (not 5):* With 5 hex characters there are ~1 million unique values. At MVP scale that's fine, but the "birthday paradox" means collisions become likely after ~1,000 tickets. With 8 characters (~4 billion values) collisions become negligible even at large scale. This was extended in Phase 7 as a proactive improvement.

*The signal also tracks activity:* A second pre_save signal (`log_ticket_changes`) runs before every Ticket save and records what changed (old status → new status, who made the change) into `TicketActivityLog`. This creates a permanent, tamper-proof history of every action on every ticket.

---

**`backend/support_app/tasks.py`**

*Simple:* Jobs that run in the background — not while the user waits for a response.

*Technical:* Celery tasks decorated with `@shared_task`. Callers use `.delay()` to queue them.

*Your 5 tasks (currently stubs):*
| Task | When it runs |
|------|-------------|
| `send_ticket_opened_email` | After ticket is created |
| `send_ticket_assigned_notification` | After freelancer is assigned |
| `check_sla_breaches` | Every 5 minutes (Celery Beat) |
| `process_payout_batch` | Every Monday (Celery Beat) |
| `sync_ticket_to_osticket` | After ticket is created |

---

**`backend/requirements.txt`**

*Simple:* A shopping list of Python packages your project needs. Like a recipe ingredient list.

*Technical:* `pip install -r requirements.txt` reads this file and installs every package listed.

*Key packages:*
| Package | Purpose |
|---------|---------|
| `Django==4.2.13` | The web framework |
| `djangorestframework` | Makes building APIs easy |
| `gunicorn` | Production web server |
| `whitenoise` | Serves static files from Gunicorn |
| `psycopg2-binary` | PostgreSQL driver (lets Python talk to Postgres) |
| `celery` | Background task system |
| `redis` | Python client for Redis server |
| `dj-database-url` | Reads DATABASE_URL env var |
| `razorpay` | India payment gateway SDK |
| `django-allauth` | Google/GitHub OAuth login |

---

**`backend/.env`**

*Simple:* A file of secret values that your app needs but must never be shared. Like a PIN code.

*Technical:* Environment variables loaded by `python-dotenv`. Each line is `KEY=VALUE`.

*Your .env file contains:*
```
SECRET_KEY=django-insecure-...     # Django's cryptographic key
DEBUG=1                             # 1=development mode, 0=production
ALLOWED_HOSTS=localhost,...         # which domains Django accepts
DATABASE_URL=postgres://...         # how to connect to PostgreSQL
REDIS_URL=redis://redis:6379/0      # how to connect to Redis
```

*CRITICAL RULES:*
- Never commit `.env` to Git (it's in `.gitignore`)
- Never share this file publicly
- The `.env.example` file is a safe template you CAN commit

---

### Frontend Files

---

**`frontend/package.json`**

*Simple:* The JavaScript equivalent of `requirements.txt`. Lists all JavaScript packages and project scripts.

*Technical:*
```json
{
  "scripts": {
    "dev": "vite",           // start development server
    "build": "vite build",   // create production files
    "preview": "vite preview" // preview production build locally
  },
  "dependencies": {
    "react": "^18.2.0",     // React itself
    "axios": "^1.6.7",      // HTTP client for API calls
    "zustand": "^4.5.2",    // state management
    "react-router-dom": "..."  // URL routing in the browser
  }
}
```

---

**`frontend/vite.config.js`**

*Simple:* Configuration for the Vite development server — especially the proxy that forwards API calls to Django.

*Technical:*
```javascript
proxy: {
  "/api": {
    target: process.env.VITE_API_TARGET ?? "http://localhost:8000",
    changeOrigin: true,
  }
}
```

*Why this matters:* Without this proxy, your browser would try to call `/api/tickets/` on port 5173 (frontend), which doesn't exist. The proxy intercepts these and sends them to Django on port 8000.

*In Docker:* `VITE_API_TARGET=http://backend:8000` (uses Docker service name, not localhost)
*Outside Docker:* Falls back to `http://localhost:8000`

---

**`frontend/src/main.jsx`**

*Simple:* The very first file React runs. It connects React to the HTML page.

*Technical:*
```javascript
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
```
This finds the `<div id="root">` in `index.html` and mounts the entire React app inside it.

---

**`frontend/src/App.jsx`**

*Simple:* The "map" of your website. Tells React which page to show for which URL.

*Technical:* React Router configuration. Defines all routes and their access controls.

*Route guards explained:*
```javascript
function PrivateRoute({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? children : <Navigate to="/login" />;
  // If logged in: show the page
  // If not logged in: redirect to /login
}

function AdminRoute({ children }) {
  const user = useAuthStore((s) => s.user);
  return user?.is_staff ? children : <Navigate to="/dashboard" />;
  // If user is admin (is_staff=true): show the page
  // Otherwise: redirect to dashboard
}
```

*All routes:*
| URL | Component | Access |
|-----|-----------|--------|
| `/` | Landing | Public |
| `/login` | Login | Public |
| `/register` | Register | Public |
| `/dashboard` | Dashboard | Must be logged in |
| `/tickets/new` | NewTicket | Must be logged in |
| `/tickets/:id` | TicketDetailPage | Must be logged in |
| `/admin` | AdminDashboard | Must be admin |
| `/admin/freelancers` | FreelancerList | Must be admin |

---

**`frontend/src/api/client.js`**

*Simple:* A pre-configured HTTP messenger that your frontend uses to talk to Django. It automatically adds your login token to every request.

*Technical:* An Axios instance with request and response interceptors.

*How it works step by step:*

1. **Request interceptor** — Before every API call:
   ```
   Gets the access_token from localStorage
   Adds "Authorization: Bearer <token>" header
   Sends the request to Django
   ```

2. **Response interceptor** — If Django says 401 (Unauthorized):
   ```
   Gets the refresh_token from localStorage
   Asks Django for a new access_token
   Saves the new token
   Retries the original request automatically
   If refresh also fails → clears tokens → redirects to /login
   ```

*Why this is clever:* You never have to manually add authentication headers to any API call. The client does it automatically for every request.

---

**`frontend/src/store/authStore.js`**

*Simple:* A shared "memory box" that remembers whether the user is logged in, and who they are.

*Technical:* A Zustand store. Any React component can read from or write to this store without passing props.

*State it holds:*
```javascript
isAuthenticated: true/false     // is there a valid token?
user: { id, email, is_staff }   // who is logged in?
loading: true/false              // is an auth operation in progress?
initializing: true/false         // is the app still checking if user is logged in?
```

*`initializeAuth()` — why it matters:*
When you refresh the browser page, React starts fresh. The user's JWT token is in `localStorage` but `user` (the object with email and is_staff) is lost. `initializeAuth()` is called once on app startup to re-fetch the user's profile from Django and restore the `user` object. Without this, the admin sidebar would break every time you refreshed the page.

---

### Docker Files

---

**`Dockerfile.backend`**

*Simple:* A recipe that tells Docker exactly how to build the backend container — install Python, copy code, install packages.

*Technical:* A set of instructions Docker executes layer-by-layer to create a container image.

```dockerfile
FROM python:3.11-slim
# ↑ Start from an official Python image (like a pre-installed OS)

ENV PYTHONDONTWRITEBYTECODE=1
# ↑ Don't create .pyc files (saves space, not needed in containers)

ENV PYTHONUNBUFFERED=1
# ↑ Print logs immediately (not buffered) — important for seeing logs in real-time

ENV DJANGO_SETTINGS_MODULE=supportmitra.settings
# ↑ Tell every Python process (gunicorn, celery, manage.py) which settings to load

WORKDIR /app
# ↑ All following commands run inside the /app directory

RUN apt-get install -y libpq-dev gcc
# ↑ Install system packages needed to compile psycopg2 (PostgreSQL driver)

COPY backend/requirements.txt .
RUN pip install -r requirements.txt
# ↑ Install Python packages (cached layer — only re-runs if requirements.txt changes)

COPY backend/ .
# ↑ Copy all your backend code into /app

CMD ["gunicorn", "supportmitra.wsgi:application", "--bind", "0.0.0.0:8000", "--reload"]
# ↑ Default command: start Gunicorn web server, listen on ALL network interfaces (0.0.0.0)
```

*Why `0.0.0.0` not `127.0.0.1`:*
`127.0.0.1` = "only talk to yourself" (loopback). Inside a Docker container, this means ONLY the container itself can connect — not Docker's network, not your host machine. `0.0.0.0` = "accept connections from everywhere." Docker's port mapping only works when the app listens on `0.0.0.0`.

---

**`Dockerfile.frontend`**

*Simple:* Recipe to build the frontend container — install Node.js, copy code, install packages, start Vite.

*Technical:* Builds a Node.js container running the Vite dev server.

---

**`.dockerignore`**

*Simple:* Tells Docker which files NOT to copy when building images. Like a blacklist.

*Technical:* Without this, Docker would copy `node_modules` (hundreds of MB of dependencies) and `.venv` (Python virtualenv) into the build context — massively slowing down builds.

*What it excludes and why:*
| Excluded | Reason |
|----------|--------|
| `backend/.venv/` | Python virtualenv built for your OS; Docker installs its own inside the container |
| `frontend/node_modules/` | Node packages for your OS; Docker runs `npm install` inside container |
| `backend/staticfiles/` | Generated by collectstatic; created fresh inside the container |
| `.git/` | Git history not needed inside containers |
| `backend/db.sqlite3` | Local SQLite backup; containers use PostgreSQL |

---

**`docker-compose.yml`**

*Simple:* The master plan that defines all 6 services, how they connect, and what ports they use.

*Technical:* A YAML file that Docker Compose reads to start all containers simultaneously with the right settings.

*Full breakdown:*

```yaml
services:

  db:                              # PostgreSQL container
    image: postgres:15-alpine      # use official PostgreSQL image
    environment:                   # database credentials
      POSTGRES_USER: supportmitra
      POSTGRES_PASSWORD: supportmitra
      POSTGRES_DB: supportmitra
    volumes:
      - postgres_data:/var/lib/postgresql/data  # persist data between restarts
    ports:
      - "5432:5432"               # expose port so DB tools can connect
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U supportmitra"]
      # ↑ Docker checks if PostgreSQL is ready before starting the backend

  redis:                           # Redis container
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]

  backend:                         # Django + Gunicorn container
    build: { context: ., dockerfile: Dockerfile.backend }
    env_file: - backend/.env      # load SECRET_KEY, DATABASE_URL, etc.
    ports:
      - "8000:8000"               # host:container port mapping
    volumes:
      - ./backend:/app            # live code mounting for hot reload
    depends_on:
      db: { condition: service_healthy }
      redis: { condition: service_healthy }
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; ..."]
    command: sh -c "python manage.py collectstatic --noinput && python manage.py migrate && gunicorn ..."

  celery:                          # Background task worker
    # same image as backend
    command: celery -A supportmitra worker --loglevel=info

  celerybeat:                      # Scheduler (runs tasks on a timer)
    command: celery -A supportmitra beat --loglevel=info ...

  frontend:                        # React + Vite container
    ports:
      - "5173:5173"
    volumes:
      - ./frontend/src:/app/src   # live code mounting for HMR
    depends_on:
      backend: { condition: service_healthy }  # wait for Django to be ready
```

---

**`.gitignore`**

*Simple:* Tells Git which files to NEVER track or commit. Protects secrets and avoids committing huge generated files.

*Key entries and why:*
| Ignored | Reason |
|---------|--------|
| `backend/.env` | Contains SECRET_KEY and database passwords |
| `backend/staticfiles/` | Generated on every startup, not source code |
| `frontend/node_modules/` | 200MB+ of packages, not your code |
| `backend/.venv/` | Local Python virtualenv, not needed in Git |
| `backend/db.sqlite3` | Local development database backup |
| `*.pyc` | Compiled Python bytecode, auto-generated |

---

## 4. Docker — The Engine That Runs Everything

### What is Docker?

**Simple explanation:**
Imagine you're cooking a recipe. If you follow the recipe on your home kitchen stove, the dish comes out perfectly. But if your friend tries the same recipe on their stove, something might be different — different gas pressure, different pan, different altitude. The dish might taste different.

Docker solves this problem for software. A Docker container is like a sealed, portable kitchen with exactly the right stove, exact same gas pressure, exact same pans — so the recipe (your code) always runs exactly the same way, on any computer.

**Technical explanation:**
Docker is a containerisation platform. It packages an application and all its dependencies (specific Python version, specific Linux libraries, specific config) into a single "container." This container can run on any machine that has Docker installed, and it will behave identically every time.

---

### Key Docker Concepts

**Image vs Container:**
- **Image** = a recipe / a blueprint / a template. It's static — like a saved game file.
- **Container** = a running instance of an image. Like actually playing the game.
- You can run 10 containers from one image, just like 10 people can read the same recipe.

**Volume:**
- A connection between a folder on your real computer and a folder inside a container.
- Without volumes, all data inside a container disappears when it stops.
- Your PostgreSQL data is in a volume (`postgres_data`) — so your database survives restarts.
- Your backend code is also mounted as a volume (`./backend:/app`) — so when you edit a `.py` file, the change immediately appears inside the container without rebuilding.

**Port mapping:**
- Containers have their own internal network. They can't automatically be reached from your browser.
- Port mapping opens a "door" between your computer and a container.
- `"8000:8000"` means: "connect my computer's port 8000 to the container's port 8000."
- Your browser → port 8000 on your computer → port 8000 inside the Django container.

**Docker Compose:**
- A tool that manages MULTIPLE containers at once.
- Without Compose, you'd have to start each container manually with long commands.
- `docker compose up -d` starts all 6 containers simultaneously.

**Health checks:**
- Docker can automatically test if a container is truly ready (not just started, but actually working).
- The PostgreSQL container has `pg_isready` as its health check.
- The Django container has a Python urllib check.
- `depends_on: condition: service_healthy` means "don't start container B until container A passes its health check."

---

### Your 6 Docker Services

```
┌──────────────────────────────────────────────────────────────┐
│              Docker Compose Network                           │
│                                                               │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│  │  frontend   │    │   backend   │    │     db      │      │
│  │  port 5173  │───▶│  port 8000  │───▶│  port 5432  │      │
│  │  Vite/React │    │Django/Gunic.│    │  PostgreSQL │      │
│  └─────────────┘    └──────┬──────┘    └─────────────┘      │
│                            │                                  │
│                    ┌───────┼───────┐                         │
│                    ▼       ▼       ▼                         │
│  ┌─────────────┐ ┌──────┐ ┌──────────────┐                 │
│  │    redis    │ │celery│ │  celerybeat  │                 │
│  │  port 6379  │ │worker│ │  scheduler   │                 │
│  └─────────────┘ └──────┘ └──────────────┘                 │
│                                                               │
│  All containers talk to each other using service names       │
│  (e.g. "backend" → "redis" → "db") via Docker's DNS         │
└──────────────────────────────────────────────────────────────┘
```

**Service 1: `db` (PostgreSQL)**
- Stores all your application data permanently
- Has a named volume `postgres_data` so data survives container restarts
- Other containers connect using hostname `db` (Docker's internal DNS)

**Service 2: `redis` (Redis)**
- Used by Celery as a task queue ("message broker")
- Used by Django as a cache
- Celery connects using hostname `redis`

**Service 3: `backend` (Django + Gunicorn)**
- Runs three commands on startup: `collectstatic` → `migrate` → `gunicorn`
- Mounted to `./backend:/app` — edit Python files locally, changes appear instantly
- Has a healthcheck so frontend waits until Django is actually serving requests

**Service 4: `celery` (Celery worker)**
- Same image as backend (same code, same Python packages)
- Runs `celery worker` instead of gunicorn
- Watches the Redis queue for tasks and executes them

**Service 5: `celerybeat` (Scheduler)**
- Same image as backend
- Runs `celery beat` — like a cron job system
- Reads the schedule from the database and pushes tasks to Redis queue on time

**Service 6: `frontend` (React + Vite)**
- Serves the React development server
- Mounted to `./frontend/src` and `./frontend/index.html` — edit JSX files, see changes instantly
- Waits for backend healthcheck to pass before starting

---

### Docker Startup Sequence

```
docker compose up -d
        │
        ▼
Docker reads docker-compose.yml
        │
        ├─▶ Starts db and redis first (no dependencies)
        │
        ├─▶ Waits for db to be HEALTHY (pg_isready passes)
        ├─▶ Waits for redis to be HEALTHY (redis-cli ping passes)
        │
        ├─▶ Starts backend
        │         │ runs: collectstatic (copies CSS/JS files)
        │         │ runs: migrate (creates/updates DB tables)
        │         │ runs: gunicorn (starts web server on port 8000)
        │         │ healthcheck passes after ~30-40 seconds
        │
        ├─▶ Starts celery (after db and redis are healthy)
        ├─▶ Starts celerybeat (after celery is ready)
        │
        └─▶ Starts frontend (after backend is healthy)
                  │ runs: vite --host 0.0.0.0 (starts dev server on 5173)
```

---

## 5. Django — The Backend Brain

### What is Django?

**Simple explanation:**
Django is a framework for building websites with Python. A "framework" is like a pre-built skeleton. Instead of building every part of a website from scratch (user login system, database connections, admin panel, security), Django gives you all of that ready-made. You fill in the parts specific to your business (your models, your API endpoints, your business rules).

**Real-world analogy:**
Django is like a franchise restaurant kit. The kit includes the cash register system, the kitchen layout, food safety training, and the menu template. You just add your specific menu items and recipes. You don't have to invent the point-of-sale system from scratch.

---

### The MVT Pattern (Model-View-Template)

Django follows a pattern called MVT (Model-View-Template):

```
Request comes in
      │
      ▼
URL Router (urls.py)
   "Which view handles this URL?"
      │
      ▼
View (views.py)
   "What should happen?"
   "What data do I need?"
      │
      ├──▶ Model (models.py) ──▶ Database
      │    "Get/save data"
      │
      ▼
Response sent back (JSON in your case)
```

In your project, since it's an API (not a website with HTML pages), the "Template" part is replaced by **serializers** that output JSON.

---

### Django REST Framework (DRF)

**Simple explanation:**
Django by itself is great for building websites with HTML pages. But SupportMitra's backend only sends/receives JSON data (the React frontend handles the HTML). DRF is an add-on that makes it easy to build JSON APIs.

**What DRF adds:**
- Serializers (translate Python ↔ JSON)
- Generic views (pre-built GET/POST/PUT/DELETE patterns)
- Permission classes (who can do what)
- Authentication (JWT token support via SimpleJWT)
- Browsable API (visit an endpoint in your browser and see a nice form)

---

### Migrations — How the Database Gets Created

**Simple explanation:**
When you write `customer = models.ForeignKey(...)` in Python, how does PostgreSQL know to create a foreign key? Migrations are the bridge.

1. You write or change a model in `models.py`
2. You run `python manage.py makemigrations` — Django detects the change and creates a migration file
3. You run `python manage.py migrate` — Django reads all migration files and runs them against the database

**Analogy:** Migrations are like a detailed construction plan. `makemigrations` draws the plan. `migrate` builds it.

*Never delete migration files.* They are the historical record of every database change. Deleting them would make it impossible to recreate the database from scratch.

---

### Django Admin Panel

**Simple explanation:**
A free, auto-generated internal dashboard at `http://127.0.0.1:8000/admin/`. You can view, search, add, edit, and delete any data without writing any code.

**How to create your admin account:**
```bash
docker compose exec backend python manage.py createsuperuser
```

**What you can do in admin:**
- View all tickets, customers, freelancers
- Manually assign a freelancer to a ticket
- Change ticket status
- View payment records
- Set up Celery Beat schedules (when to run background tasks)

---

### WhiteNoise — Serving Static Files

**Simple explanation:**
Django's admin panel needs CSS files to look nice. In development mode with `runserver`, Django serves these automatically. With Gunicorn (production server), it doesn't. WhiteNoise is a Python package that adds static file serving directly to Gunicorn.

**How it works:**
1. `collectstatic` copies all CSS/JS files from installed apps into `staticfiles/`
2. WhiteNoise middleware intercepts every request for `/static/*`
3. It reads the file from `staticfiles/` and sends it back
4. Django never even sees these requests

---

## 6. React + Vite — The Frontend Face

### What is React?

**Simple explanation:**
React is a JavaScript library for building user interfaces. Instead of manually updating HTML when data changes, React automatically re-renders only the parts of the page that changed.

**Analogy:** Imagine a spreadsheet (like Excel). When you change a cell, Excel automatically updates all formulas that depend on it. React works the same way — when data (called "state") changes, React automatically updates the parts of the screen that display that data.

---

### Components — The Building Blocks

**Simple explanation:**
A React component is a reusable piece of UI. Like LEGO bricks — you build big structures by combining small pieces.

*Your component hierarchy:*
```
App.jsx
├── ToastContext.jsx          (global toast notification provider — wraps all pages)
├── MainLayout.jsx            (shared page wrapper: Header + main content + Footer)
│   ├── Header.jsx            (navigation bar with NotificationBell)
│   │   └── NotificationBell.jsx  (polls for new notifications every 30s)
│   └── Footer.jsx
└── [various pages — all wrapped by MainLayout]
    ├── Landing.jsx
    ├── Login.jsx
    ├── Register.jsx
    ├── Dashboard.jsx
    │   └── TicketCard.jsx    (repeated for each ticket)
    ├── NewTicket.jsx
    │   └── TicketForm.jsx    (title, service type, severity, priority, description)
    ├── TicketDetailPage.jsx
    │   ├── TicketDetail.jsx  (ticket metadata, status badge, activity timeline)
    │   └── CommentSection.jsx (public + internal comments; Ctrl+Enter to submit)
    ├── AdminDashboard.jsx    (admin-only; full ticket list with filters + search)
    └── FreelancerList.jsx    (admin-only; list of freelancers with assignment)
```

---

### JSX — HTML Inside JavaScript

**Simple explanation:**
React uses a special syntax called JSX that looks like HTML but is actually JavaScript. The browser doesn't understand JSX — Vite converts it to regular JavaScript before the browser sees it.

```jsx
// JSX (what you write)
function Button({ label }) {
  return <button className="btn-primary">{label}</button>;
}

// What it becomes (what the browser sees)
function Button({ label }) {
  return React.createElement("button", { className: "btn-primary" }, label);
}
```

---

### State — The Memory of a Component

**Simple explanation:**
State is data that a component remembers. When state changes, the component re-renders (updates what the user sees).

*Example:*
```jsx
const [tickets, setTickets] = useState([]);
// tickets = the current list (starts empty)
// setTickets = function to update the list

// When the API returns data:
setTickets(data);
// React automatically re-renders and shows the list
```

---

### Hooks — Reusable Logic

**Simple explanation:**
Hooks are functions that let you "hook into" React features. `useState` gives you state. `useEffect` lets you run code when the component loads. Custom hooks (like `useAuth`, `useTickets`) bundle related logic together.

*Your hooks:*
| Hook | What it does |
|------|-------------|
| `useAuth.js` | login, logout, register — calls the API and updates Zustand store |
| `useTickets.js` | fetches ticket list; returns `{ tickets, loading, error }` |
| `useNotifications.js` | polls `/api/notifications/` every 30 seconds; returns unread count |

Custom hooks are the React equivalent of Python service functions — they bundle related API calls and state into one reusable piece of logic that any component can use.

---

### Vite — The Development Tool

**Simple explanation:**
Vite is the tool that:
1. Converts JSX to JavaScript the browser understands
2. Runs a local web server on port 5173
3. Automatically updates the browser when you save a file (Hot Module Replacement / HMR)
4. Forwards `/api/*` requests to Django (the proxy)

**Why Vite instead of old tools like Create React App:**
Vite is much faster. It uses modern browser features to update only the changed module, not the entire page.

---

### Zustand — Global State Management

**Simple explanation:**
When the user logs in, many different components need to know: "Is this user logged in? What is their email? Are they an admin?"

Passing this information as props from parent to child component to grandchild component would be messy ("prop drilling"). Zustand is a shared "memory box" that any component can read from or write to directly.

```
                    authStore (Zustand)
                    { isAuthenticated, user }
                   /        |         \
          Header.jsx   AdminRoute    Dashboard.jsx
         (shows logout) (checks is_staff) (shows tickets)
```

---

## 7. PostgreSQL — The Database

### What is a Database?

**Simple explanation:**
A database is like a set of very organized spreadsheets that live on a server. Each "spreadsheet" is a table. Each row is one record. Each column is one field.

**Why a database instead of a file:**
- Files don't support simultaneous access by multiple users safely
- Databases can handle thousands of requests per second
- Databases can search, filter, and join data efficiently
- Databases are transactional — either all changes succeed or none do

---

### Why PostgreSQL?

**Simple explanation:**
There are many database systems. PostgreSQL was chosen because:
- It's free and open-source
- It's extremely reliable and used by major companies (Instagram, Spotify, Apple)
- It supports JSON fields (useful for `payout_details` in the Freelancer model)
- It handles complex queries well
- Django has excellent PostgreSQL support

---

### Tables in Your Database

From your models, your database has these tables:

```
support_app_customer           ← Customer profiles
support_app_freelancer         ← Freelancer profiles
support_app_ticket             ← Support tickets
support_app_ticketcomment      ← Comments on tickets
support_app_ticketattachment   ← File metadata
support_app_payment            ← Payment records
support_app_subscription       ← Subscription plans
support_app_slapolicy          ← SLA rules
support_app_slalog             ← SLA event log
support_app_csatsurvey         ← Customer ratings
support_app_auditlog           ← Audit trail
auth_user                      ← Django's built-in user table
django_migrations              ← Migration history
django_session                 ← User sessions
... (and more Django internal tables)
```

*Total: 36 tables in your current database.*

---

### Relationships Between Tables

**Simple explanation:**
Tables are connected to each other. A Ticket belongs to a Customer. A Comment belongs to a Ticket. These connections are called "relationships" or "foreign keys."

```
auth_user
    │
    ├──── Customer (one user = one customer profile)
    │         │
    │         └──── Ticket (one customer has many tickets)
    │                   │
    │                   ├──── TicketComment
    │                   ├──── TicketAttachment
    │                   ├──── Payment
    │                   └──── SLALog
    │
    └──── Freelancer (one user = one freelancer profile)
              │
              └──── Ticket (one freelancer assigned to many tickets)
```

---

### Docker Volume — How Data Persists

**Simple explanation:**
Docker containers are temporary. When you stop a container, everything inside disappears — including your database. To prevent this, the database data is stored in a Docker **volume**, which lives on your real computer's hard drive.

```
Your Computer's Hard Drive
   └── Docker Volume: postgres_data
           └── PostgreSQL data files

When container stops:  data stays in the volume
When container starts: data is loaded back from the volume
```

**If you run `docker compose down -v`** (with the `-v` flag), it deletes the volume too. All data is gone. Never do this unless you want to start fresh.

---

## 8. Redis + Celery — Background Work

### What is Redis?

**Simple explanation:**
Redis is like a very fast whiteboard. It can store simple data (text, lists, numbers) and retrieve it instantly. It lives in RAM (memory), not on disk, which makes it 100x faster than a database.

**Why you need it:**
1. **Message broker for Celery** — When Django wants to send an email, it doesn't send it directly (that would make the user wait). Instead, Django writes a task message on Redis's whiteboard. The Celery worker reads the message and does the work.
2. **Cache** — Frequently-read data (like service catalog items) can be stored in Redis so Django doesn't query PostgreSQL every time.
3. **Rate limiting** — DRF uses Redis to count API requests per user.

---

### What is Celery?

**Simple explanation:**
Celery is a background worker system. It watches for task messages on Redis and executes them. This frees up Django to respond to the user quickly, without waiting for slow operations like sending emails.

**Analogy:** Celery is like a kitchen assistant. The chef (Django) writes orders on post-it notes (Redis). The assistant (Celery) picks up notes and executes them — while the chef is already taking the next order.

---

### Celery vs Celery Beat

```
Celery Worker = a worker who sits and waits for tasks
                When a task arrives in Redis, it picks it up and runs it

Celery Beat   = a scheduler / alarm clock
                It reads a schedule from the database
                At the right time, it creates a task and puts it in Redis
                The Celery Worker then picks it up and runs it
```

**Your scheduled tasks:**
| Task | Schedule | Purpose |
|------|----------|---------|
| `check_sla_breaches` | Every 5 minutes | Find tickets that missed their response time target |
| `process_payout_batch` | Every Monday | Prepare freelancer payouts for admin review |

---

### Task Flow Diagram

```
User creates a ticket
         │
         ▼
Django saves ticket to PostgreSQL
         │
         ▼
Django calls:  send_ticket_opened_email.delay(ticket_id)
         │
         ▼
Django puts a message in Redis:
   "TASK: send_ticket_opened_email, args: [ticket_id]"
         │
         ▼
Django immediately responds to user: "Ticket created! ✓"
(user doesn't wait for the email to be sent)
         │
(Meanwhile, in the background...)
         ▼
Celery Worker picks up the Redis message
         │
         ▼
Celery executes send_ticket_opened_email(ticket_id)
         │
         ▼
Email sent to customer ✉
```

---

## 9. Daily Development Workflow

### Starting the Project

```bash
# Step 1: Go to the project folder
cd ~/Documents/fridaySystems_Tech
# This moves your terminal "into" the project directory
# All docker compose commands must be run from here

# Step 2: Start all containers in detached mode (-d means "run in background")
docker compose up -d
# Docker reads docker-compose.yml
# Starts all 6 containers
# Returns control to your terminal immediately (you don't see logs by default)

# Step 3: Verify everything started
docker compose ps
# Shows all containers and their status
# Wait for backend to show "(healthy)" — takes 30-40 seconds
```

---

### Watching Logs

```bash
# See what the backend is doing right now
docker compose logs backend

# Follow live (auto-updates as new logs appear) — Ctrl+C to stop
docker compose logs -f backend

# Follow all services simultaneously
docker compose logs -f

# See only the last 50 lines
docker compose logs backend --tail=50
```

**What to look for in backend logs:**
```
161 static files copied        ← collectstatic ran successfully
No migrations to apply.        ← database is up to date
Listening at: http://0.0.0.0:8000  ← Gunicorn started (this is the key line)
Not Found: /favicon.ico        ← normal, ignore this
```

---

### Stopping the Project

```bash
# Graceful shutdown — containers stop but data is preserved
docker compose down

# Restart a single container (without rebuilding)
docker compose restart backend

# Stop without removing (containers still exist, just stopped)
docker compose stop
```

---

### Rebuilding After Changes

```bash
# When you change requirements.txt, Dockerfile, or package.json:
docker compose down
docker compose up --build -d
# The --build flag forces Docker to rebuild the images from scratch
```

*Why rebuild is needed:* If you add a new Python package to `requirements.txt`, the running container doesn't automatically install it. The Docker image needs to be rebuilt to include the new package.

*You do NOT need to rebuild when:*
- You edit a `.py` file (Gunicorn's `--reload` detects changes automatically)
- You edit a `.jsx` or `.css` file (Vite's HMR handles it)

---

### Running Django Commands

```bash
# Format: docker compose exec <service> <command>

# Create new migration after changing models.py
docker compose exec backend python manage.py makemigrations

# Apply migrations to the database
docker compose exec backend python manage.py migrate

# Create an admin superuser account
docker compose exec backend python manage.py createsuperuser

# Open an interactive Django Python shell
docker compose exec backend python manage.py shell

# Check for configuration issues
docker compose exec backend python manage.py check

# Run tests
docker compose exec backend python -m pytest tests/ -v
```

---

### Making Code Changes Safely

**Backend (Python) changes:**
1. Edit the `.py` file in `backend/`
2. Gunicorn detects the change automatically and restarts
3. Test at `http://127.0.0.1:8000/admin/` or via curl

**Frontend (React) changes:**
1. Edit the `.jsx` or `.css` file in `frontend/src/`
2. Vite HMR updates the browser automatically
3. Test at `http://localhost:5173`

**Model (database) changes:**
1. Edit `models.py`
2. Run `docker compose exec backend python manage.py makemigrations`
3. Run `docker compose exec backend python manage.py migrate`
4. Verify at admin panel

---

### Git Commands — Saving Your Work

```bash
# See what files have changed
git status

# See exactly what changed in each file
git diff

# Stage specific files for commit
git add backend/support_app/views.py
git add frontend/src/pages/Dashboard.jsx

# Stage all changed files (be careful — review git status first)
git add .

# Commit with a meaningful message
git commit -m "Add ticket assignment feature to admin dashboard"

# Push to GitHub
git push origin master

# Pull latest changes (if someone else also worked on it)
git pull origin master
```

---

## 10. Complete Debugging Guide

### Docker Issues

---

**Problem: `permission denied while trying to connect to the Docker daemon`**

*Symptoms:* Any docker command gives this error.

*Root cause:* Your user account is not in the Docker group.

*Diagnosis:*
```bash
groups    # see if "docker" is in the list
```

*Fix (temporary — lasts until logout):*
```bash
newgrp docker
```

*Fix (permanent):*
```bash
sudo usermod -aG docker $USER
# Then log out and log back in
```

---

**Problem: `failed to bind host port 0.0.0.0:6379 — address already in use`**

*Symptoms:* Docker can't start Redis container.

*Root cause:* Ubuntu's system Redis is running and holding port 6379.

*Diagnosis:*
```bash
ss -tlnp | grep 6379                    # what's on port 6379?
systemctl is-active redis-server        # is system Redis running?
```

*Fix:*
```bash
sudo systemctl stop redis-server
sudo systemctl disable redis-server    # prevent auto-start on next reboot
docker compose up -d
```

---

**Problem: `ERR_SOCKET_NOT_CONNECTED` on `127.0.0.1:8000`**

*Symptoms:* Backend container is "Up" but browser shows connection refused.

*Root cause:* Gunicorn is bound to `127.0.0.1` (container loopback) instead of `0.0.0.0`.

*Diagnosis:*
```bash
docker compose logs backend | grep "Listening at"
# Should show: Listening at: http://0.0.0.0:8000
# If it shows:  Listening at: http://127.0.0.1:8000 ← problem!
```

*Root cause (deeper):* The `command:` in `docker-compose.yml` used YAML multi-line syntax (`>`). Lines more indented than the first are preserved with literal newlines, so `--bind 0.0.0.0:8000` became a separate shell command that was ignored.

*Fix:* Ensure the command is a single line in docker-compose.yml.

---

**Problem: Container exits immediately / restart loop**

*Symptoms:* `docker compose ps` shows "Restarting" or "Exited"

*Diagnosis:*
```bash
docker compose logs backend --tail=50    # look for the error message
docker compose logs db --tail=20
```

*Common causes:*
- `backend/.env` file missing or has wrong DATABASE_URL
- Database not ready yet (add depends_on with healthcheck)
- Python import error in your code
- Port already occupied

---

**Problem: `docker compose up --build` is very slow**

*Root cause:* Docker is re-running `pip install` because `requirements.txt` changed or the cache was invalidated.

*Prevention:* The Dockerfile copies `requirements.txt` before copying the rest of the code. This means: if your code changes but `requirements.txt` hasn't changed, Docker uses the cached `pip install` layer and only re-runs the `COPY backend/` step.

---

### Django Issues

---

**Problem: `ModuleNotFoundError` or `ImportError`**

*Symptoms:* Backend container crashes on startup with a Python import error.

*Diagnosis:*
```bash
docker compose logs backend | grep "Error\|Import\|Module"
```

*Fix:* The missing package needs to be added to `requirements.txt`, then rebuild:
```bash
echo "package-name==version" >> backend/requirements.txt
docker compose up --build -d
```

---

**Problem: `django.db.utils.OperationalError: could not connect to server`**

*Symptoms:* Backend logs show PostgreSQL connection error.

*Root cause:* Database URL wrong, or DB container not healthy yet.

*Diagnosis:*
```bash
docker compose ps db                   # is db healthy?
docker compose exec backend python -c "import dj_database_url; print(dj_database_url.config())"
```

*Fix:*
```bash
docker compose restart db
docker compose restart backend
```

---

**Problem: `DisallowedHost` — Invalid HTTP_HOST header**

*Symptoms:* Django returns 400 Bad Request with "DisallowedHost" message.

*Root cause:* The hostname in the HTTP request is not in `ALLOWED_HOSTS`.

*Fix:* Add the hostname to `ALLOWED_HOSTS` in `backend/.env`:
```
ALLOWED_HOSTS=localhost,127.0.0.1,backend,yourdomain.com
```

---

**Problem: Django admin shows no CSS styling**

*Root cause:* Either `collectstatic` wasn't run, or WhiteNoise isn't in MIDDLEWARE.

*Diagnosis:*
```bash
docker compose logs backend | grep "static"
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/static/admin/css/base.css
# Should be 200, not 404
```

*Fix:*
```bash
docker compose exec backend python manage.py collectstatic --noinput
docker compose restart backend
```

---

**Problem: `No migrations to apply` but tables are missing**

*Root cause:* Migrations exist but database was reset without re-migrating.

*Fix:*
```bash
docker compose exec backend python manage.py migrate --run-syncdb
```

---

**Problem: `ProgrammingError: relation does not exist`**

*Root cause:* A migration hasn't been applied.

*Fix:*
```bash
docker compose exec backend python manage.py showmigrations   # see which are unapplied
docker compose exec backend python manage.py migrate
```

---

### React / Frontend Issues

---

**Problem: Frontend blank white page**

*Symptoms:* `localhost:5173` shows nothing.

*Diagnosis:*
```bash
docker compose logs frontend --tail=30       # check for startup errors
# Open browser DevTools → Console tab → look for JavaScript errors
```

*Common causes:*
- JavaScript error in App.jsx or main.jsx
- Failed API call during initialization
- Vite build error

---

**Problem: API calls failing with CORS error**

*Symptoms:* Browser console shows "Access-Control-Allow-Origin" error.

*Root cause:* The frontend URL is not in Django's CORS allowed origins.

*Check:*
```bash
docker compose exec backend python -c "from django.conf import settings; print(settings.CORS_ALLOW_ALL_ORIGINS)"
```

*Fix for development (in settings.py):*
```python
CORS_ALLOW_ALL_ORIGINS = True  # only for DEBUG mode
```

---

**Problem: Frontend shows "Network Error" on API calls**

*Root cause:* The Vite proxy isn't reaching Django.

*Diagnosis:*
```bash
# Check if backend is running and healthy
docker compose ps backend
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/api/health/
# Should be 200
```

---

**Problem: Login works but user is sent back to login after refresh**

*Root cause:* `initializeAuth()` failed — either the token expired or the `/api/customers/me/` endpoint returned an error.

*Diagnosis:*
```bash
# Open browser DevTools → Network tab → look for the "me" request on page load
```

---

### Redis Issues

---

**Problem: `Error 111 connecting to redis:6379`**

*Symptoms:* Celery can't connect to Redis.

*Diagnosis:*
```bash
docker compose ps redis                    # is redis running?
docker compose exec redis redis-cli ping  # should return PONG
```

*Fix:*
```bash
docker compose restart redis
docker compose restart celery celerybeat
```

---

**Problem: Celery tasks not running**

*Diagnosis:*
```bash
docker compose logs celery --tail=30
# Look for "celery@... ready." — if missing, worker crashed
docker compose exec celery celery -A supportmitra inspect ping
```

---

### Troubleshooting Quick-Reference Table

| Symptom | Check first | Likely fix |
|---------|------------|-----------|
| Port already in use | `ss -tlnp \| grep PORT` | Stop the conflicting service |
| Container keeps restarting | `docker compose logs SERVICE` | Fix the error shown in logs |
| Admin no CSS | `curl .../static/admin/css/base.css` | Run collectstatic |
| 401 Unauthorized | Check JWT token in browser storage | Log out and log in again |
| 404 Not Found | Check URL in urls.py | Add missing route |
| 500 Server Error | `docker compose logs backend` | Fix Python exception shown |
| CORS error | Browser console Network tab | Check CORS_ALLOW_ALL_ORIGINS |
| DB connection refused | `docker compose ps db` | Restart db container |

---

## 11. Complete Request Flow

### Scenario: Customer Submits a New Ticket

Let's trace every single step from mouse click to database:

```
Step 1: User is on NewTicket page (http://localhost:5173/tickets/new)
        └── React has rendered the <TicketForm /> component
        └── The form has fields: Title, Service Type, Severity, Description

Step 2: User fills in the form and clicks "Submit"
        └── TicketForm.jsx: handleSubmit() function is called
        └── React collects form data into an object:
            { title: "Server down", service_type: "linux", severity: "high" }

Step 3: TicketForm calls the API function
        └── tickets.js: createTicket(formData)
        └── This calls: apiClient.post("/api/tickets/", formData)

Step 4: Axios client processes the request
        └── Request interceptor runs first
        └── Gets access_token from localStorage
        └── Adds header: "Authorization: Bearer eyJhbGci..."
        └── Sends HTTP POST to /api/tickets/

Step 5: Vite dev server (port 5173) receives the request
        └── URL starts with /api/ → proxy rule matches
        └── Forwards to http://backend:8000/api/tickets/
        └── (Inside Docker, "backend" resolves to the Django container)

Step 6: Gunicorn (inside backend container) receives the request
        └── Passes it to the Django WSGI application

Step 7: Django middleware chain processes the request
        └── PrometheusBeforeMiddleware (records metrics)
        └── SecurityMiddleware (checks HTTPS headers, etc.)
        └── WhiteNoiseMiddleware (is this a /static/ request? No, pass through)
        └── CorsMiddleware (adds CORS headers to response)
        └── CsrfViewMiddleware (checks CSRF token)
        └── AuthenticationMiddleware (reads JWT token, finds the User)
        └── ... (more middleware)

Step 8: Django URL router (urls.py) matches the URL
        └── /api/tickets/ → support_app.urls → TicketListCreateView

Step 9: TicketListCreateView.create() is called
        └── permission_classes check: IsAuthenticated + IsCustomer
        └── User is authenticated (JWT was valid) ✓
        └── User has a customer_profile ✓

Step 10: Serializer validates the incoming data
         └── TicketCreateSerializer receives { title, service_type, severity }
         └── Checks: is title present? (yes)
         └── Checks: is service_type one of the valid choices? (yes, "linux" is valid)
         └── Checks: is severity valid? (yes, "high" is valid)
         └── All valid ✓

Step 11: create() saves the ticket inside transaction.atomic()
         └── The entire step is wrapped in a database transaction
         └── If any part fails (signal, notification), ALL changes roll back
         └── create_ticket() service function is called:
             - Creates the Ticket row
             - Creates the initial TicketActivityLog entry (action="created")
             - Creates a Notification for the customer

Step 12: Signal fires automatically
         └── pre_save signal: auto_generate_ticket_number()
         └── Generates: TKT-A3F7C2E1  (8 hex chars for 4 billion unique values)
         └── Sets instance.ticket_number = "TKT-A3F7C2E1"
         └── Database row is saved with the ticket number

Step 13: (Future) Celery task is queued
         └── send_ticket_opened_email.delay(ticket.id)
         └── Message goes into Redis queue
         └── Django continues without waiting

Step 14: Django serializes the response using TicketListSerializer
         └── TicketListSerializer is used here (not TicketCreateSerializer)
         └── This matters because TicketCreateSerializer only includes write fields
         └── TicketListSerializer includes: id, ticket_number, status, priority, etc.
             {
               "id": "a3f7c2e1-...",
               "ticket_number": "TKT-A3F7C2E1",
               "title": "Server down",
               "status": "pending_payment",
               "priority": "high",
               ...
             }

Step 15: Django returns HTTP 201 Created with the full JSON

Step 16: Response travels back to Vite proxy → back to Axios

Step 17: Axios response interceptor runs
         └── Status 201 = success, no special handling needed

Step 18: createTicket() in tickets.js returns the response data

Step 19: React in NewTicket.jsx receives the response
         └── Shows a success toast: "Ticket created! Redirecting to your ticket…"
         └── navigate(`/tickets/${data.id}`)  ← user sees their new ticket immediately
         └── (NOT /dashboard — that was a bug fixed in Phase 8)

Step 20: (Meanwhile, in background)
         └── Celery worker picks up the email task from Redis
         └── Sends confirmation email to customer
         └── Completely separate from the web request
```

---

## 12. Security Explained

### `SECRET_KEY` — Django's Master Password

**Simple explanation:**
The SECRET_KEY is like a master password that Django uses internally for cryptography — signing cookies, generating CSRF tokens, creating password reset links. If an attacker gets your SECRET_KEY, they can forge any session or CSRF token.

**Rules:**
- Minimum 50 characters, random
- Never commit to Git
- Different for every environment (dev, staging, production)
- Current key is `django-insecure-...` — fine for development, MUST be replaced before production

---

### `DEBUG` — Development vs Production Mode

| Setting | `DEBUG=True` (Development) | `DEBUG=False` (Production) |
|---------|---------------------------|---------------------------|
| Error pages | Detailed Python traceback | Generic "Server Error" page |
| Static files | Django can serve them | Only WhiteNoise/nginx serves them |
| Security | Relaxed | Strict |
| Performance | Slower | Faster |

**Never run `DEBUG=True` in production.** The detailed error pages show your code structure to attackers.

---

### Environment Variables — Keeping Secrets Safe

**Simple explanation:**
Instead of writing your database password in your code, you put it in a `.env` file. Your code reads it from there at runtime. This way:
- Your code can be public on GitHub
- Your secrets stay on your private computer
- Different environments (dev/staging/production) have different secrets

**How it works:**
```python
# In settings.py:
SECRET_KEY = os.environ["SECRET_KEY"]
# os.environ reads the value from the environment/from .env file
# If it's missing, Python raises an error — intentional!
```

---

### `ALLOWED_HOSTS` — Preventing Host Header Attacks

**Simple explanation:**
ALLOWED_HOSTS tells Django which website addresses it should respond to.

*Why it matters:* Without it, an attacker could set up a fake website and trick users into thinking Django's responses came from that fake site (HTTP Host header injection attack).

*Your current setting:*
```
ALLOWED_HOSTS=localhost,127.0.0.1,backend
```
- `localhost` and `127.0.0.1` → for local development
- `backend` → for requests from within Docker (the frontend container uses the service name)

---

### CORS — Who Can Call Your API?

**Simple explanation:**
By default, browsers block JavaScript on website A from making API calls to website B. This is a browser security feature called Same-Origin Policy. CORS (Cross-Origin Resource Sharing) is how you tell browsers: "it's okay, website A is allowed to call my API."

*In development:* `CORS_ALLOW_ALL_ORIGINS = True` — any website can call your API (safe because only you are running this)

*In production:* List only your specific frontend domain.

---

### JWT Authentication — How Login Works

**Simple explanation:**
After you log in, Django gives you two special codes:
- **Access token** — proves you're logged in. Valid for 15 minutes. Sent with every API request.
- **Refresh token** — used to get a new access token when the old one expires. Valid for 7 days.

**Flow:**
```
1. User enters email + password
2. Django verifies credentials → returns { access: "...", refresh: "...", user: {...} }
3. Frontend stores both tokens in localStorage
4. Every API request: access token goes in "Authorization: Bearer ..." header
5. If Django says 401: frontend automatically uses refresh token to get new access token
6. If refresh token is expired: user must log in again
```

---

### CSRF — Preventing Fake Form Submissions

**Simple explanation:**
CSRF (Cross-Site Request Forgery) is an attack where a malicious website tricks your browser into submitting a form to your website. Django prevents this by requiring a secret token on every form submission.

*Since your frontend is a React SPA sending JSON (not HTML forms):* CSRF is less of a concern for API endpoints, but Django's CSRF middleware is still active for the admin panel.

---

## 13. Git + GitHub Explained

### Why Version Control?

**Simple explanation:**
Git is like an infinite "Undo" button for your entire project. Every time you commit, Git takes a snapshot. If you break something badly, you can go back to any previous snapshot.

**Analogy:** Imagine writing a novel and saving a new copy every chapter. If you hate chapter 12, you can go back to the chapter 11 snapshot and start over. Git is that, but for code — and much smarter.

---

### Core Git Concepts

**Repository (repo):** The folder where all your code and its history live.

**Commit:** A saved snapshot of all files at a specific point in time. Has a message describing what changed.

**Branch:** A parallel version of the code. You can create a branch to try a risky feature without affecting the main code.

**Remote:** A copy of your repository on GitHub. Acts as a backup and enables collaboration.

---

### The Three Git Areas

```
Your actual files            ← Working Directory
      │
      │  git add filename
      ▼
"Staged" changes             ← Staging Area (Index)
      │
      │  git commit -m "message"
      ▼
Commit in history            ← Local Repository
      │
      │  git push origin master
      ▼
GitHub                       ← Remote Repository
```

---

### Essential Git Commands

```bash
git status
# Shows: which files changed, which are staged, which are untracked
# Use this before every commit

git diff
# Shows: exactly what lines changed in each file
# Use this to review your changes before committing

git add filename
# Stages a specific file (readies it for commit)

git add -p
# Stages changes interactively (shows each change, asks yes/no)
# Recommended — prevents accidentally committing debug code

git commit -m "Fix: ticket number not generating on creation"
# Saves a snapshot with a descriptive message
# Good message format: "Type: what changed and why"
# Types: Add, Fix, Update, Remove, Refactor, Doc

git push origin master
# Uploads your commits to GitHub

git pull origin master
# Downloads changes from GitHub to your local copy

git log --oneline
# Shows history of all commits (short format)

git show COMMIT_HASH
# Shows exactly what changed in a specific commit
```

---

### The `.gitignore` File — Never Commit These

**Simple explanation:**
`.gitignore` is a list of files and folders Git should completely ignore. If a file is in `.gitignore`, `git add .` won't touch it.

**Critical things to NEVER commit:**
- `.env` files — contain passwords and secret keys
- `node_modules/` — hundreds of MB of dependencies
- `staticfiles/` — auto-generated, not source code
- `*.pyc` — compiled Python bytecode

---

## 14. Important Code Explained Line-by-Line

### The Axios Client (`frontend/src/api/client.js`)

```javascript
import axios from "axios";
// Import the Axios library (installed via npm)

const apiClient = axios.create({
  baseURL: "/api",
  // All requests using apiClient will be relative to /api
  // So apiClient.get("/tickets/") → GET /api/tickets/
  // Vite's proxy forwards /api/* to Django

  headers: {
    "Content-Type": "application/json",
  },
  // Every request will say "I'm sending JSON"
});

apiClient.interceptors.request.use((config) => {
  // This function runs BEFORE every request
  const token = localStorage.getItem("access_token");
  // Read the JWT access token from browser's localStorage
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    // Add the token to the request header
    // Django reads this header to know who you are
  }
  return config;
  // Return the (modified) request config
});

apiClient.interceptors.response.use(
  (response) => response,
  // If request SUCCEEDED: pass through unchanged

  async (error) => {
    // If request FAILED:
    const originalRequest = error.config;
    // Save the original request so we can retry it

    if (error.response?.status === 401 && !originalRequest._retry) {
      // 401 = "Unauthorized" — token is expired or invalid
      // _retry flag prevents infinite loops (only retry once)
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem("refresh_token");
        const { data } = await axios.post("/api/auth/token/refresh/", {
          refresh: refreshToken,
        });
        // Ask Django for a new access token using our refresh token
        localStorage.setItem("access_token", data.access);
        // Save the new access token
        originalRequest.headers.Authorization = `Bearer ${data.access}`;
        return apiClient(originalRequest);
        // Retry the original request with the new token
      } catch {
        // Refresh token is also expired — user must log in again
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
    // For all other errors, pass them through
  }
);

export default apiClient;
// Make apiClient available to import in other files
```

---

### The Celery Configuration (`backend/supportmitra/celery.py`)

```python
import os
from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "supportmitra.settings")
# If DJANGO_SETTINGS_MODULE isn't set yet, set it now
# This ensures Celery can find your Django settings

app = Celery("supportmitra")
# Create a Celery application named "supportmitra"
# This is the central object that manages all tasks

app.config_from_object("django.conf:settings", namespace="CELERY")
# Read all Celery config from Django's settings.py
# "namespace='CELERY'" means it reads all settings starting with CELERY_
# e.g. CELERY_BROKER_URL → broker_url
#      CELERY_RESULT_BACKEND → result_backend

app.autodiscover_tasks()
# Automatically find and register all tasks.py files
# in every app listed in INSTALLED_APPS
```

---

### The Ticket Signal (`backend/support_app/signals.py`)

```python
from django.db.models.signals import pre_save
# pre_save = a signal that fires BEFORE a model is saved
# Other signals: post_save (after), pre_delete (before delete), etc.

from django.dispatch import receiver
# receiver = decorator that "connects" this function to a signal

from .models import Ticket
# Import the Ticket model so we can listen for its saves

@receiver(pre_save, sender=Ticket)
# "When pre_save fires for the Ticket model, call this function"
def auto_generate_ticket_number(sender, instance, **kwargs):
    # sender = the Ticket class
    # instance = the specific Ticket object being saved
    # **kwargs = extra arguments (we don't use them)

    if not instance.ticket_number:
        # Only generate a number if one hasn't been set yet
        # (prevents overwriting an existing number on updates)

        short = str(instance.id).replace("-", "")[-8:].upper()
        # instance.id is a UUID like "a3f7c2e1-1234-5678-abcd-ef0123456789"
        # str() converts it to a string
        # .replace("-", "") removes dashes: "a3f7c2e112345678abcdef0123456789"
        # [-8:] takes the last 8 characters: "23456789"
        # .upper() capitalizes: "23456789"

        instance.ticket_number = f"TKT-{short}"
        # Result: "TKT-23456789"
        # This is set before the database save happens
        # 8 hex chars = ~4 billion unique values (safe at any realistic scale)
```

---

### The Custom JWT Login View (`backend/support_app/views.py`)

```python
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView as BaseTokenObtainPairView

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    # Extends the default SimpleJWT login serializer
    # By default, login returns: { "access": "...", "refresh": "..." }
    # We want to ALSO return user data: { "access": "...", "refresh": "...", "user": {...} }

    def validate(self, attrs):
        data = super().validate(attrs)
        # Call the original validation (checks email+password, generates tokens)
        # data = { "access": "...", "refresh": "..." }

        data["user"] = {
            "id": self.user.id,
            "email": self.user.email,
            "is_staff": self.user.is_staff,
            # is_staff is True for admin users, False for regular users
            # The React frontend uses this to show/hide admin features
        }
        return data
        # Now data = { "access": "...", "refresh": "...", "user": { ... } }

class CustomTokenObtainPairView(BaseTokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
    # Use our extended serializer instead of the default one
```

*Why this matters:* Without `is_staff` in the login response, the React `AdminRoute` guard would block all admin users from accessing admin pages — because `user?.is_staff` would always be `undefined` (falsy).

---

## 15. Learning Roadmap

### Where to Focus First

Based on your specific project, here is the recommended learning order:

---

**Level 1 — Foundations (Start Here)**

These are the concepts you need to understand to make any progress:

| Topic | Why it matters | Resource type |
|-------|---------------|---------------|
| Python basics | Django is Python | Python.org tutorial |
| JavaScript basics | React is JavaScript | javascript.info |
| How HTTP works (GET, POST, JSON) | Every API call uses these | MDN Web Docs |
| What a database table is | Your app stores all data in PostgreSQL | Basic SQL tutorial |
| Terminal/command line | You run everything from the terminal | Any beginner Linux course |

*Estimated time: 3-4 weeks of focused daily practice*

---

**Level 2 — Backend (Django)**

| Topic | Why it matters |
|-------|---------------|
| Django models and ORM | Your data structure lives here |
| Django migrations | How models become database tables |
| Django REST Framework serializers | How Python objects become JSON |
| DRF views (ListCreateAPIView, etc.) | How HTTP requests become API responses |
| Django admin panel | Your primary management tool |
| Environment variables (.env) | Keeping secrets safe |

*Estimated time: 4-6 weeks*

---

**Level 3 — Frontend (React)**

| Topic | Why it matters |
|-------|---------------|
| React components and JSX | Building blocks of the UI |
| useState hook | How components remember data |
| useEffect hook | Fetching data when a component loads |
| Axios / fetch API | How the frontend calls the backend |
| React Router | Switching between pages |
| Zustand or Context | Sharing state between components |
| Tailwind CSS | Styling without writing CSS files |

*Estimated time: 4-6 weeks*

---

**Level 4 — Infrastructure (Docker)**

| Topic | Why it matters |
|-------|---------------|
| Docker images and containers | How your app is packaged |
| Dockerfile syntax | Writing your own container recipes |
| docker-compose.yml | Orchestrating multiple services |
| Docker networking | How containers talk to each other |
| Volumes and persistence | Keeping data across restarts |

*Estimated time: 2-3 weeks*

---

**Level 5 — Advanced Topics (Learn as Needed)**

| Topic | When you need it |
|-------|-----------------|
| Celery background tasks | Phase 2: sending emails |
| Razorpay payment integration | Phase 2: payment flow |
| JWT and authentication deep dive | Phase 5: security hardening |
| PostgreSQL advanced queries | When performance becomes an issue |
| CI/CD pipelines (GitHub Actions) | Before deploying to production |
| Nginx and production deployment | When launching to real users |

---

**What to Skip (for Now)**

These topics are real but not relevant at your current stage:

- Kubernetes — for very large scale, not your concern
- Microservices — you have a monolith, which is correct for MVP
- GraphQL — your REST API is fine
- TypeScript — optional, not urgent
- Server-side rendering — you're using React SPA, correct for your use case

---

**Practical Learning Strategy**

1. **Read code before writing code** — Look at existing files in the project before writing new ones. Understanding patterns before applying them prevents bad habits.

2. **Break and fix things intentionally** — Stop a Docker container and observe the error. Add a wrong URL and see what happens. Learning from controlled failures is faster than only reading.

3. **Read error messages completely** — Don't just look at the first line. The most useful part of a Python traceback is usually the last 10 lines.

4. **One concept per day** — Learn `views.py` today. Learn `serializers.py` tomorrow. Don't try to absorb everything at once.

5. **Use the Django admin** — It shows you your actual data. Whenever you're confused about what's in the database, look at the admin panel.

---

## 17. Authentication Architecture Deep Dive

This section explains every piece of the authentication system built across Phases 5–7. If you're confused about how login works, why tokens expire, or what role-based access means — read this.

---

### Custom User Model

Django comes with a built-in `User` model. SupportMitra uses it directly (`auth_user` table) but extends it with two profile tables:

```
auth_user (Django built-in)
    id, email, password (hashed), is_staff, is_active
         │
         ├── Customer profile   (one-to-one)
         │       company_name, phone, address, ...
         │
         └── Freelancer profile (one-to-one)
                 skills, availability, rating, contract_signed, ...
```

**Why two profile tables?** A Customer and a Freelancer are both "users" who can log in — but they have completely different data. Instead of putting all fields in one giant table, each role gets its own table. `user.customer_profile` and `user.freelancer_profile` let you navigate between them.

**The `role` field:** The login response includes a `role` field (`customer`, `freelancer`, or `admin`). The React frontend uses this to decide what to show each user.

---

### JWT Tokens — What They Are and How They Work

**Simple explanation:**
After you log in, Django gives you two signed "passes":
- **Access token** — your daily pass. Shows to the security guard (Django) on every request. Expires in 15 minutes.
- **Refresh token** — your monthly pass. Use it to get a new daily pass when the old one expires. Expires in 7 days.

**Why two tokens?**
If Django checked the database on every API request to see if the user is still logged in, the database would get hammered. Tokens are self-contained — Django just checks the cryptographic signature (no database needed). The short expiry (15 min) limits damage if a token is stolen.

**Token rotation and blacklisting:**
```
Setting: ROTATE_REFRESH_TOKENS = True
Setting: BLACKLIST_AFTER_ROTATION = True

What this means:
- Every time you use a refresh token to get a new access token,
  you also get a NEW refresh token
- The OLD refresh token is added to a blacklist in the database
- If an attacker steals an old refresh token, it will be rejected
```

This means even if someone intercepts a refresh token, they can use it only once before it's invalidated.

---

### Axios Interceptors — The Invisible Helper

Every API call from the React frontend passes through the Axios interceptors in `frontend/src/api/client.js`. Think of interceptors as middleware but on the frontend.

**Request interceptor** (runs before every call):
```
1. Read access_token from localStorage
2. Add "Authorization: Bearer <token>" header to the request
3. Send the request
```

**Response interceptor** (runs after every call):
```
If Django says 401 (Unauthorized):
  → Get the refresh_token from localStorage
  → Ask Django for a new access_token
  → Save the new access_token to localStorage
  → Retry the original request with the new token
  → User never sees any disruption

If refresh also fails:
  → Clear both tokens from localStorage
  → Redirect user to /login
```

This is why you never see "your session expired" errors — the app silently handles token refresh in the background.

---

### Role-Based Access Control (RBAC)

Three roles, three permission levels:

| Role | `is_staff` | `role` field | What they can do |
|------|------------|--------------|-----------------|
| Customer | false | `customer` | See own tickets, create tickets, add comments, submit CSAT |
| Freelancer | false | `freelancer` | See assigned tickets, update status, add internal comments |
| Admin | true | `admin` | See all tickets, assign freelancers, change any status |

**How permissions are enforced on the backend:**

Every API view has a `permission_classes` list:
```python
class TicketListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated, IsCustomer]
    # Only logged-in customers can reach this view
```

Custom permission classes check the user's role:
- `IsCustomer` — `return hasattr(request.user, 'customer_profile')`
- `IsFreelancer` — `return hasattr(request.user, 'freelancer_profile')`
- `IsAdminUser` — `return request.user.is_staff`

**How route guards work on the frontend:**

```jsx
// PrivateRoute — any logged-in user can pass
function PrivateRoute({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? children : <Navigate to="/login" />;
}

// AdminRoute — only is_staff=true users can pass
function AdminRoute({ children }) {
  const user = useAuthStore((s) => s.user);
  return user?.is_staff ? children : <Navigate to="/dashboard" />;
}
```

**The freelancer role guard in Dashboard.jsx:**
Freelancers log in and land on `/dashboard`. That page calls `GET /api/tickets/` which is `IsCustomer` only — so freelancers would get a 403 error. To prevent this, Dashboard shows a friendly "Freelancer Portal — coming soon" message instead of making the broken API call.

---

### Session Persistence — Surviving Browser Refresh

**The problem:** Zustand stores state in JavaScript memory. When you refresh the browser, all JavaScript memory is wiped. The user's `user` object (email, is_staff, role) is gone.

**The solution:** Three layers of persistence:

1. **localStorage** — JWT tokens are stored here (survives page refresh)
2. **`safeLocalStorage()`** — wraps localStorage reads in a try/catch to handle private browsing mode (Safari's private mode throws an error on localStorage access):
   ```javascript
   function safeLocalStorage(key) {
     try { return localStorage.getItem(key); }
     catch { return null; }
   }
   ```
3. **`initializeAuth()`** — called once on app startup. Reads the token from localStorage, calls `GET /api/customers/me/` (or `/api/freelancers/me/`) to get the user object, and rebuilds the Zustand store state.

Without `initializeAuth()`, after every page refresh the user would appear logged out even though their token is still valid.

---

## 18. Production Engineering — Stability & Safety

This section covers the engineering improvements made in Phase 7 (Zero-Bug Stabilization) that make the codebase production-grade.

---

### Transaction Safety

**The problem without transactions:**
A ticket assignment involves multiple database writes:
1. Update `ticket.assigned_to = freelancer`
2. Create a `TicketAssignment` row
3. Create a `TicketActivityLog` entry
4. Create a `Notification` for the freelancer

Without transactions, if step 3 fails (e.g., database error), steps 1 and 2 are already committed. The database is now inconsistent — the ticket shows as assigned but has no activity log and no notification.

**The solution — `transaction.atomic()`:**
```python
from django.db import transaction

def assign_ticket(ticket, freelancer, assigned_by):
    with transaction.atomic():
        ticket.assigned_to = freelancer
        ticket.save()                          # step 1
        TicketAssignment.objects.create(...)   # step 2
        TicketActivityLog.objects.create(...)  # step 3
        Notification.objects.create(...)       # step 4
```

If ANY step inside `with transaction.atomic()` raises an exception, Django automatically rolls back ALL changes in that block. Either all 4 steps succeed or none of them do. No partial data ever lands in the database.

---

### Database Indexes — Why Queries Are Fast

**Simple explanation:**
An index in a database is like the index at the back of a book. Instead of reading every page to find "Django", you look in the index and jump straight to page 247. Without an index, the database reads every row.

**The two composite indexes added in Phase 7:**

```python
# In models.py, on TicketActivityLog:
class Meta:
    indexes = [
        Index(fields=["ticket", "action"], name="idx_activity_log_ticket_action"),
    ]

# On Notification:
class Meta:
    indexes = [
        Index(fields=["recipient", "is_read"], name="idx_notif_recipient_read"),
    ]
```

**Why composite (two fields) not single?**
The most common queries are:
- "Give me all `status_changed` logs for ticket X" → filter by `ticket` AND `action`
- "Give me all unread notifications for user Y" → filter by `recipient` AND `is_read`

A single-field index on `ticket` would still have to scan all log types. A composite index on `(ticket, action)` answers both filters in one lookup.

---

### N+1 Query Problem (and How It's Fixed)

**The problem:**
```python
# Bad code:
tickets = Ticket.objects.all()
for ticket in tickets:
    print(ticket.customer.user.email)   # separate DB query per ticket!
```

If there are 100 tickets, this makes 101 database queries (1 for all tickets + 100 for each customer). This is called the N+1 problem.

**The fix — `select_related`:**
```python
# Good code:
tickets = Ticket.objects.select_related("customer__user", "assigned_to__user").all()
for ticket in tickets:
    print(ticket.customer.user.email)   # already loaded — no extra query
```

`select_related` tells Django to do a SQL JOIN and fetch all related objects in a single query.

**In admin.py:**
```python
class TicketAdmin(admin.ModelAdmin):
    list_select_related = ["customer__user", "assigned_to__user"]
    # Django admin uses this when rendering the list view
```

Without `list_select_related`, the Django admin panel would fire a separate DB query for every row shown — catastrophically slow with hundreds of tickets.

---

### Serializer Security — Hiding Private Fields

**The problem:**
If a serializer exposes all fields of a model, sensitive admin data can leak to customers or freelancers.

**What was hidden and why:**

| Field | Model | Hidden from | Reason |
|-------|-------|-------------|--------|
| `notes` | Ticket | Customers | Internal admin notes |
| `contract_signed` | Freelancer | Customers + Freelancers | Admin contract status |
| `onboarding_status` | Freelancer | Customers | Internal onboarding state |
| `active` | Freelancer | Customers | Internal admin flag |

**`FreelancerPublicSerializer`** was created to expose only safe fields:
```python
class FreelancerPublicSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="user.email", read_only=True)
    class Meta:
        model = Freelancer
        fields = ["id", "email", "skills", "availability", "rating"]
```

When a ticket shows "assigned to" info, customers see only email + skills — not the freelancer's contract details.

---

### Activity Log — The Immutable Audit Trail

Every meaningful action on a ticket creates a `TicketActivityLog` row. This row can never be edited or deleted (enforced in admin.py with `can_delete = False` and all fields readonly).

**Example log entries for a ticket's lifecycle:**
```
created        | actor=customer@company.com  | at: 2026-05-19 10:00
status_changed | actor=admin@supportmitra.com | open → in_progress | at: 10:05
assigned       | actor=admin@supportmitra.com | assigned to: freelancer@email.com
status_changed | actor=freelancer@email.com   | in_progress → resolved
status_changed | actor=admin@supportmitra.com | resolved → closed
```

**Why this matters:** If a customer disputes how a ticket was handled, you have a permanent, timestamped record of every action and who performed it. This is essential for a paid support service.

**The `actor=None` problem (and fix):** Django's pre_save signal doesn't know who triggered a save — it just fires. When the service layer called `ticket.save()` directly (not through `update_status`), the signal created activity log entries with `actor=None`. This was fixed by adding an actor-patch step immediately after the save in `assign_ticket`.

---

### Prometheus Metrics — Protected Monitoring

`/metrics/` is a URL that exposes internal Django performance data (request counts, response times, DB query counts) in a format Prometheus can scrape.

**The security problem:** By default, anyone could visit `http://yourdomain.com/metrics/` and see detailed internal system information — essentially a map for attackers.

**The fix:**
```python
from django.contrib.admin.views.decorators import staff_member_required
path("metrics/", staff_member_required(prometheus_exports.ExportToDjangoView), ...)
```

Now only users logged into the Django admin (is_staff=True) can access metrics. Everyone else gets a 302 redirect to the login page.

---

## 19. QA, Testing & Bug-Fix Workflow

### The Test Suite

SupportMitra has 73 automated tests that run in seconds and verify everything works correctly.

**Run all tests:**
```bash
docker compose exec backend python -m pytest tests/ -v
```

**What the tests cover:**
| Category | Tests | What's verified |
|----------|-------|----------------|
| Authentication | 14 | Register, login, logout, refresh, token blacklisting |
| Ticket CRUD | ~15 | Create, read, update; permissions per role |
| Admin actions | ~10 | Assign, unassign, status change, activity logging |
| Signals | ~8 | resolved_at stamping, ticket number generation |
| Service layer | ~10 | assign_ticket, update_status, add_comment |
| Notifications | ~5 | Created on status change, assignment, comment |
| Permissions | ~8 | Role boundaries enforced at API level |
| Edge cases | ~3 | CSAT validation, duplicate prevention, closed ticket protection |

**Test isolation:** Every test creates its own test data and database transaction, then rolls it back. Tests never share state — running them in any order gives the same result.

---

### What Was Tested in Phase 8 (E2E Testing)

Phase 8 simulated 70 real-world test cases using actual HTTP calls to the running API, covering all three user roles:

**Categories tested:**
- Full authentication flow (register, login, logout, token rotation)
- Customer workflow (create ticket, list, filter, search, comment, CSAT)
- Freelancer workflow (list assigned tickets, update status, add internal comments)
- Admin workflow (assign, unassign, change status, view all tickets)
- Permission boundaries (cross-role blocks, data isolation)
- Failure states (invalid data, out-of-range values, duplicate submissions)
- Database consistency (no orphaned rows, no inconsistent states)

**Result: 66/70 passed. 4 failures turned into 3 fixed bugs + 1 documented gap.**

---

### The Bug-Fix Workflow

When a bug is found, this is the process followed:

1. **Symptom** — what the user sees (e.g., "after creating a ticket, I land on the dashboard")
2. **Root cause** — why it happens (e.g., "NewTicket.jsx discards the API response and hardcodes `navigate('/dashboard')`")
3. **Fix** — the minimum change to solve the problem
4. **Verification** — confirm the fix works and nothing else broke
5. **Commit** — descriptive commit message with the bug ID

**Key bugs found and fixed in Phase 8:**

| Bug | Symptom | Root Cause | Fix |
|-----|---------|-----------|-----|
| BUG-001 | POST /api/tickets/ returned no `id` | Wrong serializer used in response | Overrode `create()` to return `TicketListSerializer` |
| BUG-002 | After ticket creation → redirected to dashboard | `navigate('/dashboard')` hardcoded | Changed to `navigate('/tickets/${data.id}')` |
| BUG-004 | Activity log showed actor=None on assignment | Signal fires before service layer patches it | Added actor-patch step in `assign_ticket` |
| BUG-005 | `resolved_at` persisted after ticket reopened | `update_status` only set, never cleared it | Added `elif` branch to clear `resolved_at` on reopen |
| BUG-006 | All tickets created as "medium" priority | Priority field rendered in form state but not in UI | Added `<select>` dropdown for priority in TicketForm |
| BUG-007 | Freelancers saw error 403 on dashboard | Dashboard calls customer-only endpoint | Added role guard to show "coming soon" instead |

---

### MVP Stability Score

After Phase 8, a structured audit gave SupportMitra a final score:

| Category | Score |
|----------|-------|
| Authentication & Authorization | 9.0 / 10 |
| Backend API Correctness | 8.5 / 10 |
| Data Integrity | 8.0 / 10 |
| Security | 8.5 / 10 |
| Frontend Stability | 7.5 / 10 |
| Performance | 7.0 / 10 |
| Observability | 6.0 / 10 |
| Test Coverage | 8.0 / 10 |
| **Overall (weighted)** | **8.15 / 10** |

**8.15 / 10 = Ready for Controlled Beta Launch** with real users under supervision.

See `docs/FINAL_MVP_STABILITY_SCORE.md` for the full breakdown.

---

## 20. Project Status & Roadmap

### What's Complete (Phases 1–8)

| Phase | What was built |
|-------|---------------|
| 1–2 | Custom user model, Customer + Freelancer profiles, Ticket model, migrations |
| 3 | REST API: ticket CRUD, authentication (JWT), admin endpoints |
| 4 | Celery tasks (stubs), Celery Beat schedules, Redis integration |
| 5 | React frontend: login, register, dashboard, ticket detail, admin dashboard |
| 6 | QA pass: serializer security, CSAT, notification system, activity log |
| 7 | Zero-bug stabilization: transactions, indexes, N+1 fixes, Prometheus protection |
| 8 | Manual E2E testing: 6 bugs fixed, UX audit, stability score |

**73 automated tests. 0 failing. 0 regressions since Phase 6.**

---

### Before Beta Launch — Required Steps

These must be done before letting real users in:

| # | What to do | Why it matters |
|---|-----------|---------------|
| 1 | Replace `SECRET_KEY` in backend/.env with a 50+ char random string | Current key is the Django insecure default — it's public knowledge |
| 2 | Set `DEBUG=0` | `DEBUG=1` shows Python stack traces to anyone who hits a 500 error |
| 3 | Configure `SENTRY_DSN` | Without this, you won't know when users hit errors |
| 4 | Set `ALLOWED_HOSTS` to your actual domain | Prevents Host header injection |
| 5 | Enable HTTPS (SSL/TLS) | JWT tokens over plain HTTP are interceptable |
| 6 | Tune DRF throttle rates | Defaults are for development, not production load |

---

### Phase 9+ — What's Still To Build

| Feature | Why it matters |
|---------|---------------|
| Razorpay payment flow | Tickets are stuck at `pending_payment` without real payment |
| Email notifications (send_ticket_opened_email etc.) | Celery tasks exist but are stubs |
| WhatsApp notifications | Core to Indian SMB user behaviour |
| SLA engine | Automatic escalation when response time exceeds target |
| Freelancer dashboard | Frontend "coming soon" page needs real implementation |
| Frontend tests (Cypress or Playwright) | No browser-level regression protection |
| CI/CD pipeline (GitHub Actions) | Tests should run automatically on every push |
| Structured logging (structlog) | Installed but not configured — needed for production debugging |
| Error tracking (Sentry) | SDK installed, `SENTRY_DSN` blank |

---

### Understanding the Codebase at a Glance

```
When you want to...           Look in...
─────────────────────────     ──────────────────────────────────
Change database structure      backend/support_app/models.py
Add an API endpoint            backend/support_app/views.py + urls.py
Change what JSON looks like    backend/support_app/serializers.py
Add business logic             backend/support_app/services/
Change automatic reactions     backend/support_app/signals.py
Add a background task          backend/support_app/tasks.py
Change a page's appearance     frontend/src/pages/
Add a reusable UI piece        frontend/src/components/
Add shared API call logic      frontend/src/hooks/
Change global auth state       frontend/src/store/authStore.js
Change Docker setup            docker-compose.yml + Dockerfile.*
Change Django config           backend/supportmitra/settings.py
```

---

## 16. Glossary + Command Cheat Sheet

### Glossary of Technical Terms

| Term | Simple Definition |
|------|-----------------|
| **API** | A way for two programs to talk to each other using HTTP requests |
| **Backend** | The server-side code that handles data and business logic |
| **Frontend** | The client-side code that runs in the browser |
| **Container** | A lightweight, isolated package that contains an app and everything it needs to run |
| **Docker** | Software that creates and manages containers |
| **Docker Compose** | Tool that starts multiple Docker containers at once |
| **Image** | A template/blueprint for creating Docker containers |
| **Volume** | A folder shared between your computer and a Docker container |
| **Port** | A numbered "door" on a computer; different services use different port numbers |
| **Django** | A Python web framework for building web applications |
| **Gunicorn** | A production web server that runs Django applications |
| **WhiteNoise** | A Python library that lets Gunicorn serve CSS/JS files |
| **React** | A JavaScript library for building user interfaces |
| **Vite** | A fast tool that runs the React development server |
| **JSX** | A special syntax (HTML inside JavaScript) used by React |
| **Component** | A reusable piece of React UI |
| **State** | Data that a React component remembers and can change |
| **Hook** | A special React function (starts with "use") that adds features to components |
| **Axios** | A JavaScript library for making HTTP requests |
| **PostgreSQL** | A powerful open-source relational database |
| **Redis** | An in-memory key-value store used for caching and task queuing |
| **Celery** | A Python library for running background tasks |
| **Migration** | A file that describes how to change the database structure |
| **ORM** | Object-Relational Mapper — lets you query the database using Python instead of SQL |
| **Serializer** | Code that converts Python objects to JSON and validates incoming data |
| **JWT** | JSON Web Token — a compact, signed way to store user credentials |
| **CORS** | A browser security rule about which websites can call which APIs |
| **CSRF** | A security attack; Django protects against it automatically |
| **Middleware** | Code that runs on every request/response before it reaches your view |
| **Environment variable** | A value set outside your code (like a password) that your code reads at runtime |
| **Git** | A tool that tracks changes to your code over time |
| **Commit** | A saved snapshot of your code at a specific point in time |
| **Branch** | A parallel copy of your code for developing features independently |
| **SLA** | Service Level Agreement — a promise about how fast you'll respond to tickets |
| **CSAT** | Customer Satisfaction score — a rating (1-5) from customers after ticket resolution |
| **UUID** | Universally Unique Identifier — a random ID that is virtually guaranteed to be unique |
| **Health check** | A test Docker runs to verify a service is working, not just started |
| **HMR** | Hot Module Replacement — Vite's ability to update the browser instantly on file save |
| **Proxy** | A middleman that forwards requests from one place to another |
| **Transaction** | A group of database operations that either ALL succeed or ALL fail together (no partial state) |
| **transaction.atomic()** | Django's way to wrap multiple DB operations in a transaction — if any step fails, all roll back |
| **N+1 query** | A performance bug where fetching N items triggers N extra DB queries — one per item |
| **select_related** | Django ORM method that does a SQL JOIN to load related objects in a single query (fixes N+1) |
| **Service layer** | A layer of Python functions (in services/) that contains business logic, separate from views |
| **Index / DB index** | A database structure that speeds up lookups — like the index at the back of a book |
| **Composite index** | An index on two or more columns together, for queries that filter on both |
| **RBAC** | Role-Based Access Control — different users get different permissions based on their role |
| **Activity log** | A permanent, immutable record of every action taken on a ticket (who, what, when) |
| **Audit trail** | The complete history of changes to a record — used for accountability and dispute resolution |
| **Token rotation** | Each time you use a refresh token, you get a new one and the old one is invalidated |
| **Blacklisting** | Adding a used refresh token to a database list so it can never be reused |
| **Interceptor** | A function that runs on every request or response in Axios — like middleware for the frontend |
| **Toast notification** | A brief popup message that appears and disappears automatically (e.g., "Ticket created!") |
| **Zustand** | A lightweight React state management library — a shared memory box any component can read |
| **Prometheus** | A monitoring system that collects performance metrics from your running app |
| **structlog** | A Python library for structured (machine-readable JSON) log output |
| **Sentry** | An error tracking service — captures exceptions and shows you a dashboard of what's breaking |
| **WhiteNoise** | Python library that lets Gunicorn serve static files (CSS/JS) without Nginx |
| **Internal comment** | A comment on a ticket visible only to admins and freelancers, not to customers |
| **Debounce** | A technique that delays an action until the user stops typing — prevents API spam on search |
| **Birthday paradox** | A probability concept: collisions (e.g., duplicate ticket numbers) happen sooner than expected in a random space |
| **Permission class** | A DRF class that checks whether the current user is allowed to access a view |
| **Route guard** | A React component (PrivateRoute, AdminRoute) that redirects unauthorized users away from a page |
| **initializeAuth** | A function called on app startup that reads the stored JWT and restores the logged-in user state |
| **safeLocalStorage** | A wrapper around localStorage that returns null instead of throwing in private browsing mode |

---

### Complete Command Cheat Sheet

**Daily Startup:**
```bash
cd ~/Documents/fridaySystems_Tech
docker compose up -d
docker compose ps
```

**Check Health:**
```bash
docker compose ps                           # all container statuses
docker compose logs backend --tail=30       # backend recent logs
docker compose logs -f backend              # follow backend logs live
curl http://127.0.0.1:8000/api/health/      # test backend responds
curl http://localhost:5173                  # test frontend responds
```

**Django Management:**
```bash
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py makemigrations
docker compose exec backend python manage.py createsuperuser
docker compose exec backend python manage.py shell
docker compose exec backend python manage.py collectstatic --noinput
docker compose exec backend python manage.py showmigrations
docker compose exec backend python manage.py check
```

**Rebuild:**
```bash
docker compose down
docker compose up --build -d
```

**Troubleshoot:**
```bash
docker compose logs SERVICE --tail=50       # view logs
docker compose restart SERVICE              # restart one service
docker compose exec SERVICE bash            # open terminal inside container
ss -tlnp | grep PORT                        # check what's using a port
sudo systemctl stop redis-server            # stop system Redis
```

**Git:**
```bash
git status                                  # what changed?
git diff                                    # show exact changes
git add -p                                  # stage interactively
git commit -m "Description of change"
git push origin master
git log --oneline                           # see history
```

**Testing:**
```bash
docker compose exec backend python -m pytest tests/ -v        # run all 73 tests
docker compose exec backend python -m pytest tests/ -v -k auth # run only auth tests
docker compose exec backend python -m pytest tests/ --tb=short # compact error output
```

**Shutdown:**
```bash
docker compose down                         # stop everything (data preserved)
docker compose down -v                      # stop + DELETE database (irreversible!)
```

---

### Port Reference

| Port | Service | URL |
|------|---------|-----|
| 5173 | React Frontend (Vite) | http://localhost:5173 |
| 8000 | Django Backend (Gunicorn) | http://127.0.0.1:8000 |
| 8000 | Django Admin Panel | http://127.0.0.1:8000/admin/ |
| 5432 | PostgreSQL | (connect via DB tool) |
| 6379 | Redis | (internal use only) |

---

*This guide was last updated on 2026-05-19 to reflect the state of the SupportMitra project after Phase 8 (Manual E2E Testing + Zero-Bug Stabilization). All explanations reflect the real code — not a hypothetical example. Sections 17–20 cover all architecture additions made in Phases 5–8.*
