You are acting as a senior full-stack debugging engineer.

Project Name: ResolveHQ

Tech Stack:
- Frontend: React + Vite + TailwindCSS
- Backend: Django + Django REST Framework
- Authentication: JWT + AllAuth
- Redis used for throttling/cache
- SQLite database (development)

Your task:
Perform a COMPLETE project-wide bug audit and fix issues one-by-one safely.

IMPORTANT RULES:
1. Do NOT refactor large architecture unless absolutely required.
2. Do NOT break working functionality.
3. Always explain:
   - root cause
   - affected files
   - fix applied
   - testing performed
4. After each fix:
   - run related tests/checks
   - verify frontend/backend still works
5. Keep changes minimal and production-safe.
6. Before modifying files, analyze dependency chain and imports.
7. Never assume configuration values — inspect actual project files first.
8. Preserve existing UI styling unless bug-related.

PHASE 1 — FULL BUG AUDIT

Analyze entire project and create categorized report:

A. Backend Issues
- Django errors
- Missing imports/packages
- Serializer bugs
- Model issues
- URL routing problems
- JWT/auth issues
- Redis/cache/throttle problems
- Environment/config issues
- Migration issues
- API response errors
- Logging/security problems

B. Frontend Issues
- Broken API calls
- Routing issues
- React state bugs
- Form validation issues
- Authentication flow bugs
- Undefined/null rendering bugs
- Mobile responsiveness issues
- Console warnings/errors
- UX problems

C. Integration Issues
- Frontend/backend connection
- CORS
- Port mismatch
- API endpoint mismatch
- Auth token flow
- Environment variables

D. Code Quality Problems
- Dead code
- Duplicate code
- Unsafe patterns
- Large components
- Missing error handling

PHASE 2 — PRIORITIZE BUGS

Create severity table:

- Critical
- High
- Medium
- Low

Focus first on:
1. Registration/Login flow
2. Authentication
3. Ticket creation
4. Dashboard/API functionality
5. Admin functionality

PHASE 3 — FIX BUGS ONE BY ONE

For EACH bug:
1. Explain root cause
2. Show exact file(s)
3. Apply fix
4. Explain why fix works
5. Run verification steps
6. Confirm no regressions created

PHASE 4 — FINAL VERIFICATION

Run:
- Django system checks
- migrations check
- API endpoint validation
- frontend build check
- console error audit
- auth flow test
- registration test
- login test
- ticket creation test

PHASE 5 — FINAL REPORT

Generate:
- bugs fixed
- remaining issues
- technical debt
- production readiness score
- recommended next steps

Start by performing ONLY the complete audit first.
Do not immediately mass-edit files.