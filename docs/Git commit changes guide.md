# Git Commit & Push Guide (SupportMitra)

This guide explains how to save your code changes to GitHub every time.

---

# Step 1 — Open New Terminal

In VS Code:

Ctrl + Shift + `

Always use a NEW terminal for Git commands.

Do NOT stop:
- backend terminal
- frontend terminal

---

# Step 2 — Go To Project Folder

```bash
cd ~/Documents/fridaySystems_Tech

# Step 3 — Check Changed Files

git status

# Step 4 — Add All Changes

git add .

# Step 5 — Commit Changes

git commit -m "your message here"

# Step 6 — Push To GitHub

git push origin master

# If branch is main:

git push origin main

# First Time GitHub Setup

 If GitHub remote is not connected:

 git remote add origin YOUR_GITHUB_REPO_URL

 # Verify 

 git remote -v

# Pull Latest Changes Before Working

git pull origin master 

or

git pull origin main

