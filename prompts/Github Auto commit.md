From now on, whenever you make ANY meaningful change in my project, I want you to automatically perform safe Git version control operations.

Project:
~/Documents/fridaySystems_Tech

Workflow rules:

==================================================
AUTO GIT WORKFLOW
==================================================

After completing any stable fix, feature, refactor, or configuration update:

1. Run:
git status

2. Review changed files carefully

3. DO NOT commit:
- secrets
- passwords
- .env with sensitive values
- temporary files
- cache files
- large unnecessary artifacts
- broken/incomplete work

4. Then automatically run:
git add .

5. Generate a PROFESSIONAL commit message:
- short
- meaningful
- technical
- descriptive

Examples:
- "Fix Docker static files configuration"
- "Add Celery background task support"
- "Resolve Redis port conflict"
- "Improve frontend authentication flow"

6. Commit changes:
git commit -m "<generated_message>"

7. Push to GitHub:
git push origin master

==================================================
IMPORTANT SAFETY RULES
==================================================

Before committing:
- verify project still works
- verify Docker containers healthy
- verify no obvious errors
- verify no secrets exposed
- verify no accidental deletions

If work is incomplete or unstable:
- DO NOT commit automatically
- ask me first

If merge conflicts happen:
- stop and explain clearly

If push fails:
- diagnose and fix safely

==================================================
ADDITIONAL REQUIREMENTS
==================================================

After every commit:
- show commit summary
- explain what changed
- explain why changes were needed
- explain affected files

Always maintain a clean professional Git history.

Treat GitHub as the stable source of truth and recovery point for the entire project.
