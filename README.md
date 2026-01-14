# SwapFlow

A modern, Pinterest-style trading platform where users can swap items without spending money. Built with React, FastAPI, and MongoDB.

## 🎯 Overview

SwapFlow is a full-featured item trading platform that enables users to discover, post, and trade items in a beautiful, intuitive interface. The platform emphasizes community trust through ratings, trade points, and a comprehensive messaging system.

## ✨ Features

### 🔐 Authentication & User Management

- **Google OAuth 2.0 Authentication**: Secure login with Google accounts
- **User Profiles**: 
  - Customizable usernames (single-word format)
  - Profile photos from Google account
  - Trade points display
  - Average rating with review count
  - View all items posted by a user
- **Profile Editing**: Users can edit their own usernames
- **Session Management**: Secure session tokens with automatic authentication checks

### 📦 Item Management

- **Pinterest-Style Masonry Grid**: Beautiful, responsive grid layout for browsing items
- **Item Posting**: 
  - Upload item images (base64 encoding)
  - Add title, description, and category
  - Select from 50 predefined categories
  - Specify desired items for trade (optional)
- **Item Details Page**:
  - Full item information with image
  - Owner profile information
  - Direct messaging and trade initiation
  - View preferred items (if specified)
- **My Items Page**: View and manage all your posted items
- **Item Search**: Search items by title, category, or description
- **Item Deletion**: Owners can delete their own items
- **Item Availability**: Items automatically marked as unavailable after trade completion

### 🏷️ Category System

- **50 Predefined Categories**: 
  - Electronics, Clothing, Books, Furniture, Sports, Toys, Collectibles, Jewelry, Tools, Appliances, Musical Instruments, Art, Home Decor, Kitchenware, Outdoor Gear, Pet Supplies, Baby Items, Games, Movies, Music, Vehicles, Bikes, Computers, Phones, Cameras, Watches, Shoes, Bags, Accessories, Beauty, Health, Fitness, Garden, Office, School, Craft Supplies, Vintage, Antiques, Handmade, Food, Beverages, Plants, Seeds, Tickets, Vouchers, Services, Cards, Coupons, and Other
- **Category Filtering**: Filter items by category with click-based popularity sorting
- **Category Statistics**: View item count and click count per category
- **Dynamic Category Display**: Categories sorted by popularity (click count)

### 💬 Messaging System

- **Real-Time Messaging**: WebSocket-based real-time messaging between users
- **Conversations List**: View all conversations with unread message counts
- **Direct Messaging**: Send messages to item owners or trade partners
- **Message Threads**: Organized conversation threads per user
- **Unread Message Indicators**: Visual indicators for unread messages
- **Message Notifications**: Real-time notifications for new messages
- **Mark as Read**: Automatic and manual message read status updates

### 🔄 Trade Management

- **Trade Initiation**: 
  - Initiate trades from item detail pages
  - Select your item to trade (optional)
  - Both parties can initiate trades
- **Trade Confirmation Flow**:
  - Both parties must confirm trade completion
  - "Trade Finished" button for each party
  - Trade points awarded upon completion
  - Items automatically marked as unavailable after completion
- **Trade Status Tracking**:
  - Active trades (awaiting confirmation)
  - Completed trades
  - Cancelled trades
- **Trade History**: View all your trades (active and completed)
- **Trade Cancellation**: Cancel active trades (before completion)
- **Trade Details**: View full trade information including both items and users

### ⭐ Rating & Reputation System

- **Post-Trade Ratings**: Rate trading partners after completed trades (1-5 stars)
- **Rating Display**: 
  - Average rating shown on user profiles
  - Total number of ratings displayed
  - Visual star rating component
- **Trade Points**: 
  - Earned upon trade completion
  - Displayed on user profiles
  - Track trading activity
- **Reputation Building**: Build trust through successful trades and positive ratings

### 🔔 Notifications

- **Real-Time Notifications**: WebSocket-based notification system
- **Notification Types**:
  - New messages
  - Trade updates
  - System notifications
- **Notification Count**: Unread notification count in header
- **Notification Dismissal**: Dismiss individual notifications

### 👨‍💼 Admin Dashboard

- **Statistics Overview**:
  - Total users (with admin count)
  - Total items (available vs unavailable)
  - Total trades (active vs completed)
  - Total messages
  - Total categories
- **User Management**:
  - View all users with search functionality
  - Promote users to admin
  - Demote admins (restricted to super admin)
  - Delete users
  - View user statistics (trade points, ratings)
- **Item Management**:
  - View all items with search
  - Delete any item
  - View item status and ownership
  - Navigate to item detail pages
- **Category Management**:
  - View all categories with statistics
  - Delete categories
  - View item count and click count per category
- **Trade Management**:
  - View all trades across the platform
  - See trade status and participants
  - View trade history
- **Message Management**:
  - View all messages (paginated)
  - Search and filter messages
  - View message participants
- **Database Reset** (Super Admin Only):
  - Complete database reset functionality
  - Restricted to specific admin email
  - Permanent deletion of all data

### 🎨 User Interface

- **Modern Design**: Clean, Pinterest-inspired interface
- **Responsive Layout**: Works on desktop, tablet, and mobile devices
- **Shadcn/UI Components**: Beautiful, accessible UI components
- **Tailwind CSS**: Utility-first CSS framework
- **Loading States**: Smooth loading indicators throughout
- **Toast Notifications**: User-friendly success/error messages
- **Protected Routes**: Authentication-required pages
- **Admin-Protected Routes**: Admin-only pages

### 🔧 Technical Features

- **Auto-Detection**: 
  - Backend URL auto-detection (localhost vs production)
  - CORS origins auto-configuration
