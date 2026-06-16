<!-- ResolveHQ Local Development Startup Guide
This guide explains how to start your ResolveHQ project every time. Your project has:
• Backend → Django server
• Frontend → React + Vite server
Project Structure
fridaySystems_Tech/
■
■■■ backend/
■■■ frontend/
■■■ .venv/
STEP 1 — Open VS Code
Open your fridaySystems_Tech project folder in VS Code.
STEP 2 — Start Backend
Open Terminal #1:
cd ~/Documents/fridaySystems_Tech/backend
source ../.venv/bin/activate
python3 manage.py runserver
If successful, Django will start at http://127.0.0.1:8000/
STEP 3 — Start Frontend
Open Terminal #2:
cd ~/Documents/fridaySystems_Tech/frontend
npm run dev
Frontend will usually run at http://localhost:5173/
STEP 4 — Open Website
Open in browser:
http://localhost:5173
Django Admin PanelAdmin URL:
http://127.0.0.1:8000/django-admin/
Important Notes
ThingWhat to do
Backend terminalKeep it running while working
Frontend terminalKeep it running while working
Backend firstAlways start backend before frontend
Virtual environmentActivate only for backend
Common Errors
1. Port already in use
→ Press CTRL + C in old terminal
2. ModuleNotFoundError
→ pip install <package-name>
3. Blank frontend
→ Make sure backend is running
4. Django admin login issue
→ Run:
python3 manage.py createsuperuser
Daily Startup Checklist
✓ Open VS Code
✓ Start backend
✓ Start frontend
✓ Open localhost:5173
✓ Begin development -->