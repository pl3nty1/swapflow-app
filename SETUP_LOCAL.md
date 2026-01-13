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

