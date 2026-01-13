# Vercel Deployment Checklist

This checklist guides you through deploying SwapFlow to Vercel with a custom domain.

## ✅ Completed Steps

- [x] Git repository initialized
- [x] `.gitignore` configured to exclude sensitive files
- [x] Documentation updated (README.md, SETUP_LOCAL.md)
- [x] Code committed to local Git repository

## 📋 Manual Steps Required

### Step 1: Push to GitHub

1. Create a new repository on GitHub (e.g., `swapflow-app`)
2. Connect your local repository:

```bash
git remote add origin https://github.com/yourusername/swapflow-app.git
git branch -M main
git push -u origin main
```

### Step 2: Set Up MongoDB Atlas

1. Sign up at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Create a free cluster (M0 tier)
3. Configure Network Access:
   - Click "Network Access" → "Add IP Address"
   - Add `0.0.0.0/0` to allow all IPs (or Vercel-specific IPs)
4. Create Database User:
   - Click "Database Access" → "Add New Database User"
   - Create username and password
   - Save credentials securely
5. Get Connection String:
   - Click "Connect" on your cluster
   - Choose "Connect your application"
   - Copy connection string: `mongodb+srv://username:password@cluster.mongodb.net/swapflow`
   - Replace `<password>` with your actual password

### Step 3: Create Vercel Projects

#### Frontend Project

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click "Add New Project"
3. Import your GitHub repository
4. Configure project:
   - **Project Name**: `swapflow-frontend` (or your choice)
   - **Root Directory**: `frontend`
   - **Framework Preset**: Create React App
   - **Build Command**: `npm run build` (auto-detected)
   - **Output Directory**: `build` (auto-detected)
5. Click "Deploy"

#### Backend Project

1. Click "Add New Project" again
2. Import the same GitHub repository
3. Configure project:
   - **Project Name**: `swapflow-backend` (or your choice)
   - **Root Directory**: `backend`
   - **Framework Preset**: Other
   - **Build Command**: (leave empty)
   - **Output Directory**: (leave empty)
5. Click "Deploy"

### Step 4: Configure Environment Variables

#### Frontend Project Environment Variables

1. Go to Frontend Project → Settings → Environment Variables
2. Add the following:

| Name | Value | Environment |
|------|-------|-------------|
| `REACT_APP_BACKEND_URL` | `https://yourdomain.com` | Production, Preview, Development |
| `REACT_APP_GOOGLE_CLIENT_ID` | `230390770808-2u6f0s330fntsf8878mukt32a9crmqro.apps.googleusercontent.com` | Production, Preview, Development |

#### Backend Project Environment Variables

1. Go to Backend Project → Settings → Environment Variables
2. Add the following:

| Name | Value | Environment |
|------|-------|-------------|
| `MONGO_URL` | `mongodb+srv://username:password@cluster.mongodb.net/swapflow` | Production, Preview, Development |
| `DB_NAME` | `swapflow` | Production, Preview, Development |
| `GOOGLE_CLIENT_ID` | `230390770808-2u6f0s330fntsf8878mukt32a9crmqro.apps.googleusercontent.com` | Production, Preview, Development |
| `CORS_ORIGINS` | `https://yourdomain.com` | Production, Preview, Development |

**Important**: Replace `yourdomain.com` with your actual domain name.

### Step 5: Purchase and Configure Domain

#### Option A: Purchase Through Vercel (Recommended)

1. In Vercel Dashboard → Domains
2. Click "Add Domain"
3. Search for your desired domain
4. Purchase through Vercel
5. Domain automatically configured

#### Option B: Use Existing Domain

1. In Vercel Dashboard → Project Settings → Domains
2. Add your domain (e.g., `yourdomain.com`)
3. Follow DNS configuration instructions:
   - Add A record or CNAME as instructed
   - Wait for DNS propagation (up to 48 hours)

### Step 6: Configure Domain for Both Projects

1. **Frontend Project**:
   - Go to Settings → Domains
   - Add `yourdomain.com`
   - Verify DNS configuration

2. **Backend Project**:
   - Go to Settings → Domains
   - Add `yourdomain.com` (same domain)
   - Vercel will route `/api/*` to backend automatically

### Step 7: Update Google OAuth Configuration

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Select your project
3. Click on your OAuth 2.0 Client ID
4. Under "Authorized JavaScript origins", add:
   - `https://yourdomain.com`
   - Keep `http://localhost:3000` for local development
5. Under "Authorized redirect URIs", add:
   - `https://yourdomain.com`
   - Keep `http://localhost:3000` for local development
6. Click "Save"

### Step 8: Enable Automatic Deployments

Both projects should already have automatic deployments enabled by default when connected to GitHub.

**Verify Settings:**
1. Go to Project Settings → Git
2. Ensure "Automatically deploy from Git" is enabled
3. Production branch should be set to `main`

**Deployment Workflow:**
- Push to `main` branch → Automatic production deployment
- Push to feature branch → Preview deployment
- Create Pull Request → Preview deployment

### Step 9: Verify Deployment

After initial deployment:

- [ ] Frontend loads at `https://yourdomain.com`
- [ ] Backend API accessible at `https://yourdomain.com/api/auth/me`
- [ ] Google OAuth sign-in works
- [ ] Database connection successful (check Vercel logs)
- [ ] Test creating an account and posting an item

### Step 10: Test Automatic Deployments

1. Make a small change (e.g., update README)
2. Commit and push:
   ```bash
   git add .
   git commit -m "Test deployment"
   git push origin main
   ```
3. Check Vercel dashboard - new deployment should start automatically
4. Verify changes appear on production site

## 🔧 Troubleshooting

### OAuth Not Working
- Verify domain matches exactly in Google Cloud Console (include `https://`)
- Check both "Authorized JavaScript origins" and "Authorized redirect URIs"
- Clear browser cache and cookies

### CORS Errors
- Verify `CORS_ORIGINS` environment variable includes production domain
- Check Vercel logs for specific error messages
- Ensure backend project has correct CORS configuration

### Database Connection Failed
- Verify MongoDB Atlas IP whitelist includes `0.0.0.0/0`
- Check connection string format in Vercel environment variables
- Verify database user credentials are correct

### Domain Not Resolving
- Check DNS propagation status using [whatsmydns.net](https://www.whatsmydns.net)
- Verify DNS records in Vercel dashboard
- Wait up to 48 hours for full propagation

### Build Failures
- Check Vercel build logs for specific errors
- Verify all environment variables are set
- Ensure `package.json` and `requirements.txt` are up to date

## 📚 Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [MongoDB Atlas Documentation](https://docs.atlas.mongodb.com/)
- [Google OAuth Setup Guide](https://developers.google.com/identity/protocols/oauth2)

## 🎉 Next Steps

Once deployment is complete:

1. Set up monitoring and error tracking (optional)
2. Configure custom error pages (optional)
3. Set up analytics (optional)
4. Review and optimize performance
5. Set up staging environment (optional)
