from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, UploadFile, File, Depends, WebSocket, WebSocketDisconnect, Body
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import base64
import json
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
import re

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Configure logging FIRST
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Create the main app
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# MongoDB connection - lazy initialization for serverless
_client = None
_db = None

# WebSocket connections - in-memory storage
# Unified WebSocket connection manager
# Maps user_id -> {websocket, channels: set[str]}
# Channels: "messages", "notifications", "trades"
ws_connections: dict[str, dict] = {}

# Report categories
REPORT_CATEGORIES = [
    "Inappropriate Content",
    "Scam/Fraud",
    "Item Not as Described",
    "Harassment",
    "Spam",
    "Other"
]

# Predefined categories (50 categories)
PREDEFINED_CATEGORIES = [
    "electronics", "clothing", "books", "furniture", "sports", "toys", "collectibles",
    "jewelry", "tools", "appliances", "musical-instruments", "art", "home-decor",
    "kitchenware", "outdoor-gear", "pet-supplies", "baby-items", "games", "movies",
    "music", "vehicles", "bikes", "computers", "phones", "cameras", "watches",
    "shoes", "bags", "accessories", "beauty", "health", "fitness", "garden",
    "office", "school", "craft-supplies", "vintage", "antiques", "handmade",
    "food", "beverages", "plants", "seeds", "tickets", "vouchers", "services",
    "cards", "coupons", "other"
]

def get_db():
    """Get MongoDB database connection (lazy initialization)"""
    global _client, _db
    
    if _db is not None:
        return _db
    
    mongo_url = os.environ.get('MONGO_URL')
    db_name = os.environ.get('DB_NAME', 'swapflow')
    
    if not mongo_url:
        raise ValueError("MONGO_URL environment variable is not set. Please configure it in Vercel.")
    
    try:
        # Configure SSL for MongoDB Atlas - allow invalid certificates for local dev
        # In production, use proper SSL certificates
        _client = AsyncIOMotorClient(
            mongo_url, 
            serverSelectionTimeoutMS=10000,
            connectTimeoutMS=10000,
            socketTimeoutMS=10000,
            tlsAllowInvalidCertificates=True  # For local dev - allows connection without proper SSL certs
        )
        _db = _client[db_name]
        logger.info(f"Connected to MongoDB database: {db_name}")
        return _db
    except Exception as e:
        logger.error(f"Failed to connect to MongoDB: {str(e)}")
        raise

# Log environment variable status (without exposing secrets)
mongo_url_env = os.environ.get('MONGO_URL', '')
mongo_url_masked = re.sub(r'://([^:]+):([^@]+)@', r'://\1:***@', mongo_url_env) if mongo_url_env else 'NOT_SET'
mongo_url_host = re.search(r'@([^/]+)', mongo_url_env) if mongo_url_env else None
mongo_url_host_str = mongo_url_host.group(1) if mongo_url_host else 'UNKNOWN'
logger.info(f"MONGO_URL configured: {bool(mongo_url_env)}")
logger.info(f"MONGO_URL host: {mongo_url_host_str}")
logger.info(f"DB_NAME: {os.environ.get('DB_NAME', 'swapflow')}")
logger.info(f"GOOGLE_CLIENT_ID configured: {bool(os.environ.get('GOOGLE_CLIENT_ID'))}")
logger.info(f"CORS_ORIGINS: {os.environ.get('CORS_ORIGINS', 'default')}")

# Initialize db on first access (for backward compatibility)
class DatabaseProxy:
    def __getattr__(self, name):
        db = get_db()
        return getattr(db, name)

db = DatabaseProxy()

# ============== MODELS ==============

class User(BaseModel):
    user_id: str
    email: str
    name: str
    username: Optional[str] = None
    picture: Optional[str] = None
    trade_points: int = 0
    rating: Optional[float] = None
    rating_count: int = 0
    is_admin: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserUpdate(BaseModel):
    username: Optional[str] = None
    picture: Optional[str] = None

class Item(BaseModel):
    item_id: str = Field(default_factory=lambda: f"item_{uuid.uuid4().hex[:12]}")
    user_id: str
    title: str
    description: Optional[str] = None
    image: str
    category: str
    is_available: bool = True
    desired_category: Optional[str] = None
    desired_item_ids: Optional[List[str]] = None
    view_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ItemCreate(BaseModel):
    title: str
    description: Optional[str] = None
    image: str
    category: str
    desired_category: Optional[str] = None
    desired_item_ids: Optional[List[str]] = None

class Category(BaseModel):
    name: str
    click_count: int = 0

class Message(BaseModel):
    message_id: str = Field(default_factory=lambda: f"msg_{uuid.uuid4().hex[:12]}")
    trade_id: str  # Required, links message to specific trade
    sender_id: str
    receiver_id: str
    message_type: str = "text"  # "text", "item_request", "item_added", "item_removed"
    item_request_data: Optional[dict] = None  # For item request messages: {"item_id": str, "side": "owner"|"trader", "status": "pending"|"accepted"|"declined", "request_id": str}
    content: str
    read_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expires_at: Optional[datetime] = None  # Set to 24 hours after trade completion

class MessageCreate(BaseModel):
    trade_id: str
    content: str

class Trade(BaseModel):
    trade_id: str = Field(default_factory=lambda: f"trade_{uuid.uuid4().hex[:12]}")
    owner_item_ids: List[str] = Field(default_factory=list)
    trader_item_ids: List[str] = Field(default_factory=list)
    pending_owner_items: List[str] = Field(default_factory=list)
    pending_trader_items: List[str] = Field(default_factory=list)
    owner_id: str
    trader_id: str
    owner_confirmed: bool = False
    trader_confirmed: bool = False
    is_completed: bool = False
    is_cancelled: bool = False
    cancelled_at: Optional[datetime] = None
    cancelled_by: Optional[str] = None
    owner_rating: Optional[int] = None
    trader_rating: Optional[int] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None
    max_items_per_side: int = 5

class TradeCreate(BaseModel):
    owner_item_ids: List[str]
    trader_item_ids: List[str]

class RatingCreate(BaseModel):
    rating: int

class BugReport(BaseModel):
    bug_id: str = Field(default_factory=lambda: f"bug_{uuid.uuid4().hex[:12]}")
    user_id: str
    title: str
    description: str
    steps_to_reproduce: str
    is_valid: bool = False
    is_resolved: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    validated_at: Optional[datetime] = None
    validated_by: Optional[str] = None

class BugReportCreate(BaseModel):
    title: str
    description: str
    steps_to_reproduce: str

class Report(BaseModel):
    report_id: str = Field(default_factory=lambda: f"report_{uuid.uuid4().hex[:12]}")
    reporter_id: str
    report_type: str  # "item", "user", or "trade"
    reported_item_id: Optional[str] = None
    reported_user_id: Optional[str] = None
    reported_trade_id: Optional[str] = None
    category: str
    description: str
    status: str = "pending"  # "pending", "resolved", "dismissed"
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    resolved_at: Optional[datetime] = None
    resolved_by: Optional[str] = None
    action_taken: Optional[str] = None  # e.g., "item_removed", "user_banned", "dismissed"

class ReportCreate(BaseModel):
    report_type: str
    reported_item_id: Optional[str] = None
    reported_user_id: Optional[str] = None
    reported_trade_id: Optional[str] = None
    category: str
    description: str

class Notification(BaseModel):
    notification_id: str = Field(default_factory=lambda: f"notif_{uuid.uuid4().hex[:12]}")
    user_id: str
    type: str  # e.g., "trade_cancelled", "item_deleted", etc.
    message: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    read_at: Optional[datetime] = None
    data: Optional[dict] = None  # Optional JSON for additional context

# ============== AUTH HELPERS ==============

async def get_current_user(request: Request) -> User:
    """Get current user from session token in cookie or Authorization header"""
    session_token = request.cookies.get("session_token")
    
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    # Update last activity timestamp for this session
    await db.user_sessions.update_one(
        {"session_token": session_token},
        {"$set": {"last_accessed": datetime.now(timezone.utc).isoformat()}}
    )
    
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    # Ensure is_admin field is present for backward compatibility
    if "is_admin" not in user:
        user["is_admin"] = False
    
    return User(**user)

async def get_optional_user(request: Request) -> Optional[User]:
    """Get current user if authenticated, otherwise return None"""
    try:
        return await get_current_user(request)
    except HTTPException:
        return None

async def get_admin_user(request: Request) -> User:
    """Get current user and verify they are an admin"""
    user = await get_current_user(request)
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

# ============== HELPER FUNCTIONS ==============

async def send_ws_message(user_id: str, channel: str, message_type: str, data: dict):
    """Send a message to a user via WebSocket on a specific channel"""
    if user_id not in ws_connections:
        return False
    
    connection = ws_connections[user_id]
    if channel not in connection.get("channels", set()):
        return False
    
    try:
        await connection["websocket"].send_text(json.dumps({
            "channel": channel,
            "type": message_type,
            "data": data
        }))
        return True
    except Exception as e:
        logger.error(f"Failed to send WebSocket message to {user_id}: {str(e)}")
        # Remove broken connection
        ws_connections.pop(user_id, None)
        return False

async def broadcast_ws_message(user_ids: list[str], channel: str, message_type: str, data: dict):
    """Broadcast a message to multiple users via WebSocket"""
    for user_id in user_ids:
        await send_ws_message(user_id, channel, message_type, data)

async def create_and_send_notification(user_id: str, notification_type: str, message: str, data: Optional[dict] = None):
    """Create a notification and send it via WebSocket if user is connected"""
    notification = Notification(
        user_id=user_id,
        type=notification_type,
        message=message,
        data=data
    )
    
    notification_dict = notification.model_dump()
    notification_dict["created_at"] = notification_dict["created_at"].isoformat()
    
    # Insert notification into database
    insert_dict = notification_dict.copy()
    await db.notifications.insert_one(insert_dict)
    
    # Send via WebSocket if user is connected
    await send_ws_message(
        user_id=user_id,
        channel="notifications",
        message_type="new_notification",
        data={"notification": notification_dict}
    )
    
    return notification_dict

# ============== AUTH ENDPOINTS ==============