- **Health Checks**: API health check endpoints
- **Error Handling**: Comprehensive error handling and user feedback
- **Image Upload**: Base64 image encoding for item photos
- **WebSocket Support**: Real-time communication for messages and notifications
- **Pagination**: Efficient data loading with pagination support
- **Search Functionality**: Full-text search across items, users, and messages

## 🚀 Quick Start

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

## 🛠️ Tech Stack

- **Frontend**: 
  - React 18
  - React Router v6
  - Tailwind CSS
  - Shadcn/UI components
  - Axios for API calls
  - WebSocket for real-time features
  - Sonner for toast notifications
- **Backend**: 
  - FastAPI (Python)
  - Motor (async MongoDB driver)
  - Google OAuth 2.0
  - WebSocket support
  - CORS middleware
- **Database**: MongoDB (local) / MongoDB Atlas (production)
- **Authentication**: Google OAuth 2.0
- **Deployment**: Vercel (serverless functions)

## 📁 Project Structure

```
├── frontend/          # React frontend application
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/        # Page components
│   │   ├── hooks/        # Custom React hooks
│   │   └── lib/          # Utility functions
│   └── public/        # Static assets
├── backend/           # FastAPI backend server
│   └── server.py      # Main API server
├── memory/            # Project documentation
│   └── PRD.md         # Product Requirements Document
├── SETUP_LOCAL.md    # Setup and deployment documentation
└── README.md         # This file
```

## 🔑 Environment Variables

### Local Development

**Backend** (`backend/.env.local`):
- `MONGO_URL`: MongoDB connection string
- `DB_NAME`: Database name (default: swapflow)
- `GOOGLE_CLIENT_ID`: Google OAuth Client ID
- `CORS_ORIGINS`: Allowed CORS origins (comma-separated)

**Frontend** (`frontend/.env.local`):
- `REACT_APP_BACKEND_URL`: Backend API URL (optional, auto-detected)
- `REACT_APP_GOOGLE_CLIENT_ID`: Google OAuth Client ID

### Production

Set environment variables in Vercel dashboard for both projects.

## 📡 API Endpoints

### Authentication
- `POST /api/auth/google` - Google OAuth login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout

### Users
- `GET /api/users/{user_id}` - Get user profile
- `PUT /api/users/profile` - Update user profile

### Items
- `GET /api/items` - Get all items (with optional category/user filters)
- `GET /api/items/{item_id}` - Get item details
- `POST /api/items` - Create new item
- `DELETE /api/items/{item_id}` - Delete item
- `GET /api/my-items` - Get current user's items

### Categories
- `GET /api/categories` - Get all categories with statistics

### Messages
- `GET /api/conversations` - Get all conversations
- `GET /api/messages/{partner_id}` - Get messages with a user
- `POST /api/messages` - Send a message
- `POST /api/messages/{partner_id}/mark-read` - Mark messages as read
- `GET /api/messages/unread-count` - Get unread message count
- `WebSocket /api/ws/messages` - Real-time messaging

### Trades
- `POST /api/trades` - Create a trade
- `GET /api/trades` - Get user's trades
- `GET /api/trades/{trade_id}` - Get trade details
- `DELETE /api/trades/{trade_id}` - Cancel a trade
- `POST /api/trades/{trade_id}/confirm` - Confirm trade completion
- `POST /api/trades/{trade_id}/rate` - Rate a completed trade

### Notifications
- `GET /api/notifications` - Get user notifications
- `GET /api/notifications/count` - Get unread notification count
- `POST /api/notifications/{notification_id}/dismiss` - Dismiss notification
- `WebSocket /api/ws/notifications` - Real-time notifications

### Admin
- `GET /api/admin/stats` - Get platform statistics
- `GET /api/admin/users` - Get all users
- `POST /api/admin/users/{user_id}/promote` - Promote user to admin
- `POST /api/admin/users/{user_id}/demote` - Demote admin
- `DELETE /api/admin/users/{user_id}` - Delete user
- `GET /api/admin/items` - Get all items
- `DELETE /api/admin/items/{item_id}` - Delete item
- `GET /api/admin/categories` - Get all categories
- `DELETE /api/admin/categories/{category_name}` - Delete category
- `GET /api/admin/trades` - Get all trades
- `GET /api/admin/messages` - Get all messages (paginated)
- `POST /api/admin/reset-database` - Reset entire database (super admin only)

### Upload
- `POST /api/upload` - Upload image (base64)

## 🎯 User Flows

### Posting an Item
1. Navigate to "Post Item" page
2. Upload item image
3. Enter title, description, and select category
4. Optionally specify desired items
5. Submit to post item

### Initiating a Trade
1. Browse items on dashboard
2. Click on an item to view details
3. Click "Start Trade" button
4. Optionally select your item to trade
5. Trade is created and both parties notified

### Completing a Trade
1. Navigate to "Trades" page
2. View active trades
3. Click "Trade Finished" when trade is complete
4. Wait for other party to confirm
5. Upon both confirmations, trade points are awarded
6. Rate your trading partner (optional)

### Messaging
1. Click "Message" on item detail page or trade card
2. Send messages in real-time
3. View conversation history
4. Receive real-time notifications for new messages

## 🔒 Security Features

- Google OAuth 2.0 authentication
- Session token management
- Protected API routes
- Admin role-based access control
- CORS configuration
- Input validation
- Secure image upload handling

## 📝 Contributing

1. Create a feature branch: `git checkout -b feature/new-feature`
2. Make your changes
3. Commit: `git commit -m "Add new feature"`
4. Push: `git push origin feature/new-feature`
5. Create a pull request

## 📄 License

MIT

## 🙏 Acknowledgments

- Built with React, FastAPI, and MongoDB
- UI components from Shadcn/UI
- Icons from Lucide React
- Styling with Tailwind CSS
