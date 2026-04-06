# 🚀 Deployment Guide: AI Resume Analyzer

This guide explains how to deploy your **Cyber-Purple AI Resume Analyzer** to a production environment.

## 🏝️ Recommended Platform: Railway

Railway is the easiest platform because it supports `docker-compose.yml` and manages all services (Backend, Frontend, Redis, Celery) in one dashboard.

### 1. Push to GitHub
Ensure your repository is on GitHub.

### 2. Connect to Railway
- Log in to [Railway.app](https://railway.app/).
- Click **"New Project"** → **"Deploy from GitHub repo"**.
- Select your repository.

### 3. Configure Environment Variables

For each service, set these variables in the Railway dashboard:

#### **Backend Service**
- `GROQ_API_KEY`: Your real Groq API key.
- `REDIS_URL`: `redis://redis:6379/0` (managed automatically if you add a Redis service).
- `PYTHONUNBUFFERED`: `1`

#### **Frontend Service**
- `VITE_API_URL`: Your backend's public URL (e.g., `https://backend-production.up.railway.app/api/analyze`).
- `PORT`: `80`

---

## 🛠️ Manual Deployment (Any Cloud)

If you are using a different provider (AWS, DigitalOcean, etc.), follow these steps:

### Build Backend
```bash
docker build -t your-username/resume-backend:latest ./backend
docker push your-username/resume-backend:latest
```

### Build Frontend
Note: Pass the backend URL during the build!
```bash
docker build --build-arg VITE_API_URL=https://your-api.com/api/analyze -t your-username/resume-frontend:latest ./frontend
docker push your-username/resume-frontend:latest
```

### Production Checklist
- [ ] **SSL (HTTPS)**: Ensure your provider provides an SSL certificate (standard with Railway/Render).
- [ ] **API Security**: In `app.py`, update `allow_origins` from `["*"]` to your actual frontend domain once deployed.
- [ ] **Scan Budget**: Remember the scan budget is local to the user's session (not database-backed).

---

## 🧪 Testing Production Locally

You can test the production setup locally to ensure Nginx and the minimized backend work:

1. Stop any running instances.
2. Build and start:
   ```bash
   docker-compose up --build
   ```
3. Visit `http://localhost:80` (Frontend served via Nginx).
4. Check health: `http://localhost:8000/health`.