@api_router.post("/auth/google")
async def google_auth(request: Request, response: Response):
    """Authenticate with Google OAuth ID token"""
    body = await request.json()
    credential = body.get("credential")  # Google ID token
    
    if not credential:
        raise HTTPException(status_code=400, detail="Credential required")
    
    try:
        # Verify the Google ID token
        GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID')
        if not GOOGLE_CLIENT_ID:
            raise HTTPException(status_code=500, detail="GOOGLE_CLIENT_ID not configured")
        
        idinfo = id_token.verify_oauth2_token(
            credential, 
            google_requests.Request(), 
            GOOGLE_CLIENT_ID
        )
        
        # Extract user info
        email = idinfo['email']
        name = idinfo.get('name', '')
        picture = idinfo.get('picture')
        
    except ValueError as e:
        raise HTTPException(status_code=401, detail="Invalid Google token")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Authentication error: {str(e)}")
    
    # Check if user exists
    try:
        existing_user = await db.users.find_one({"email": email}, {"_id": 0})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    
    # Check for admin email auto-promotion
    admin_email = "homemail192@gmail.com"
    admin_email_domain = os.environ.get('ADMIN_EMAIL_DOMAIN', '').strip()
    is_admin = False
    # Check specific email first
    if email.lower() == admin_email.lower():
        is_admin = True
    # Also check domain if configured
    elif admin_email_domain and email.endswith(f'@{admin_email_domain}'):
        is_admin = True
    
    if existing_user:
        user_id = existing_user["user_id"]
        # Update user info if needed, and check if admin status should be updated
        update_data = {
            "name": name,
            "picture": picture
        }
        # If email domain matches and user isn't already admin, promote them
        if is_admin and not existing_user.get("is_admin", False):
            update_data["is_admin"] = True
        
        try:
            await db.users.update_one(
                {"user_id": user_id},
                {"$set": update_data}
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    else:
        # Create new user
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        new_user = {
            "user_id": user_id,
            "email": email,
            "name": name,
            "username": None,
            "picture": picture,
            "trade_points": 0,
            "rating": None,
            "rating_count": 0,
            "is_admin": is_admin,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        try:
            await db.users.insert_one(new_user)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    
    # Create session
    session_token = f"sess_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    try:
        await db.user_sessions.insert_one({
            "user_id": user_id,
            "session_token": session_token,
            "expires_at": expires_at.isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    
    # Set cookie - for cross-origin, we need samesite="none" and secure=True
    # Don't set domain to allow browser to handle it automatically
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7*24*60*60
        # Explicitly NOT setting domain - let browser handle it
    )
    
    # Get user data
    try:
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    
    return {"user": user, "session_token": session_token}

@api_router.get("/auth/me")
async def get_me(user: User = Depends(get_current_user)):
    """Get current authenticated user"""
    return user.model_dump()

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout user and clear session"""
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out successfully"}

# ============== USER ENDPOINTS ==============

@api_router.get("/users/{user_id}")
async def get_user(user_id: str):
    """Get user profile by ID"""
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    # Ensure is_admin field is present for backward compatibility
    if "is_admin" not in user:
        user["is_admin"] = False
    return user

@api_router.put("/users/profile")
async def update_profile(update: UserUpdate, user: User = Depends(get_current_user)):
    """Update current user's profile"""
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    
    if "username" in update_data:
        # Validate username is single word
        username = update_data["username"].strip()
        if " " in username:
            raise HTTPException(status_code=400, detail="Username must be a single word")
        # Check if username is taken
        existing = await db.users.find_one({"username": username, "user_id": {"$ne": user.user_id}}, {"_id": 0})
        if existing:
            raise HTTPException(status_code=400, detail="Username already taken")
        update_data["username"] = username
    
    if update_data:
        await db.users.update_one(
            {"user_id": user.user_id},
            {"$set": update_data}
        )
    
    updated_user = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    return updated_user

# ============== ITEM ENDPOINTS ==============

@api_router.get("/items/sync")
async def get_items_sync(cached_ids: Optional[str] = None):
    """
    Lightweight sync endpoint: returns only item IDs and timestamps for cache validation.
    Accepts comma-separated list of cached item IDs to compare against.
    Returns: { item_ids: [id1, id2, ...], removed_ids: [id3, ...] }
    """
    query = {"is_available": True}
    items_cursor = db.items.find(query, {"_id": 0, "item_id": 1, "created_at": 1}).sort("created_at", -1)
    items = await items_cursor.to_list(1000)  # Get all for sync comparison
    
    current_ids = {item["item_id"] for item in items}
    
    # If client provided cached IDs, find what's new/removed
    removed_ids = []
    if cached_ids:
        cached_id_set = set(cached_ids.split(","))
        removed_ids = list(cached_id_set - current_ids)
    
    # Return lightweight response: just IDs and timestamps
    return {
        "item_ids": [item["item_id"] for item in items],
        "removed_ids": removed_ids,
        "count": len(items)
    }

@api_router.get("/items")
async def get_items(category: Optional[str] = None, user_id: Optional[str] = None, include_owners: bool = False, sort_by_views: bool = False, limit: Optional[int] = None, item_ids: Optional[str] = None):
    """
    Get all available items, optionally filtered by category or user.
    If item_ids is provided (comma-separated), only fetch those specific items (for incremental updates).
    """
    query = {"is_available": True}
    requested_ids = None
    
    # If specific item IDs requested, fetch only those (for incremental sync)
    if item_ids:
        requested_ids = [id.strip() for id in item_ids.split(",") if id.strip()]
        query["item_id"] = {"$in": requested_ids}
    elif category:
        query["category"] = category
        # Increment category click count
        await db.categories.update_one(
            {"name": category},
            {"$inc": {"click_count": 1}},
            upsert=True
        )
    
    if user_id:
        query["user_id"] = user_id
    
    # Sort by view_count if requested, otherwise by created_at
    sort_field = "view_count" if sort_by_views else "created_at"
    sort_direction = -1
    
    items_cursor = db.items.find(query, {"_id": 0}).sort(sort_field, sort_direction)
    
    if item_ids:
        # Fetch specific items - no limit needed
        items = await items_cursor.to_list(len(requested_ids))
    elif limit:
        items = await items_cursor.to_list(limit)
    else:
        items = await items_cursor.to_list(100)
    
    # Convert datetime strings if needed
    for item in items:
        if isinstance(item.get("created_at"), str):
            item["created_at"] = datetime.fromisoformat(item["created_at"])
    
    # If include_owners is true, bulk fetch owners
    if include_owners:
        owner_ids = list(set(item["user_id"] for item in items))
        owners_dict = {}
        if owner_ids:
            owners_cursor = db.users.find({"user_id": {"$in": owner_ids}}, {"_id": 0, "user_id": 1, "name": 1, "username": 1, "picture": 1})
            async for owner in owners_cursor:
                owners_dict[owner["user_id"]] = owner
        
        # Add owner info to each item
        for item in items:
            item["owner"] = owners_dict.get(item["user_id"])
    
    return items

@api_router.get("/items/{item_id}")
async def get_item(item_id: str):
    """Get item by ID"""
    item = await db.items.find_one({"item_id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Increment view count
    await db.items.update_one(
        {"item_id": item_id},
        {"$inc": {"view_count": 1}},
        upsert=False
    )
    item["view_count"] = item.get("view_count", 0) + 1
    
    # Get owner info
    owner = await db.users.find_one({"user_id": item["user_id"]}, {"_id": 0})
    
    return {"item": item, "owner": owner}

@api_router.post("/items")
async def create_item(item_data: ItemCreate, user: User = Depends(get_current_user)):
    """Create a new item for trade"""
    # Validate category is one of the predefined categories
    category = item_data.category.strip().lower()
    if category not in PREDEFINED_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Category must be one of the predefined categories: {', '.join(PREDEFINED_CATEGORIES)}")
    
    item = Item(
        user_id=user.user_id,
        title=item_data.title,
        description=item_data.description,
        image=item_data.image,
        category=category,
        desired_category=item_data.desired_category,
        desired_item_ids=item_data.desired_item_ids
    )
    
    item_dict = item.model_dump()
    item_dict["created_at"] = item_dict["created_at"].isoformat()
    # Ensure desired_item_ids is stored as list or None
    if item_dict.get("desired_item_ids") is not None and not isinstance(item_dict["desired_item_ids"], list):
        item_dict["desired_item_ids"] = None
    
    # Create a copy for insertion to avoid _id contamination
    insert_dict = item_dict.copy()
    await db.items.insert_one(insert_dict)
    
    return item_dict

@api_router.delete("/items/{item_id}")
async def delete_item(item_id: str, user: User = Depends(get_current_user)):
    """Delete an item (only owner can delete)"""
    item = await db.items.find_one({"item_id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if item["user_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Find all active trades involving this item (check both old and new format)
    active_trades = await db.trades.find({
        "$or": [
            {"item_id": item_id, "is_completed": False, "is_cancelled": False},
            {"trader_item_id": item_id, "is_completed": False, "is_cancelled": False},
            {"owner_item_ids": item_id, "is_completed": False, "is_cancelled": False},
            {"trader_item_ids": item_id, "is_completed": False, "is_cancelled": False}
        ]
    }, {"_id": 0}).to_list(100)
    
    # Cancel trades and create notifications
    for trade in active_trades:
        # Determine the other party
        other_user_id = trade["trader_id"] if trade["owner_id"] == user.user_id else trade["owner_id"]
        
        # Get other user's info for notification
        other_user = await db.users.find_one({"user_id": other_user_id}, {"_id": 0})
        other_user_name = other_user.get("username") or other_user.get("name", "User") if other_user else "User"
        
        # Cancel the trade
        await db.trades.update_one(
            {"trade_id": trade["trade_id"]},
            {"$set": {
                "is_cancelled": True,
                "cancelled_at": datetime.now(timezone.utc).isoformat(),
                "cancelled_by": user.user_id
            }}
        )
        
        # Delete all messages for this trade
        await db.messages.delete_many({"trade_id": trade["trade_id"]})
        
        # Create notification for the other party
        message = f"Your trade with {other_user_name} was canceled because {user.name} removed an item."
        await create_and_send_notification(
            user_id=other_user_id,
            notification_type="trade_cancelled",
            message=message,
            data={"trade_id": trade["trade_id"], "item_id": item_id}
        )
    
    await db.items.delete_one({"item_id": item_id})
    return {"message": "Item deleted", "trades_cancelled": len(active_trades)}

@api_router.get("/my-items")
async def get_my_items(user: User = Depends(get_current_user)):
    """Get current user's items"""
    items = await db.items.find({"user_id": user.user_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return items

# ============== CATEGORY ENDPOINTS ==============

@api_router.get("/categories")
async def get_categories(include_all: bool = False):
    """Get categories. If include_all=True, returns all predefined categories. Otherwise, returns only categories with items."""
    if include_all:
        # Return all predefined categories, sorted alphabetically for stability
        return [{"name": cat, "item_count": 0} for cat in sorted(PREDEFINED_CATEGORIES)]
    
    # Get all available items and count by category
    pipeline = [
        {"$match": {"is_available": True}},
        {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    category_counts = await db.items.aggregate(pipeline).to_list(100)
    
    # Create a dict for quick lookup
    counts_dict = {cat_data["_id"]: cat_data["count"] for cat_data in category_counts}
    
    # Return categories with their counts, only if they're in predefined list
    # Sort alphabetically for stable order (not by count which can change)
    result = []
    for category_name in sorted(PREDEFINED_CATEGORIES):
        if category_name in counts_dict:
            result.append({
                "name": category_name,
                "item_count": counts_dict[category_name]
            })
    
    return result

@api_router.delete("/admin/categories/{category_name}")
async def admin_delete_category(category_name: str, admin: User = Depends(get_admin_user)):
    """Delete a category (admin only)"""
    category = await db.categories.find_one({"name": category_name}, {"_id": 0})
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    # Delete the category
    await db.categories.delete_one({"name": category_name})
    
    # Note: Items with this category will still have the category field, but the category won't appear in the categories list
    # Optionally, you could update all items to remove the category or set it to "uncategorized"
    
    return {"message": "Category deleted"}

@api_router.get("/admin/categories")
async def admin_get_categories(admin: User = Depends(get_admin_user)):
    """Get all categories with item counts (admin only)"""
    categories = await db.categories.find({}, {"_id": 0}).sort("click_count", -1).to_list(100)
    
    # Add item count for each category
    result = []
    for cat in categories:
        item_count = await db.items.count_documents({"category": cat["name"]})
        result.append({
            **cat,
            "item_count": item_count
        })
    
    return result

# ============== MESSAGE ENDPOINTS ==============

@api_router.get("/conversations")
async def get_conversations(user: User = Depends(get_current_user)):
    """Get all trade-based conversations for current user"""
    # Get all trades user is involved in
    trades = await db.trades.find({
        "$or": [{"owner_id": user.user_id}, {"trader_id": user.user_id}],
        "is_cancelled": False
    }, {"_id": 0, "trade_id": 1, "owner_id": 1, "trader_id": 1, "is_completed": 1, "created_at": 1}).to_list(100)
    
    if not trades:
        return []
    
    trade_ids = [trade["trade_id"] for trade in trades]
    
    # Bulk fetch last messages for all trades using aggregation (only trades with messages)
    last_messages_pipeline = [
        {"$match": {"trade_id": {"$in": trade_ids}}},
        {"$sort": {"created_at": -1}},
        {"$group": {
            "_id": "$trade_id",
            "content": {"$first": "$content"},
            "created_at": {"$first": "$created_at"},
            "message_type": {"$first": "$message_type"}
        }}
    ]
    last_messages = {}
    async for msg in db.messages.aggregate(last_messages_pipeline):
        last_messages[msg["_id"]] = msg
    
    # Bulk fetch unread counts using aggregation
    unread_counts_pipeline = [
        {"$match": {
            "trade_id": {"$in": trade_ids},
            "receiver_id": user.user_id,
            "read_at": None
        }},
        {"$group": {
            "_id": "$trade_id",
            "count": {"$sum": 1}
        }}
    ]
    unread_counts = {}
    async for count_doc in db.messages.aggregate(unread_counts_pipeline):
        unread_counts[count_doc["_id"]] = count_doc["count"]
    
    # Collect partner IDs
    partner_ids = set()
    for trade in trades:
        partner_id = trade["trader_id"] if trade["owner_id"] == user.user_id else trade["owner_id"]
        partner_ids.add(partner_id)
    
    # Bulk fetch partners
    partners_dict = {}
    if partner_ids:
        partners_cursor = db.users.find({"user_id": {"$in": list(partner_ids)}}, {"_id": 0})
        async for partner in partners_cursor:
            partners_dict[partner["user_id"]] = partner
    
    # Cleanup expired messages once (not per trade)
    completed_trade_ids = [t["trade_id"] for t in trades if t.get("is_completed")]
    if completed_trade_ids:
        now = datetime.now(timezone.utc)
        await db.messages.delete_many({
            "trade_id": {"$in": completed_trade_ids},
            "expires_at": {"$lt": now.isoformat()}
        })
    
    # Build result - include ALL trades, even those without messages
    result = []
    for trade in trades:
        trade_id = trade["trade_id"]
        partner_id = trade["trader_id"] if trade["owner_id"] == user.user_id else trade["owner_id"]
        partner = partners_dict.get(partner_id)
        
        if partner:
            last_msg = last_messages.get(trade_id, {})
            # If no messages, use trade creation time for sorting
            last_message_time = last_msg.get("created_at") or trade.get("created_at")
            result.append({
                "trade_id": trade_id,
                "partner": partner,
                "last_message": last_msg.get("content"),
                "last_message_time": last_message_time,
                "unread_count": unread_counts.get(trade_id, 0),
                "is_completed": trade.get("is_completed", False)
            })
    
    # Sort by last message time (or trade creation time if no messages)
    result.sort(key=lambda x: x["last_message_time"] or "", reverse=True)
    
    return result

@api_router.get("/messages/unread-count")
async def get_unread_count(user: User = Depends(get_current_user)):
    """Get total unread message count for current user"""
    # Get all trades user is involved in
    trades = await db.trades.find({
        "$or": [{"owner_id": user.user_id}, {"trader_id": user.user_id}]
    }, {"_id": 0, "trade_id": 1}).to_list(100)
    
    trade_ids = [t["trade_id"] for t in trades]
    
    count = await db.messages.count_documents({
        "trade_id": {"$in": trade_ids},
        "receiver_id": user.user_id,
        "read_at": None
    })
    return {"unread_count": count}

@api_router.post("/messages/{trade_id}/mark-read")
async def mark_messages_read(trade_id: str, user: User = Depends(get_current_user)):
    """Mark all messages in a trade as read"""
    # Verify user is part of the trade
    trade = await db.trades.find_one({"trade_id": trade_id}, {"_id": 0})
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    
    if trade["owner_id"] != user.user_id and trade["trader_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = await db.messages.update_many(
        {
            "trade_id": trade_id,
            "receiver_id": user.user_id,
            "read_at": None
        },
        {
            "$set": {"read_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    return {"message": "Messages marked as read", "updated_count": result.modified_count}

async def cleanup_expired_messages(trade_id: str):
    """Delete messages that have expired (24 hours after trade completion)"""
    trade = await db.trades.find_one({"trade_id": trade_id}, {"_id": 0})
    if not trade or not trade.get("is_completed"):
        return
    
    # Delete expired messages
    now = datetime.now(timezone.utc)
    result = await db.messages.delete_many({
        "trade_id": trade_id,
        "expires_at": {"$lt": now.isoformat()}
    })
    return result.deleted_count

@api_router.get("/messages/{trade_id}")
async def get_messages(trade_id: str, user: User = Depends(get_current_user)):
    """Get messages for a specific trade"""
    # Verify user is part of the trade
    trade = await db.trades.find_one({"trade_id": trade_id}, {"_id": 0})
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    
    # Migrate if needed
    trade = await migrate_trade_to_array_format(trade)
    
    if trade["owner_id"] != user.user_id and trade["trader_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Cleanup expired messages
    await cleanup_expired_messages(trade_id)
    
    # Get messages for this trade
    messages = await db.messages.find({
        "trade_id": trade_id
    }, {"_id": 0}).sort("created_at", 1).to_list(100)
    
    return messages

@api_router.post("/messages")
async def send_message(msg: MessageCreate, user: User = Depends(get_current_user)):
    """Send a message in a trade"""
    # Verify user is part of the trade
    trade = await db.trades.find_one({"trade_id": msg.trade_id}, {"_id": 0})
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    
    # Migrate if needed
    trade = await migrate_trade_to_array_format(trade)
    
    if trade["owner_id"] != user.user_id and trade["trader_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Determine receiver (the other party)
    receiver_id = trade["trader_id"] if trade["owner_id"] == user.user_id else trade["owner_id"]
    
    message = Message(
        trade_id=msg.trade_id,
        sender_id=user.user_id,
        receiver_id=receiver_id,
        message_type="text",
        content=msg.content,
        read_at=None
    )
    
    msg_dict = message.model_dump()
    msg_dict["created_at"] = msg_dict["created_at"].isoformat()
    
    # Create a copy for insertion to avoid _id contamination
    insert_dict = msg_dict.copy()
    await db.messages.insert_one(insert_dict)
    
    # Broadcast to WebSocket connections
    await broadcast_ws_message(
        user_ids=[user.user_id, receiver_id],
        channel="messages",
        message_type="new_message",
        data={"message": msg_dict}
    )
    
    return msg_dict

@api_router.websocket("/ws")
async def websocket_handler(websocket: WebSocket):
    """Unified WebSocket endpoint for all real-time communication"""
    await websocket.accept()
    user_id = None
    
    try:
        # Get authentication token
        token = websocket.query_params.get("token") or websocket.headers.get("authorization", "").replace("Bearer ", "")
        
        if not token:
            await websocket.close(code=1008, reason="Authentication required")
            return
        
        # Validate session
        session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
        if not session:
            await websocket.close(code=1008, reason="Invalid session")
            return
        
        user_id = session["user_id"]
        
        # Get requested channels from query params (default to all)
        channels_param = websocket.query_params.get("channels", "messages,notifications,trades")
        channels = set(ch.strip() for ch in channels_param.split(",") if ch.strip())
        
        # Store connection
        ws_connections[user_id] = {
            "websocket": websocket,
            "channels": channels
        }
        
        # Send connection confirmation
        await websocket.send_text(json.dumps({
            "channel": "system",
            "type": "connected",
            "data": {"user_id": user_id, "channels": list(channels)}
        }))
        
        # Keep connection alive and handle incoming messages
        while True:
            try:
                data = await websocket.receive_text()
                # Handle ping/pong for keepalive
                if data == "ping":
                    await websocket.send_text("pong")
                # Could handle other client messages here if needed
            except WebSocketDisconnect:
                break
            
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"WebSocket error for user {user_id}: {str(e)}")
    finally:
        if user_id:
            ws_connections.pop(user_id, None)
        try:
            await websocket.close()
        except:
            pass

# ============== NOTIFICATION ENDPOINTS ==============

@api_router.get("/notifications")
async def get_notifications(user: User = Depends(get_current_user)):
    """Get all notifications for current user (sorted by created_at desc)"""
    notifications = await db.notifications.find(
        {"user_id": user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return notifications

@api_router.get("/notifications/count")
async def get_notification_count(user: User = Depends(get_current_user)):
    """Get unread notification count for current user"""
    count = await db.notifications.count_documents({
        "user_id": user.user_id,
        "read_at": None
    })
    return {"count": count}

@api_router.post("/notifications/mark-read")
async def mark_all_notifications_read(user: User = Depends(get_current_user)):
    """Mark all unread notifications for the current user as read"""
    await db.notifications.update_many(
        {"user_id": user.user_id, "read_at": None},
        {"$set": {"read_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "All notifications marked as read"}

@api_router.post("/notifications/{notification_id}/dismiss")
async def dismiss_notification(notification_id: str, user: User = Depends(get_current_user)):
    """Dismiss/remove a notification"""
    notification = await db.notifications.find_one({"notification_id": notification_id}, {"_id": 0})
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    if notification["user_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.notifications.delete_one({"notification_id": notification_id})
    return {"message": "Notification dismissed"}


# ============== TRADE ENDPOINTS ==============

@api_router.post("/trades")
async def create_trade(trade_data: TradeCreate, user: User = Depends(get_current_user)):
    """Initiate a trade with multiple items"""
    # Validate arrays are not empty
    if not trade_data.owner_item_ids or not trade_data.trader_item_ids:
        raise HTTPException(status_code=400, detail="Both owner and trader must have at least one item")
    
    # Validate max items per side
    max_items = 5
    if len(trade_data.owner_item_ids) > max_items or len(trade_data.trader_item_ids) > max_items:
        raise HTTPException(status_code=400, detail=f"Maximum {max_items} items per side allowed")
    
    # Validate all owner items exist and are available
    owner_items = []
    for item_id in trade_data.owner_item_ids:
        item = await db.items.find_one({"item_id": item_id, "is_available": True}, {"_id": 0})
        if not item:
            raise HTTPException(status_code=404, detail=f"Item {item_id} not found or not available")
        owner_items.append(item)
    
    # Validate all trader items exist, are available, and belong to trader
    trader_items = []
    for item_id in trade_data.trader_item_ids:
        item = await db.items.find_one({"item_id": item_id, "is_available": True}, {"_id": 0})
        if not item:
            raise HTTPException(status_code=404, detail=f"Item {item_id} not found or not available")
        if item["user_id"] != user.user_id:
            raise HTTPException(status_code=403, detail=f"You can only trade with your own items")
        trader_items.append(item)
    
    # Get owner_id from first owner item
    owner_id = owner_items[0]["user_id"]
    
    # Can't trade with yourself
    if owner_id == user.user_id:
        raise HTTPException(status_code=400, detail="Cannot trade with yourself")
    
    # Check if all items belong to the same owner
    for item in owner_items:
        if item["user_id"] != owner_id:
            raise HTTPException(status_code=400, detail="All owner items must belong to the same user")
    
    # Check if trade already exists (same items, same users)
    existing_trade = await db.trades.find_one({
        "owner_item_ids": {"$all": trade_data.owner_item_ids, "$size": len(trade_data.owner_item_ids)},
        "trader_item_ids": {"$all": trade_data.trader_item_ids, "$size": len(trade_data.trader_item_ids)},
        "owner_id": owner_id,
        "trader_id": user.user_id,
        "is_completed": False,
        "is_cancelled": False
    }, {"_id": 0})
    
    if existing_trade:
        existing_trade = await migrate_trade_to_array_format(existing_trade)
        return existing_trade
    
    trade = Trade(
        owner_item_ids=trade_data.owner_item_ids,
        trader_item_ids=trade_data.trader_item_ids,
        owner_id=owner_id,
        trader_id=user.user_id
    )
    
    trade_dict = trade.model_dump()
    trade_dict["created_at"] = trade_dict["created_at"].isoformat()
    
    # Create a copy for insertion to avoid _id contamination
    insert_dict = trade_dict.copy()
    await db.trades.insert_one(insert_dict)
    
    # Create notification for the item owner
    trader_user = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    trader_name = trader_user.get("username") or trader_user.get("name", "Someone") if trader_user else "Someone"
    
    item_titles = ", ".join([item["title"] for item in owner_items[:2]])
    if len(owner_items) > 2:
        item_titles += f" and {len(owner_items) - 2} more"
    
    notification_message = f"{trader_name} initiated a trade with you for {item_titles}"
    await create_and_send_notification(
        user_id=owner_id,
        notification_type="trade_initiated",
        message=notification_message,
        data={"trade_id": trade_dict["trade_id"]}
    )
    
    return trade_dict

async def migrate_trade_to_array_format(trade: dict) -> dict:
    """Migrate old trade format (item_id, trader_item_id) to new format (arrays)"""
    if "owner_item_ids" in trade and "trader_item_ids" in trade:
        return trade  # Already migrated
    
    # Migrate old format
    owner_item_ids = []
    trader_item_ids = []
    
    if trade.get("item_id"):
        owner_item_ids = [trade["item_id"]]
    if trade.get("trader_item_id"):
        trader_item_ids = [trade["trader_item_id"]]
    
    # Update the trade in database
    await db.trades.update_one(
        {"trade_id": trade["trade_id"]},
        {
            "$set": {
                "owner_item_ids": owner_item_ids,
                "trader_item_ids": trader_item_ids,
                "pending_owner_items": [],
                "pending_trader_items": [],
                "max_items_per_side": 5
            },
            "$unset": {
                "item_id": "",
                "trader_item_id": ""
            }
        }
    )
    
    # Return updated trade
    trade["owner_item_ids"] = owner_item_ids
    trade["trader_item_ids"] = trader_item_ids
    trade["pending_owner_items"] = []
    trade["pending_trader_items"] = []
    trade["max_items_per_side"] = 5
    if "item_id" in trade:
        del trade["item_id"]
    if "trader_item_id" in trade:
        del trade["trader_item_id"]
    
    return trade

@api_router.get("/trades")
async def get_my_trades(user: User = Depends(get_current_user)):
    """Get all trades for current user"""
    trades = await db.trades.find({
        "$or": [{"owner_id": user.user_id}, {"trader_id": user.user_id}]
    }, {"_id": 0}).sort("created_at", -1).to_list(50)
    
    # Collect all item IDs and user IDs for bulk fetching
    all_item_ids = set()
    user_ids = set()
    migrated_trades = []
    
    for trade in trades:
        # Migrate if needed
        trade = await migrate_trade_to_array_format(trade)
        migrated_trades.append(trade)
        
        # Collect item IDs
        for item_id in trade.get("owner_item_ids", []):
            all_item_ids.add(item_id)
        for item_id in trade.get("trader_item_ids", []):
            all_item_ids.add(item_id)
        
        # Collect user IDs
        user_ids.add(trade["owner_id"])
        user_ids.add(trade["trader_id"])
    
    # Bulk fetch all items
    items_dict = {}
    if all_item_ids:
        items_cursor = db.items.find({"item_id": {"$in": list(all_item_ids)}}, {"_id": 0})
        async for item in items_cursor:
            items_dict[item["item_id"]] = item
    
    # Bulk fetch all users
    users_dict = {}
    if user_ids:
        users_cursor = db.users.find({"user_id": {"$in": list(user_ids)}}, {"_id": 0})
        async for user_doc in users_cursor:
            users_dict[user_doc["user_id"]] = user_doc
    
    # Build result
    result = []
    for trade in migrated_trades:
        owner_items = [items_dict[item_id] for item_id in trade.get("owner_item_ids", []) if item_id in items_dict]
        trader_items = [items_dict[item_id] for item_id in trade.get("trader_item_ids", []) if item_id in items_dict]
        
        result.append({
            "trade": trade,
            "owner_items": owner_items,
            "trader_items": trader_items,
            "owner": users_dict.get(trade["owner_id"]),
            "trader": users_dict.get(trade["trader_id"])
        })
    
    return result

@api_router.get("/trades/{trade_id}")
async def get_trade(trade_id: str, user: User = Depends(get_current_user)):
    """Get a specific trade with all items"""
    trade = await db.trades.find_one({"trade_id": trade_id}, {"_id": 0})
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    
    # Check authorization
    if trade["owner_id"] != user.user_id and trade["trader_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Migrate if needed
    trade = await migrate_trade_to_array_format(trade)
    
    # Get all items
    owner_items = []
    trader_items = []
    for item_id in trade.get("owner_item_ids", []):
        item = await db.items.find_one({"item_id": item_id}, {"_id": 0})
        if item:
            owner_items.append(item)
    for item_id in trade.get("trader_item_ids", []):
        item = await db.items.find_one({"item_id": item_id}, {"_id": 0})
        if item:
            trader_items.append(item)
    
    owner = await db.users.find_one({"user_id": trade["owner_id"]}, {"_id": 0})
    trader = await db.users.find_one({"user_id": trade["trader_id"]}, {"_id": 0})
    
    return {
        "trade": trade,
        "owner_items": owner_items,
        "trader_items": trader_items,
        "owner": owner,
        "trader": trader
    }

@api_router.delete("/trades/{trade_id}")
async def cancel_trade(trade_id: str, user: User = Depends(get_current_user)):
    """Cancel a trade"""
    trade = await db.trades.find_one({"trade_id": trade_id}, {"_id": 0})
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    
    # Migrate if needed
    trade = await migrate_trade_to_array_format(trade)
    
    # Only participants can cancel
    if trade["owner_id"] != user.user_id and trade["trader_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if trade["is_completed"]:
        raise HTTPException(status_code=400, detail="Cannot cancel completed trade")
    
    if trade.get("is_cancelled", False):
        raise HTTPException(status_code=400, detail="Trade already cancelled")
    
    # Mark trade as cancelled
    await db.trades.update_one(
        {"trade_id": trade_id},
        {"$set": {
            "is_cancelled": True,
            "cancelled_at": datetime.now(timezone.utc).isoformat(),
            "cancelled_by": user.user_id
        }}
    )
    
    # Delete all messages for this trade
    await db.messages.delete_many({"trade_id": trade_id})
    
    # Notify the other party
    other_user_id = trade["trader_id"] if trade["owner_id"] == user.user_id else trade["owner_id"]
    other_user = await db.users.find_one({"user_id": other_user_id}, {"_id": 0})
    other_user_name = other_user.get("username") or other_user.get("name", "Someone") if other_user else "Someone"
    cancelling_user_name = user.get("username") or user.get("name", "Someone")
    
    await create_and_send_notification(
        user_id=other_user_id,
        notification_type="trade_cancelled",
        message=f"{cancelling_user_name} cancelled the trade",
        data={"trade_id": trade_id}
    )
    
    updated_trade = await db.trades.find_one({"trade_id": trade_id}, {"_id": 0})
    return {"message": "Trade cancelled", "trade": updated_trade}

@api_router.post("/trades/{trade_id}/confirm")
async def confirm_trade(trade_id: str, user: User = Depends(get_current_user)):
    """Confirm trade completion (both parties must confirm)"""
    trade = await db.trades.find_one({"trade_id": trade_id}, {"_id": 0})
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    
    # Migrate if needed
    trade = await migrate_trade_to_array_format(trade)
    
    if trade["is_completed"]:
        raise HTTPException(status_code=400, detail="Trade already completed")
    
    if trade.get("is_cancelled", False):
        raise HTTPException(status_code=400, detail="Cannot confirm cancelled trade")
    
    # Determine which party is confirming
    update_field = None
    if trade["owner_id"] == user.user_id:
        update_field = "owner_confirmed"
    elif trade["trader_id"] == user.user_id:
        update_field = "trader_confirmed"
    else:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Update confirmation
    await db.trades.update_one(
        {"trade_id": trade_id},
        {"$set": {update_field: True}}
    )
    
    # Check if both confirmed
    updated_trade = await db.trades.find_one({"trade_id": trade_id}, {"_id": 0})
    updated_trade = await migrate_trade_to_array_format(updated_trade)
    
    # Notify the other party that this party confirmed
    other_user_id = trade["trader_id"] if update_field == "owner_confirmed" else trade["owner_id"]
    other_user = await db.users.find_one({"user_id": other_user_id}, {"_id": 0})
    other_user_name = other_user.get("username") or other_user.get("name", "Someone") if other_user else "Someone"
    confirming_user_name = user.get("username") or user.get("name", "Someone")
    
    # If only one party confirmed, notify the other
    if (update_field == "owner_confirmed" and not updated_trade.get("trader_confirmed")) or \
       (update_field == "trader_confirmed" and not updated_trade.get("owner_confirmed")):
        await create_and_send_notification(
            user_id=other_user_id,
            notification_type="trade_confirmed",
            message=f"{confirming_user_name} confirmed the trade",
            data={"trade_id": trade_id}
        )
    
    if updated_trade["owner_confirmed"] and updated_trade["trader_confirmed"]:
        # Complete the trade
        completed_at = datetime.now(timezone.utc)
        await db.trades.update_one(
            {"trade_id": trade_id},
            {"$set": {
                "is_completed": True,
                "completed_at": completed_at.isoformat()
            }}
        )
        
        # Mark all items as unavailable
        all_item_ids = updated_trade.get("owner_item_ids", []) + updated_trade.get("trader_item_ids", [])
        for item_id in all_item_ids:
            await db.items.update_one(
                {"item_id": item_id},
                {"$set": {"is_available": False}}
            )
        
        # Award trade points to both users
        await db.users.update_one({"user_id": trade["owner_id"]}, {"$inc": {"trade_points": 1}})
        await db.users.update_one({"user_id": trade["trader_id"]}, {"$inc": {"trade_points": 1}})
        
        # Set expiration for all messages in this trade (24 hours from completion)
        expires_at = completed_at + timedelta(hours=24)
        await db.messages.update_many(
            {"trade_id": trade_id},
            {"$set": {"expires_at": expires_at.isoformat()}}
        )
        
        # Notify both parties that trade is completed
        owner_user = await db.users.find_one({"user_id": trade["owner_id"]}, {"_id": 0})
        trader_user = await db.users.find_one({"user_id": trade["trader_id"]}, {"_id": 0})
        owner_name = owner_user.get("username") or owner_user.get("name", "Someone") if owner_user else "Someone"
        trader_name = trader_user.get("username") or trader_user.get("name", "Someone") if trader_user else "Someone"
        
        await create_and_send_notification(
            user_id=trade["owner_id"],
            notification_type="trade_completed",
            message=f"Trade with {trader_name} completed! You earned 1 trade point.",
            data={"trade_id": trade_id}
        )
        
        await create_and_send_notification(
            user_id=trade["trader_id"],
            notification_type="trade_completed",
            message=f"Trade with {owner_name} completed! You earned 1 trade point.",
            data={"trade_id": trade_id}
        )
        
        updated_trade = await db.trades.find_one({"trade_id": trade_id}, {"_id": 0})
        updated_trade = await migrate_trade_to_array_format(updated_trade)
    
    return updated_trade

@api_router.post("/trades/{trade_id}/items")
async def add_items_to_trade(trade_id: str, item_data: dict, user: User = Depends(get_current_user)):
    """Add item(s) to trade. Requires confirmation if adding to other party's side."""
    trade = await db.trades.find_one({"trade_id": trade_id}, {"_id": 0})
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    
    # Migrate if needed
    trade = await migrate_trade_to_array_format(trade)
    
    # Check authorization
    if trade["owner_id"] != user.user_id and trade["trader_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if trade["is_completed"] or trade.get("is_cancelled", False):
        raise HTTPException(status_code=400, detail="Cannot modify completed or cancelled trade")
    
    item_ids = item_data.get("item_ids", [])
    side = item_data.get("side", "trader")  # "owner" or "trader"
    
    if not item_ids:
        raise HTTPException(status_code=400, detail="No items provided")
    
    # Determine which side the user is on
    is_owner = trade["owner_id"] == user.user_id
    is_trader = trade["trader_id"] == user.user_id
    
    # Validate items
    for item_id in item_ids:
        item = await db.items.find_one({"item_id": item_id, "is_available": True}, {"_id": 0})
        if not item:
            raise HTTPException(status_code=404, detail=f"Item {item_id} not found or not available")
        
        # Check if user owns the item (if adding to their own side)
        if side == "owner" and is_owner:
            if item["user_id"] != user.user_id:
                raise HTTPException(status_code=403, detail=f"You can only add your own items")
        elif side == "trader" and is_trader:
            if item["user_id"] != user.user_id:
                raise HTTPException(status_code=403, detail=f"You can only add your own items")
    
    # Check max items per side
    max_items = trade.get("max_items_per_side", 5)
    current_items = len(trade.get(f"{side}_item_ids", []))
    if current_items + len(item_ids) > max_items:
        raise HTTPException(status_code=400, detail=f"Maximum {max_items} items per side allowed")
    
    # If adding to other party's side, require confirmation
    if (side == "owner" and is_trader) or (side == "trader" and is_owner):
        # Add to pending items
        await db.trades.update_one(
            {"trade_id": trade_id},
            {"$push": {f"pending_{side}_items": {"$each": item_ids}}}
        )
        
        # Create notification
        other_user_id = trade["owner_id"] if side == "trader" else trade["trader_id"]
        requester_name = user.get("username") or user.get("name", "Someone")
        await create_and_send_notification(
            user_id=other_user_id,
            notification_type="item_add_request",
            message=f"{requester_name} wants to add items to the trade",
            data={"trade_id": trade_id, "item_ids": item_ids, "side": side}
        )
        
        updated_trade = await db.trades.find_one({"trade_id": trade_id}, {"_id": 0})
        updated_trade = await migrate_trade_to_array_format(updated_trade)
        
        # Broadcast trade update via WebSocket
        other_user_id = trade["owner_id"] if side == "trader" else trade["trader_id"]
        await broadcast_ws_message(
            user_ids=[user.user_id, other_user_id],
            channel="trades",
            message_type="trade_updated",
            data={"trade_id": trade_id}
        )
        
        return updated_trade
    else:
        # Add directly to trade (own side) - notify the other party
        other_user_id = trade["owner_id"] if side == "trader" else trade["trader_id"]
        item_titles = []
        for item_id in item_ids:
            item = await db.items.find_one({"item_id": item_id}, {"_id": 0})
            if item:
                item_titles.append(item.get("title", item_id))
        
        items_text = ", ".join(item_titles[:2])
        if len(item_titles) > 2:
            items_text += f" and {len(item_titles) - 2} more"
        
        adding_user_name = user.get("username") or user.get("name", "Someone")
        await create_and_send_notification(
            user_id=other_user_id,
            notification_type="item_added",
            message=f"{adding_user_name} added {items_text} to the trade",
            data={"trade_id": trade_id, "item_ids": item_ids}
        )
        
        await db.trades.update_one(
            {"trade_id": trade_id},
            {"$push": {f"{side}_item_ids": {"$each": item_ids}}}
        )
        
        updated_trade = await db.trades.find_one({"trade_id": trade_id}, {"_id": 0})
        updated_trade = await migrate_trade_to_array_format(updated_trade)
        
        # Broadcast trade update via WebSocket
        await broadcast_ws_message(
            user_ids=[user.user_id, other_user_id],
            channel="trades",
            message_type="trade_updated",
            data={"trade_id": trade_id}
        )
        
        return updated_trade

@api_router.delete("/trades/{trade_id}/items/{item_id}")
async def remove_item_from_trade(trade_id: str, item_id: str, user: User = Depends(get_current_user)):
    """Remove item from trade. Requires confirmation if removing from other party's side."""
    trade = await db.trades.find_one({"trade_id": trade_id}, {"_id": 0})
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    
    # Migrate if needed
    trade = await migrate_trade_to_array_format(trade)
    
    # Check authorization
    if trade["owner_id"] != user.user_id and trade["trader_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if trade["is_completed"] or trade.get("is_cancelled", False):
        raise HTTPException(status_code=400, detail="Cannot modify completed or cancelled trade")
    
    # Determine which side the item is on
    is_owner = trade["owner_id"] == user.user_id
    is_trader = trade["trader_id"] == user.user_id
    side = None
    
    if item_id in trade.get("owner_item_ids", []):
        side = "owner"
    elif item_id in trade.get("trader_item_ids", []):
        side = "trader"
    else:
        raise HTTPException(status_code=404, detail="Item not found in trade")
    
    # If removing from other party's side, require confirmation
    if (side == "owner" and is_trader) or (side == "trader" and is_owner):
        raise HTTPException(status_code=403, detail="Cannot remove items from other party's side. Request removal instead.")
    
    # Remove from trade
    await db.trades.update_one(
        {"trade_id": trade_id},
        {"$pull": {f"{side}_item_ids": item_id}}
    )
    
    # Also remove from pending if it's there
    await db.trades.update_one(
        {"trade_id": trade_id},
        {"$pull": {f"pending_{side}_items": item_id}}
    )
    
    # Notify the other party
    other_user_id = trade["owner_id"] if side == "trader" else trade["trader_id"]
    item = await db.items.find_one({"item_id": item_id}, {"_id": 0})
    item_title = item.get("title", "an item") if item else "an item"
    removing_user_name = user.get("username") or user.get("name", "Someone")
    
    await create_and_send_notification(
        user_id=other_user_id,
        notification_type="item_removed",
        message=f"{removing_user_name} removed {item_title} from the trade",
        data={"trade_id": trade_id, "item_id": item_id}
    )
    
    updated_trade = await db.trades.find_one({"trade_id": trade_id}, {"_id": 0})
    updated_trade = await migrate_trade_to_array_format(updated_trade)
    
    # Broadcast trade update via WebSocket
    await broadcast_ws_message(
        user_ids=[user.user_id, other_user_id],
        channel="trades",
        message_type="trade_updated",
        data={"trade_id": trade_id}
    )
    
    return updated_trade

@api_router.post("/trades/{trade_id}/items/request")
async def request_item_in_trade(trade_id: str, request_data: dict, user: User = Depends(get_current_user)):
    """Request other party to add an item to the trade"""
    trade = await db.trades.find_one({"trade_id": trade_id}, {"_id": 0})
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    
    # Migrate if needed
    trade = await migrate_trade_to_array_format(trade)
    
    # Check authorization
    if trade["owner_id"] != user.user_id and trade["trader_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if trade["is_completed"] or trade.get("is_cancelled", False):
        raise HTTPException(status_code=400, detail="Cannot modify completed or cancelled trade")
    
    item_id = request_data.get("item_id")
    side = request_data.get("side")  # "owner" or "trader" - which side should add the item
    
    if not item_id or not side:
        raise HTTPException(status_code=400, detail="item_id and side are required")
    
    # Validate item exists
    item = await db.items.find_one({"item_id": item_id, "is_available": True}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found or not available")
    
    # Determine which side the user is on
    is_owner = trade["owner_id"] == user.user_id
    is_trader = trade["trader_id"] == user.user_id
    
    # Can only request items for the other party's side
    if (side == "owner" and is_owner) or (side == "trader" and is_trader):
        raise HTTPException(status_code=400, detail="Cannot request items for your own side")
    
    # Check if item belongs to the other party
    other_user_id = trade["owner_id"] if side == "owner" else trade["trader_id"]
    if item["user_id"] != other_user_id:
        raise HTTPException(status_code=400, detail="Item must belong to the other party")
    
    # Check max items per side
    max_items = trade.get("max_items_per_side", 5)
    current_items = len(trade.get(f"{side}_item_ids", []))
    if current_items >= max_items:
        raise HTTPException(status_code=400, detail=f"Maximum {max_items} items per side allowed")
    
    # Create request message
    request_id = f"req_{uuid.uuid4().hex[:12]}"
    message = Message(
        trade_id=trade_id,
        sender_id=user.user_id,
        receiver_id=other_user_id,
        message_type="item_request",
        item_request_data={
            "item_id": item_id,
            "side": side,
            "status": "pending",
            "request_id": request_id
        },
        content=f"Request to add item: {item.get('title', item_id)}"
    )
    
    msg_dict = message.model_dump()
    msg_dict["created_at"] = msg_dict["created_at"].isoformat()
    
    await db.messages.insert_one(msg_dict.copy())
    
    # Broadcast via WebSocket
    await broadcast_ws_message(
        user_ids=[user.user_id, other_user_id],
        channel="messages",
        message_type="new_message",
        data={"message": msg_dict}
    )
    
    # Create notification
    requester_name = user.get("username") or user.get("name", "Someone")
    await create_and_send_notification(
        user_id=other_user_id,
        notification_type="item_request",
        message=f"{requester_name} requested to add an item to the trade",
        data={"trade_id": trade_id, "item_id": item_id, "request_id": request_id}
    )
    
    return {"message": "Item request sent", "request_id": request_id}

@api_router.post("/trades/{trade_id}/items/request/{request_id}/respond")
async def respond_to_item_request(trade_id: str, request_id: str, response_data: dict, user: User = Depends(get_current_user)):
    """Accept or decline an item request"""
    trade = await db.trades.find_one({"trade_id": trade_id}, {"_id": 0})
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    
    # Migrate if needed
    trade = await migrate_trade_to_array_format(trade)
    
    # Check authorization
    if trade["owner_id"] != user.user_id and trade["trader_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if trade["is_completed"] or trade.get("is_cancelled", False):
        raise HTTPException(status_code=400, detail="Cannot modify completed or cancelled trade")
    
    # Find the request message
    request_message = await db.messages.find_one({
        "trade_id": trade_id,
        "message_type": "item_request",
        "item_request_data.request_id": request_id,
        "item_request_data.status": "pending"
    }, {"_id": 0})
    
    if not request_message:
        raise HTTPException(status_code=404, detail="Request not found or already processed")
    
    # Check if user is the receiver (the one being requested)
    if request_message["receiver_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized to respond to this request")
    
    accepted = response_data.get("accepted", False)
    item_request_data = request_message.get("item_request_data", {})
    item_id = item_request_data.get("item_id")
    side = item_request_data.get("side")
    
    # Update request message status
    await db.messages.update_one(
        {"message_id": request_message["message_id"]},
        {"$set": {
            "item_request_data.status": "accepted" if accepted else "declined"
        }}
    )
    
    if accepted:
        # Add item to trade
        await db.trades.update_one(
            {"trade_id": trade_id},
            {"$push": {f"{side}_item_ids": item_id}}
        )
        
        # Notify requester that request was accepted
        requester_id = request_message["sender_id"]
        requester_user = await db.users.find_one({"user_id": requester_id}, {"_id": 0})
        requester_name = requester_user.get("username") or requester_user.get("name", "Someone") if requester_user else "Someone"
        item = await db.items.find_one({"item_id": item_id}, {"_id": 0})
        item_title = item.get("title", "an item") if item else "an item"
        responder_name = user.get("username") or user.get("name", "Someone")
        
        await create_and_send_notification(
            user_id=requester_id,
            notification_type="item_request_accepted",
            message=f"{responder_name} accepted your request to add {item_title} to the trade",
            data={"trade_id": trade_id, "item_id": item_id, "request_id": request_id}
        )
        
        # Remove from pending if it's there
        await db.trades.update_one(
            {"trade_id": trade_id},
            {"$pull": {f"pending_{side}_items": item_id}}
        )
        
        # Create confirmation message
        message = Message(
            trade_id=trade_id,
            sender_id=user.user_id,
            receiver_id=request_message["sender_id"],
            message_type="item_added",
            content=f"Accepted request to add item"
        )
        msg_dict = message.model_dump()
        msg_dict["created_at"] = msg_dict["created_at"].isoformat()
        await db.messages.insert_one(msg_dict.copy())
        
        # Broadcast
        await broadcast_ws_message(
            user_ids=[user.user_id, request_message["sender_id"]],
            channel="messages",
            message_type="new_message",
            data={"message": msg_dict}
        )
    else:
        # Create decline message
        message = Message(
            trade_id=trade_id,
            sender_id=user.user_id,
            receiver_id=request_message["sender_id"],
            message_type="text",
            content=f"Declined request to add item"
        )
        msg_dict = message.model_dump()
        msg_dict["created_at"] = msg_dict["created_at"].isoformat()
        await db.messages.insert_one(msg_dict.copy())
        
        # Send notification for declined request
        responder_user = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
        responder_name = responder_user.get("username") or responder_user.get("name", "Someone") if responder_user else "Someone"
        item = await db.items.find_one({"item_id": item_id}, {"_id": 0})
        item_title = item.get("title", "item") if item else "item"
        
        await create_and_send_notification(
            user_id=requester_id,
            notification_type="item_request_declined",
            message=f"{responder_name} declined your request to add {item_title} to the trade",
            data={"trade_id": trade_id, "item_id": item_id, "request_id": request_id}
        )
        
        # Broadcast
        await broadcast_ws_message(
            user_ids=[user.user_id, request_message["sender_id"]],
            channel="messages",
            message_type="new_message",
            data={"message": msg_dict}
        )
    
    updated_trade = await db.trades.find_one({"trade_id": trade_id}, {"_id": 0})
    return await migrate_trade_to_array_format(updated_trade)

@api_router.post("/trades/{trade_id}/rate")
async def rate_trade(trade_id: str, rating_data: RatingCreate, user: User = Depends(get_current_user)):
    """Rate the other party after a completed trade"""
    trade = await db.trades.find_one({"trade_id": trade_id}, {"_id": 0})
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    
    if not trade["is_completed"]:
        raise HTTPException(status_code=400, detail="Trade not completed yet")
    
    if rating_data.rating < 1 or rating_data.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
    
    # Determine who is rating whom
    rating_field = None
    rated_user_id = None
    
    if trade["owner_id"] == user.user_id:
        if trade.get("owner_rating") is not None:
            raise HTTPException(status_code=400, detail="Already rated")
        rating_field = "owner_rating"
        rated_user_id = trade["trader_id"]
    elif trade["trader_id"] == user.user_id:
        if trade.get("trader_rating") is not None:
            raise HTTPException(status_code=400, detail="Already rated")
        rating_field = "trader_rating"
        rated_user_id = trade["owner_id"]
    else:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Save rating in trade
    await db.trades.update_one(
        {"trade_id": trade_id},
        {"$set": {rating_field: rating_data.rating}}
    )
    
    # Update user's average rating
    rated_user = await db.users.find_one({"user_id": rated_user_id}, {"_id": 0})
    current_rating = rated_user.get("rating") or 0
    rating_count = rated_user.get("rating_count", 0)
    
    new_rating_count = rating_count + 1
    new_rating = ((current_rating * rating_count) + rating_data.rating) / new_rating_count
    
    await db.users.update_one(
        {"user_id": rated_user_id},
        {"$set": {"rating": round(new_rating, 1), "rating_count": new_rating_count}}
    )
    
    return {"message": "Rating submitted", "rating": rating_data.rating}

# ============== REPORT ENDPOINTS ==============

@api_router.post("/reports")
async def create_report(report_data: ReportCreate, user: User = Depends(get_current_user)):
    """Create a new report"""
    # Validate report type
    if report_data.report_type not in ["item", "user", "trade"]:
        raise HTTPException(status_code=400, detail="Invalid report type")
    
    # Validate category
    if report_data.category not in REPORT_CATEGORIES:
        raise HTTPException(status_code=400, detail="Invalid report category")
    
    # Validate that target exists based on type
    if report_data.report_type == "item":
        if not report_data.reported_item_id:
            raise HTTPException(status_code=400, detail="Item ID required for item reports")
        item = await db.items.find_one({"item_id": report_data.reported_item_id}, {"_id": 0})
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")
        # Prevent reporting own items
        if item["user_id"] == user.user_id:
            raise HTTPException(status_code=400, detail="Cannot report your own item")
    
    elif report_data.report_type == "user":
        if not report_data.reported_user_id:
            raise HTTPException(status_code=400, detail="User ID required for user reports")
        reported_user = await db.users.find_one({"user_id": report_data.reported_user_id}, {"_id": 0})
        if not reported_user:
            raise HTTPException(status_code=404, detail="User not found")
        # Prevent reporting yourself
        if report_data.reported_user_id == user.user_id:
            raise HTTPException(status_code=400, detail="Cannot report yourself")
    
    elif report_data.report_type == "trade":
        if not report_data.reported_trade_id:
            raise HTTPException(status_code=400, detail="Trade ID required for trade reports")
        trade = await db.trades.find_one({"trade_id": report_data.reported_trade_id}, {"_id": 0})
        if not trade:
            raise HTTPException(status_code=404, detail="Trade not found")
        # Only allow reporting completed trades
        if not trade.get("is_completed", False):
            raise HTTPException(status_code=400, detail="Can only report completed trades")
        # Verify user is part of the trade
        if trade["owner_id"] != user.user_id and trade["trader_id"] != user.user_id:
            raise HTTPException(status_code=403, detail="Not authorized to report this trade")
    
    # Check for duplicate pending reports (same reporter, same target)
    duplicate_query = {
        "reporter_id": user.user_id,
        "status": "pending"
    }
    if report_data.report_type == "item":
        duplicate_query["reported_item_id"] = report_data.reported_item_id
    elif report_data.report_type == "user":
        duplicate_query["reported_user_id"] = report_data.reported_user_id
    elif report_data.report_type == "trade":
        duplicate_query["reported_trade_id"] = report_data.reported_trade_id
    
    existing_report = await db.reports.find_one(duplicate_query, {"_id": 0})
    if existing_report:
        raise HTTPException(status_code=400, detail="You have already submitted a pending report for this target")
    
    # Create report
    report = Report(
        reporter_id=user.user_id,
        report_type=report_data.report_type,
        reported_item_id=report_data.reported_item_id,
        reported_user_id=report_data.reported_user_id,
        reported_trade_id=report_data.reported_trade_id,
        category=report_data.category,
        description=report_data.description
    )
    
    report_dict = report.model_dump()
    report_dict["created_at"] = report_dict["created_at"].isoformat()
    
    await db.reports.insert_one(report_dict.copy())
    
    # Send notification to all admins
    admins = await db.users.find({"is_admin": True}, {"_id": 0, "user_id": 1}).to_list(100)
    for admin in admins:
        await create_and_send_notification(
            user_id=admin["user_id"],
            notification_type="new_report",
            message=f"New {report_data.report_type} report submitted",
            data={"report_id": report_dict["report_id"], "report_type": report_data.report_type}
        )
    
    return report_dict

# ============== ADMIN REPORT ENDPOINTS ==============

@api_router.get("/admin/reports")
async def admin_get_reports(admin: User = Depends(get_admin_user), status: Optional[str] = None, report_type: Optional[str] = None):
    """Get all reports with reporter and target info (admin only)"""
    query = {}
    if status:
        query["status"] = status
    if report_type:
        query["report_type"] = report_type
    
    reports = await db.reports.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # Get reporter info
    reporter_ids = list(set(r["reporter_id"] for r in reports))
    reporters_dict = {}
    if reporter_ids:
        reporters_cursor = db.users.find({"user_id": {"$in": reporter_ids}}, {"_id": 0, "user_id": 1, "name": 1, "email": 1, "username": 1})
        async for reporter_doc in reporters_cursor:
            reporters_dict[reporter_doc["user_id"]] = reporter_doc
    
    # Get reported user info
    reported_user_ids = list(set(r.get("reported_user_id") for r in reports if r.get("reported_user_id")))
    reported_users_dict = {}
    if reported_user_ids:
        reported_users_cursor = db.users.find({"user_id": {"$in": reported_user_ids}}, {"_id": 0, "user_id": 1, "name": 1, "email": 1, "username": 1})
        async for user_doc in reported_users_cursor:
            reported_users_dict[user_doc["user_id"]] = user_doc
    
    # Get reported item info
    reported_item_ids = list(set(r.get("reported_item_id") for r in reports if r.get("reported_item_id")))
    reported_items_dict = {}
    if reported_item_ids:
        reported_items_cursor = db.items.find({"item_id": {"$in": reported_item_ids}}, {"_id": 0, "item_id": 1, "title": 1, "user_id": 1})
        async for item_doc in reported_items_cursor:
            reported_items_dict[item_doc["item_id"]] = item_doc
    
    # Get reported trade info
    reported_trade_ids = list(set(r.get("reported_trade_id") for r in reports if r.get("reported_trade_id")))
    reported_trades_dict = {}
    if reported_trade_ids:
        reported_trades_cursor = db.trades.find({"trade_id": {"$in": reported_trade_ids}}, {"_id": 0, "trade_id": 1, "owner_id": 1, "trader_id": 1})
        async for trade_doc in reported_trades_cursor:
            reported_trades_dict[trade_doc["trade_id"]] = trade_doc
    
    # Get resolver info
    resolver_ids = list(set(r.get("resolved_by") for r in reports if r.get("resolved_by")))
    resolvers_dict = {}
    if resolver_ids:
        resolvers_cursor = db.users.find({"user_id": {"$in": resolver_ids}}, {"_id": 0, "user_id": 1, "name": 1, "email": 1, "username": 1})
        async for resolver_doc in resolvers_cursor:
            resolvers_dict[resolver_doc["user_id"]] = resolver_doc
    
    result = []
    for report in reports:
        result.append({
            **report,
            "reporter": reporters_dict.get(report["reporter_id"]),
            "reported_user": reported_users_dict.get(report.get("reported_user_id")) if report.get("reported_user_id") else None,
            "reported_item": reported_items_dict.get(report.get("reported_item_id")) if report.get("reported_item_id") else None,
            "reported_trade": reported_trades_dict.get(report.get("reported_trade_id")) if report.get("reported_trade_id") else None,
            "resolver": resolvers_dict.get(report.get("resolved_by")) if report.get("resolved_by") else None
        })
    
    return result

@api_router.post("/admin/reports/{report_id}/resolve")
async def admin_resolve_report(report_id: str, action_data: dict = Body(None), admin: User = Depends(get_admin_user)):
    """Mark a report as resolved (admin only)"""
    report = await db.reports.find_one({"report_id": report_id}, {"_id": 0})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    if report["status"] != "pending":
        raise HTTPException(status_code=400, detail="Can only resolve pending reports")
    
    action_taken = action_data.get("action_taken") if action_data and isinstance(action_data, dict) else None
    
    await db.reports.update_one(
        {"report_id": report_id},
        {"$set": {
            "status": "resolved",
            "resolved_at": datetime.now(timezone.utc).isoformat(),
            "resolved_by": admin.user_id,
            "action_taken": action_taken
        }}
    )
    
    return {"message": "Report marked as resolved"}

@api_router.post("/admin/reports/{report_id}/dismiss")
async def admin_dismiss_report(report_id: str, admin: User = Depends(get_admin_user)):
    """Dismiss a report (admin only)"""
    report = await db.reports.find_one({"report_id": report_id}, {"_id": 0})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    if report["status"] != "pending":
        raise HTTPException(status_code=400, detail="Can only dismiss pending reports")
    
    await db.reports.update_one(
        {"report_id": report_id},
        {"$set": {
            "status": "dismissed",
            "resolved_at": datetime.now(timezone.utc).isoformat(),
            "resolved_by": admin.user_id,
            "action_taken": "dismissed"
        }}
    )
    
    return {"message": "Report dismissed"}

@api_router.delete("/admin/reports/{report_id}")
async def admin_delete_report(report_id: str, admin: User = Depends(get_admin_user)):
    """Delete a report (admin only, for cleanup)"""
    report = await db.reports.find_one({"report_id": report_id}, {"_id": 0})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    await db.reports.delete_one({"report_id": report_id})
    return {"message": "Report deleted"}

# ============== BUG REPORT ENDPOINTS ==============

@api_router.post("/bug-reports")
async def create_bug_report(bug_data: BugReportCreate, user: User = Depends(get_current_user)):
    """Create a bug report"""
    bug_report = BugReport(
        user_id=user.user_id,
        title=bug_data.title,
        description=bug_data.description,
        steps_to_reproduce=bug_data.steps_to_reproduce
    )
    
    bug_dict = bug_report.model_dump()
    bug_dict["created_at"] = bug_dict["created_at"].isoformat()
    
    await db.bug_reports.insert_one(bug_dict.copy())
    
    return bug_dict

@api_router.get("/admin/bug-reports")
async def admin_get_bug_reports(admin: User = Depends(get_admin_user)):
    """Get all bug reports (admin only)"""
    bugs = await db.bug_reports.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # Get user info for each bug report
    user_ids = list(set(bug["user_id"] for bug in bugs))
    users_dict = {}
    if user_ids:
        users_cursor = db.users.find({"user_id": {"$in": user_ids}}, {"_id": 0, "user_id": 1, "name": 1, "email": 1, "username": 1})
        async for user_doc in users_cursor:
            users_dict[user_doc["user_id"]] = user_doc
    
    # Get validator info
    validator_ids = list(set(bug.get("validated_by") for bug in bugs if bug.get("validated_by")))
    validators_dict = {}
    if validator_ids:
        validators_cursor = db.users.find({"user_id": {"$in": validator_ids}}, {"_id": 0, "user_id": 1, "name": 1, "email": 1, "username": 1})
        async for validator_doc in validators_cursor:
            validators_dict[validator_doc["user_id"]] = validator_doc
    
    # Get resolver info
    resolver_ids = list(set(bug.get("resolved_by") for bug in bugs if bug.get("resolved_by")))
    resolvers_dict = {}
    if resolver_ids:
        resolvers_cursor = db.users.find({"user_id": {"$in": resolver_ids}}, {"_id": 0, "user_id": 1, "name": 1, "email": 1, "username": 1})
        async for resolver_doc in resolvers_cursor:
            resolvers_dict[resolver_doc["user_id"]] = resolver_doc
    
    result = []
    for bug in bugs:
        result.append({
            **bug,
            "user": users_dict.get(bug["user_id"]),
            "validator": validators_dict.get(bug.get("validated_by")) if bug.get("validated_by") else None,
            "resolver": resolvers_dict.get(bug.get("resolved_by")) if bug.get("resolved_by") else None
        })
    
    return result

@api_router.post("/admin/bug-reports/{bug_id}/validate")
async def admin_validate_bug_report(bug_id: str, admin: User = Depends(get_admin_user)):
    """Mark a bug report as valid and award trade points to the reporter"""
    bug = await db.bug_reports.find_one({"bug_id": bug_id}, {"_id": 0})
    if not bug:
        raise HTTPException(status_code=404, detail="Bug report not found")
    
    if bug.get("is_valid"):
        raise HTTPException(status_code=400, detail="Bug report already validated")
    
    validated_at = datetime.now(timezone.utc)
    
    # Mark bug as valid
    await db.bug_reports.update_one(
        {"bug_id": bug_id},
        {"$set": {
            "is_valid": True,
            "validated_at": validated_at.isoformat(),
            "validated_by": admin.user_id
        }}
    )
    
    # Award trade points to the reporter
    await db.users.update_one(
        {"user_id": bug["user_id"]},
        {"$inc": {"trade_points": 1}}
    )
    
    # Create notification for the reporter
    await create_and_send_notification(
        user_id=bug["user_id"],
        notification_type="bug_validated",
        message=f"Your bug report '{bug['title']}' was marked as valid! You earned 1 trade point.",
        data={"bug_id": bug_id, "trade_points_awarded": 1}
    )
    
    return {"message": "Bug report validated and trade points awarded"}

@api_router.post("/admin/bug-reports/{bug_id}/invalidate")
async def admin_invalidate_bug_report(bug_id: str, admin: User = Depends(get_admin_user)):
    """Delete a bug report (admin only)"""
    bug = await db.bug_reports.find_one({"bug_id": bug_id}, {"_id": 0})
    if not bug:
        raise HTTPException(status_code=404, detail="Bug report not found")
    
    if bug.get("is_valid"):
        raise HTTPException(status_code=400, detail="Cannot delete a validated bug report")
    
    # Delete the bug report
    await db.bug_reports.delete_one({"bug_id": bug_id})
    
    return {"message": "Bug report deleted"}

@api_router.post("/admin/bug-reports/{bug_id}/mark-fixed")
async def admin_mark_bug_fixed(bug_id: str, admin: User = Depends(get_admin_user)):
    """Mark a validated bug report as fixed (admin only)"""
    bug = await db.bug_reports.find_one({"bug_id": bug_id}, {"_id": 0})
    if not bug:
        raise HTTPException(status_code=404, detail="Bug report not found")
    
    if not bug.get("is_valid"):
        raise HTTPException(status_code=400, detail="Can only mark validated bugs as fixed")
    
    if bug.get("is_resolved"):
        raise HTTPException(status_code=400, detail="Bug report already marked as fixed")
    
    # Mark bug as fixed
    await db.bug_reports.update_one(
        {"bug_id": bug_id},
        {"$set": {
            "is_resolved": True,
            "resolved_at": datetime.now(timezone.utc).isoformat(),
            "resolved_by": admin.user_id
        }}
    )
    
    return {"message": "Bug report marked as fixed"}

# ============== FILE UPLOAD ==============

@api_router.post("/upload")
async def upload_image(file: UploadFile = File(...), user: User = Depends(get_current_user)):
    """Upload an image and return base64 data URL"""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    contents = await file.read()
    base64_data = base64.b64encode(contents).decode("utf-8")
    data_url = f"data:{file.content_type};base64,{base64_data}"
    
    return {"image_url": data_url}

# ============== ADMIN ENDPOINTS ==============

@api_router.get("/admin/users")
async def admin_get_users(admin: User = Depends(get_admin_user)):
    """Get all users (admin only)"""
    users = await db.users.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    # Ensure is_admin field is present for backward compatibility
    for user in users:
        if "is_admin" not in user:
            user["is_admin"] = False
        
        # Find most recent session activity for this user
        # Prefer last_accessed, fallback to created_at
        most_recent_session = await db.user_sessions.find_one(
            {"user_id": user["user_id"]},
            {"_id": 0, "last_accessed": 1, "created_at": 1},
            sort=[("last_accessed", -1), ("created_at", -1)]
        )
        
        if most_recent_session:
            # Use last_accessed if available, otherwise use created_at
            user["last_active"] = most_recent_session.get("last_accessed") or most_recent_session.get("created_at")
        else:
            # Fallback to user created_at if no sessions
            user["last_active"] = user.get("created_at")
    
    return users

@api_router.get("/admin/stats")
async def admin_get_stats(admin: User = Depends(get_admin_user)):
    """Get platform statistics (admin only)"""
    stats = {
        "total_users": await db.users.count_documents({}),
        "total_items": await db.items.count_documents({}),
        "available_items": await db.items.count_documents({"is_available": True}),
        "total_trades": await db.trades.count_documents({}),
        "active_trades": await db.trades.count_documents({"is_completed": False}),
        "completed_trades": await db.trades.count_documents({"is_completed": True}),
        "total_messages": await db.messages.count_documents({}),
        "total_categories": await db.categories.count_documents({}),
        "total_admins": await db.users.count_documents({"is_admin": True})
    }
    return stats

@api_router.get("/admin/items")
async def admin_get_items(admin: User = Depends(get_admin_user)):
    """Get all items including unavailable ones (admin only)"""
    items = await db.items.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return items

@api_router.delete("/admin/items/{item_id}")
async def admin_delete_item(item_id: str, admin: User = Depends(get_admin_user)):
    """Delete any item (admin override)"""
    item = await db.items.find_one({"item_id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Find all active trades involving this item (check both old and new format)
    active_trades = await db.trades.find({
        "$or": [
            {"item_id": item_id, "is_completed": False, "is_cancelled": False},
            {"trader_item_id": item_id, "is_completed": False, "is_cancelled": False},
            {"owner_item_ids": item_id, "is_completed": False, "is_cancelled": False},
            {"trader_item_ids": item_id, "is_completed": False, "is_cancelled": False}
        ]
    }, {"_id": 0}).to_list(100)
    
    # Cancel trades and create notifications
    for trade in active_trades:
        # Get both parties' info
        owner = await db.users.find_one({"user_id": trade["owner_id"]}, {"_id": 0})
        trader = await db.users.find_one({"user_id": trade["trader_id"]}, {"_id": 0})
        
        owner_name = owner.get("username") or owner.get("name", "User") if owner else "User"
        trader_name = trader.get("username") or trader.get("name", "User") if trader else "User"
        
        # Cancel the trade
        await db.trades.update_one(
            {"trade_id": trade["trade_id"]},
            {"$set": {
                "is_cancelled": True,
                "cancelled_at": datetime.now(timezone.utc).isoformat(),
                "cancelled_by": admin.user_id
            }}
        )
        
        # Delete all messages for this trade
        await db.messages.delete_many({"trade_id": trade["trade_id"]})
        
        # Create notification for owner (if not the admin)
        if trade["owner_id"] != admin.user_id:
            message = f"Your trade with {trader_name} was canceled because admin removed an item."
            await create_and_send_notification(
                user_id=trade["owner_id"],
                notification_type="trade_cancelled",
                message=message,
                data={"trade_id": trade["trade_id"], "item_id": item_id}
            )
        
        # Create notification for trader (if not the admin)
        if trade["trader_id"] != admin.user_id:
            message = f"Your trade with {owner_name} was canceled because admin removed an item."
            await create_and_send_notification(
                user_id=trade["trader_id"],
                notification_type="trade_cancelled",
                message=message,
                data={"trade_id": trade["trade_id"], "item_id": item_id}
            )
    
    await db.items.delete_one({"item_id": item_id})
    
    # Resolve all pending reports for this item
    await db.reports.update_many(
        {"reported_item_id": item_id, "status": "pending"},
        {"$set": {
            "status": "resolved",
            "resolved_at": datetime.now(timezone.utc).isoformat(),
            "resolved_by": admin.user_id,
            "action_taken": "item_removed"
        }}
    )
    
    return {"message": "Item deleted by admin", "trades_cancelled": len(active_trades)}

@api_router.post("/admin/users/{user_id}/promote")
async def admin_promote_user(user_id: str, admin: User = Depends(get_admin_user)):
    """Promote user to admin"""
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user.get("is_admin", False):
        raise HTTPException(status_code=400, detail="User is already an admin")
    
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"is_admin": True}}
    )
    
    updated_user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"message": "User promoted to admin", "user": updated_user}

@api_router.post("/admin/users/{user_id}/demote")
async def admin_demote_user(user_id: str, admin: User = Depends(get_admin_user)):
    """Remove admin status from user"""
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user_id == admin.user_id:
        raise HTTPException(status_code=400, detail="Cannot demote yourself")
    
    # Only allow homemail192@gmail.com to demote admins
    if admin.email.lower() != "homemail192@gmail.com":
        raise HTTPException(status_code=403, detail="Only the primary admin can demote users")
    
    if not user.get("is_admin", False):
        raise HTTPException(status_code=400, detail="User is not an admin")
    
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"is_admin": False}}
    )
    
    updated_user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"message": "User demoted from admin", "user": updated_user}

@api_router.delete("/admin/users/{user_id}")
async def admin_delete_user(user_id: str, admin: User = Depends(get_admin_user)):
    """Delete user account (admin only)"""
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if user_id == admin.user_id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    # Delete user and related data
    await db.users.delete_one({"user_id": user_id})
    await db.user_sessions.delete_many({"user_id": user_id})
    await db.items.delete_many({"user_id": user_id})
    await db.messages.delete_many({"$or": [{"sender_id": user_id}, {"receiver_id": user_id}]})
    # Note: Trades are kept for historical record, but could be deleted if needed
    
    # Resolve all pending reports for this user
    await db.reports.update_many(
        {"reported_user_id": user_id, "status": "pending"},
        {"$set": {
            "status": "resolved",
            "resolved_at": datetime.now(timezone.utc).isoformat(),
            "resolved_by": admin.user_id,
            "action_taken": "user_banned"
        }}
    )
    
    return {"message": "User deleted"}

@api_router.post("/admin/reset-database")
async def admin_reset_database(admin: User = Depends(get_admin_user)):
    """Reset entire database - DELETE ALL DATA (only for homemail192@gmail.com)"""
    # Only allow the primary admin email
    if admin.email.lower() != "homemail192@gmail.com":
        raise HTTPException(status_code=403, detail="Only the primary admin can reset the database")
    
    # Delete all collections
    await db.users.delete_many({})
    await db.items.delete_many({})
    await db.trades.delete_many({})
    await db.messages.delete_many({})
    await db.categories.delete_many({})
    await db.notifications.delete_many({})
    await db.user_sessions.delete_many({})
    
    logger.warning(f"Database reset by admin: {admin.email}")
    
    return {"message": "Database reset successfully. All data has been deleted."}

@api_router.get("/admin/trades")
async def admin_get_trades(admin: User = Depends(get_admin_user)):
    """Get all trades (admin only)"""
    trades = await db.trades.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # Collect all item IDs and user IDs for bulk fetching
    all_item_ids = set()
    user_ids = set()
    migrated_trades = []
    
    for trade in trades:
        # Migrate if needed
        trade = await migrate_trade_to_array_format(trade)
        migrated_trades.append(trade)
        
        # Collect item IDs
        for item_id in trade.get("owner_item_ids", []):
            all_item_ids.add(item_id)
        for item_id in trade.get("trader_item_ids", []):
            all_item_ids.add(item_id)
        
        # Collect user IDs
        user_ids.add(trade["owner_id"])
        user_ids.add(trade["trader_id"])
    
    # Bulk fetch all items
    items_dict = {}
    if all_item_ids:
        items_cursor = db.items.find({"item_id": {"$in": list(all_item_ids)}}, {"_id": 0})
        async for item in items_cursor:
            items_dict[item["item_id"]] = item
    
    # Bulk fetch all users
    users_dict = {}
    if user_ids:
        users_cursor = db.users.find({"user_id": {"$in": list(user_ids)}}, {"_id": 0})
        async for user_doc in users_cursor:
            users_dict[user_doc["user_id"]] = user_doc
    
    # Build result
    result = []
    for trade in migrated_trades:
        owner_items = [items_dict[item_id] for item_id in trade.get("owner_item_ids", []) if item_id in items_dict]
        trader_items = [items_dict[item_id] for item_id in trade.get("trader_item_ids", []) if item_id in items_dict]
        
        result.append({
            "trade": trade,
            "owner_items": owner_items,
            "trader_items": trader_items,
            "owner": users_dict.get(trade["owner_id"]),
            "trader": users_dict.get(trade["trader_id"])
        })
    
    return result

@api_router.get("/admin/messages")
async def admin_get_messages(admin: User = Depends(get_admin_user), skip: int = 0, limit: int = 100):
    """Get all messages with pagination (admin only)"""
    messages = await db.messages.find({}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Get total count
    total = await db.messages.count_documents({})
    
    # Enrich with user data
    result = []
    for msg in messages:
        sender = await db.users.find_one({"user_id": msg["sender_id"]}, {"_id": 0})
        receiver = await db.users.find_one({"user_id": msg["receiver_id"]}, {"_id": 0})
        result.append({
            "message": msg,
            "sender": sender,
            "receiver": receiver
        })
    
    return {"messages": result, "total": total, "skip": skip, "limit": limit}

# ============== ROOT ==============

@api_router.get("/")
async def root():
    """Health check endpoint"""
    try:
        # Test MongoDB connection
        db = get_db()
        await _client.admin.command('ping')
        return {
            "message": "SwapFlow API",
            "status": "healthy",
            "database": "connected"
        }
    except Exception as e:
        logger.error(f"Database health check failed: {str(e)}")
        return {
            "message": "SwapFlow API",
            "status": "degraded",
            "database": "disconnected",
            "error": str(e)
        }

# Include the router in the main app
app.include_router(api_router)

# CORS configuration with auto-detection for localhost
def get_cors_origins():
    """Get CORS origins, automatically including localhost when running locally"""
    # Get origins from environment variable
    env_origins = os.environ.get('CORS_ORIGINS', 'https://swapflow-app.vercel.app').split(',')
    env_origins = [origin.strip() for origin in env_origins if origin.strip()]
    
    # Check if we're running locally (not on Vercel)
    # Vercel sets VERCEL environment variable
    is_vercel = os.environ.get('VERCEL') == '1'
    is_local = not is_vercel
    
    # If running locally, add localhost origins
    if is_local:
        localhost_origins = [
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            'http://localhost:3001',  # In case port 3000 is busy
            'http://127.0.0.1:3001'
        ]
        # Merge localhost origins with environment origins, avoiding duplicates
        all_origins = list(set(env_origins + localhost_origins))
        logger.info(f"Running locally - CORS origins include localhost: {all_origins}")
        return all_origins
    
    # Production: use only environment origins
    logger.info(f"Running on Vercel - CORS origins: {env_origins}")
    return env_origins

cors_origins = get_cors_origins()

# Add explicit OPTIONS handler for CORS preflight
@app.options("/{full_path:path}")
async def options_handler(full_path: str):
    return Response(status_code=200)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=cors_origins if cors_origins else ['https://swapflow-app.vercel.app'],
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    global _client
    if _client:
        _client.close()
