# Local Development Setup

This guide will help you run SwapFlow on localhost:3000.

## Prerequisites

1. **Node.js and npm/yarn** - For running the frontend
2. **Python 3.8+** - For running the backend
3. **MongoDB** - Either local MongoDB or MongoDB Atlas connection string
4. **Google OAuth Credentials** - Get from [Google Cloud Console](https://console.cloud.google.com/)

## Step 1: Set Up Environment Variables

### Backend Environment Variables

Create `backend/.env` file:

```env
MONGO_URL=mongodb://localhost:27017/swapflow
# OR for MongoDB Atlas:
# MONGO_URL=mongodb+srv://username:password@cluster.mongodb.net/swapflow

DB_NAME=swapflow
GOOGLE_CLIENT_ID=230390770808-2u6f0s330fntsf8878mukt32a9crmqro.apps.googleusercontent.com
CORS_ORIGINS=http://localhost:3000
```

### Frontend Environment Variables

Create `frontend/.env` file:

```env
REACT_APP_BACKEND_URL=http://localhost:8000
REACT_APP_GOOGLE_CLIENT_ID=230390770808-2u6f0s330fntsf8878mukt32a9crmqro.apps.googleusercontent.com
```

**Important:** Use the same `GOOGLE_CLIENT_ID` for both frontend and backend.

## Step 2: Install Dependencies

### Backend
```bash
cd backend
pip install -r requirements.txt
```

### Frontend
```bash
cd frontend
npm install
# OR if using yarn:
# yarn install
```

## Step 3: Set Up Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable Google+ API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Set Application type to "Web application"
6. Add authorized JavaScript origins:
   - `http://localhost:3000`
7. Add authorized redirect URIs:
   - `http://localhost:3000`
8. Copy the Client ID and add it to both `.env` files

## Step 4: Start the Backend Server

```bash
cd backend
uvicorn server:app --reload --port 8000
```

The backend will run on `http://localhost:8000`

## Step 5: Start the Frontend Server

In a new terminal:

```bash
cd frontend
npm start
# OR if using yarn:
# yarn start
```

The frontend will automatically open at `http://localhost:3000`

## Troubleshooting

### Backend won't start
- Make sure MongoDB is running (if using local MongoDB)
- Check that all environment variables are set in `backend/.env`
- Verify Python dependencies are installed: `pip install -r requirements.txt`

### Frontend won't connect to backend
- Ensure backend is running on port 8000
- Check `REACT_APP_BACKEND_URL` in `frontend/.env` is set to `http://localhost:8000`
- Check browser console for CORS errors (backend CORS_ORIGINS should include `http://localhost:3000`)

### Google OAuth not working
- Verify `GOOGLE_CLIENT_ID` is the same in both `.env` files
- Check that `http://localhost:3000` is added to authorized origins in Google Cloud Console
- Make sure you're using the correct Client ID (not Client Secret)

## Quick Start Script

You can also create a script to start both servers. Create `start-dev.sh`:

```bash
#!/bin/bash

# Start backend in background
cd backend
uvicorn server:app --reload --port 8000 &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 3

# Start frontend
cd ../frontend
npm start

# Kill backend when frontend stops
kill $BACKEND_PID
```

Make it executable: `chmod +x start-dev.sh`
Run it: `./start-dev.sh`

---

## Production Deployment on Vercel

### Prerequisites

1. **GitHub Account**: Your code must be in a GitHub repository
2. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
3. **MongoDB Atlas**: Cloud database (free tier available)
4. **Custom Domain**: Purchase through Vercel or external registrar

### Step 1: Push Code to GitHub

```bash
# Initialize Git (if not already done)
git init
git add .
git commit -m "Initial commit: SwapFlow application"

# Create repository on GitHub, then:
git remote add origin https://github.com/yourusername/swapflow-app.git
git branch -M main
git push -u origin main
```

### Step 2: Set Up MongoDB Atlas

1. Sign up at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free cluster (M0 tier)
3. Configure Network Access: Add `0.0.0.0/0` to allow Vercel servers
4. Create database user and get connection string: `mongodb+srv://username:password@cluster.mongodb.net/swapflow`

### Step 3: Create Vercel Projects

**Frontend Project:**
1. Go to Vercel Dashboard → Add New Project
2. Import from GitHub repository
3. Set Root Directory to `frontend/`
4. Framework Preset: Create React App
5. Build Command: `npm run build`
6. Output Directory: `build`

**Backend Project:**
1. Add New Project → Import from same GitHub repository
2. Set Root Directory to `backend/`
3. Framework Preset: Other
4. Build Command: (leave empty)
5. Output Directory: (leave empty)

### Step 4: Configure Environment Variables

**Frontend (Vercel Dashboard):**
- `REACT_APP_BACKEND_URL`: `https://yourdomain.com`
- `REACT_APP_GOOGLE_CLIENT_ID`: Your Google OAuth Client ID

**Backend (Vercel Dashboard):**
- `MONGO_URL`: MongoDB Atlas connection string
- `DB_NAME`: `swapflow`
- `GOOGLE_CLIENT_ID`: Your Google OAuth Client ID
- `CORS_ORIGINS`: `https://yourdomain.com`

### Step 5: Configure Custom Domain

1. In Vercel Dashboard → Project Settings → Domains
2. Add your custom domain (e.g., `yourdomain.com`)
3. Follow DNS configuration instructions
4. Wait for DNS propagation (up to 48 hours)

### Step 6: Update Google OAuth

1. Go to [Google Cloud Console > Credentials](https://console.cloud.google.com/apis/credentials)
2. Edit your OAuth 2.0 Client ID
3. Add to **Authorized JavaScript origins**: `https://yourdomain.com`
4. Add to **Authorized redirect URIs**: `https://yourdomain.com`
5. Keep `http://localhost:3000` for local development

### Step 7: Automatic Deployments

**Production Deployments:**
- Push to `main` branch automatically deploys to production
- Vercel builds and deploys both frontend and backend

**Preview Deployments:**
- Push to feature branches creates preview deployments
- Test changes before merging to main

**Workflow:**
```bash
# Make changes
git add .
git commit -m "Description of changes"
git push origin main  # Auto-deploys to production
```

### Step 8: Verify Deployment

- [ ] Frontend loads at `https://yourdomain.com`
- [ ] Backend API accessible at `https://yourdomain.com/api/auth/me`
- [ ] Google OAuth sign-in works
- [ ] Database connection successful (check Vercel logs)

### Troubleshooting Production Issues

**OAuth Errors:**
- Verify exact domain match in Google Cloud Console (include `https://`)
- Check that both origins and redirect URIs are configured

**CORS Errors:**
- Verify `CORS_ORIGINS` environment variable includes production domain
- Check Vercel logs for specific CORS error messages

**Database Connection:**
- Verify MongoDB Atlas IP whitelist includes `0.0.0.0/0` or Vercel IP ranges
- Check connection string format in Vercel environment variables

**Domain Not Resolving:**
- Check DNS propagation status
- Verify DNS records in Vercel dashboard
- Wait up to 48 hours for full propagation
