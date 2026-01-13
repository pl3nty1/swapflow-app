# SwapFlow

A trading platform where users can swap items without spending money.

## Features

- Google OAuth authentication
- Item posting and browsing
- Trade management
- User ratings and reputation system
- Real-time messaging

## Quick Start

### Local Development

See [SETUP_LOCAL.md](SETUP_LOCAL.md) for detailed local development setup instructions.

**Quick commands:**
```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn server:app --reload --port 8000

# Frontend (in another terminal)
cd frontend
npm install
npm start
```

### Production Deployment

See [SETUP_LOCAL.md](SETUP_LOCAL.md#production-deployment-on-vercel) for Vercel deployment instructions.

**Key steps:**
1. Push code to GitHub
2. Create Vercel projects (frontend and backend)
3. Set environment variables in Vercel
4. Configure custom domain
5. Update Google OAuth settings

## Tech Stack

- **Frontend**: React, Tailwind CSS, Shadcn/UI
- **Backend**: FastAPI (Python)
- **Database**: MongoDB (local) / MongoDB Atlas (production)
- **Authentication**: Google OAuth 2.0
- **Deployment**: Vercel

## Project Structure

```
├── frontend/          # React frontend application
├── backend/           # FastAPI backend server
├── SETUP_LOCAL.md    # Setup and deployment documentation
└── README.md         # This file
```

## Environment Variables

### Local Development

**Backend** (`backend/.env.local`):
- `MONGO_URL`: MongoDB connection string
- `DB_NAME`: Database name
- `GOOGLE_CLIENT_ID`: Google OAuth Client ID
- `CORS_ORIGINS`: Allowed CORS origins

**Frontend** (`frontend/.env.local`):
- `REACT_APP_BACKEND_URL`: Backend API URL
- `REACT_APP_GOOGLE_CLIENT_ID`: Google OAuth Client ID

### Production

Set environment variables in Vercel dashboard for both projects.

## Contributing

1. Create a feature branch: `git checkout -b feature/new-feature`
2. Make your changes
3. Commit: `git commit -m "Add new feature"`
4. Push: `git push origin feature/new-feature`
5. Create a pull request

## License

MIT
