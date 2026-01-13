from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, UploadFile, File, Depends, WebSocket, WebSocketDisconnect
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
active_connections: dict[str, WebSocket] = {}

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
        _client = AsyncIOMotorClient(
            mongo_url, 
            serverSelectionTimeoutMS=10000,
            connectTimeoutMS=10000,
            socketTimeoutMS=10000
        )
        _db = _client[db_name]
        logger.info(f"Connected to MongoDB database: {db_name}")
        return _db
    except Exception as e:
        logger.error(f"Failed to connect to MongoDB: {str(e)}")
        raise

# Log environment variable status (without exposing secrets)
logger.info(f"MONGO_URL configured: {bool(os.environ.get('MONGO_URL'))}")
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
    sender_id: str
    receiver_id: str
    item_id: Optional[str] = None
    content: str
    read_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class MessageCreate(BaseModel):
    receiver_id: str
    item_id: Optional[str] = None
    content: str

class Trade(BaseModel):
    trade_id: str = Field(default_factory=lambda: f"trade_{uuid.uuid4().hex[:12]}")
    item_id: str
    trader_item_id: str
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

class TradeCreate(BaseModel):
    item_id: str
    trader_item_id: str
    owner_id: str

class RatingCreate(BaseModel):
    rating: int

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

@api_router.get("/items")
async def get_items(category: Optional[str] = None, user_id: Optional[str] = None):
    """Get all available items, optionally filtered by category or user"""
    query = {"is_available": True}
    if category:
        query["category"] = category
        # Increment category click count
        await db.categories.update_one(
            {"name": category},
            {"$inc": {"click_count": 1}},
            upsert=True
        )
    if user_id:
        query["user_id"] = user_id
    
    items = await db.items.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Convert datetime strings if needed
    for item in items:
        if isinstance(item.get("created_at"), str):
            item["created_at"] = datetime.fromisoformat(item["created_at"])
    
    return items

@api_router.get("/items/{item_id}")
async def get_item(item_id: str):
    """Get item by ID"""
    item = await db.items.find_one({"item_id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Get owner info
    owner = await db.users.find_one({"user_id": item["user_id"]}, {"_id": 0})
    
    return {"item": item, "owner": owner}

@api_router.post("/items")
async def create_item(item_data: ItemCreate, user: User = Depends(get_current_user)):
    """Create a new item for trade"""
    # Validate category is single word
    category = item_data.category.strip().lower()
    if " " in category:
        raise HTTPException(status_code=400, detail="Category must be a single word")
    
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
    
    # Add/update category
    await db.categories.update_one(
        {"name": category},
        {"$setOnInsert": {"name": category, "click_count": 0}},
        upsert=True
    )
    
    return item_dict

@api_router.delete("/items/{item_id}")
async def delete_item(item_id: str, user: User = Depends(get_current_user)):
    """Delete an item (only owner can delete)"""
    item = await db.items.find_one({"item_id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if item["user_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.items.delete_one({"item_id": item_id})
    return {"message": "Item deleted"}

@api_router.get("/my-items")
async def get_my_items(user: User = Depends(get_current_user)):
    """Get current user's items"""
    items = await db.items.find({"user_id": user.user_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return items

# ============== CATEGORY ENDPOINTS ==============

@api_router.get("/categories")
async def get_categories():
    """Get all categories sorted by click count (most popular first)"""
    categories = await db.categories.find({}, {"_id": 0}).sort("click_count", -1).to_list(50)
    return categories

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
    """Get all conversations for current user"""
    # Find unique conversation partners
    pipeline = [
        {"$match": {"$or": [{"sender_id": user.user_id}, {"receiver_id": user.user_id}]}},
        {"$sort": {"created_at": -1}},
        {"$group": {
            "_id": {
                "$cond": [
                    {"$eq": ["$sender_id", user.user_id]},
                    "$receiver_id",
                    "$sender_id"
                ]
            },
            "last_message": {"$first": "$content"},
            "last_message_time": {"$first": "$created_at"},
            "item_id": {"$first": "$item_id"}
        }},
        {"$sort": {"last_message_time": -1}}
    ]
    
    conversations = await db.messages.aggregate(pipeline).to_list(50)
    
    # Get user info and unread count for each conversation
    result = []
    for conv in conversations:
        partner = await db.users.find_one({"user_id": conv["_id"]}, {"_id": 0})
        if partner:
            # Count unread messages from this partner
            unread_count = await db.messages.count_documents({
                "sender_id": conv["_id"],
                "receiver_id": user.user_id,
                "read_at": None
            })
            
            result.append({
                "partner": partner,
                "last_message": conv["last_message"],
                "last_message_time": conv["last_message_time"],
                "item_id": conv.get("item_id"),
                "unread_count": unread_count
            })
    
    return result

@api_router.get("/messages/unread-count")
async def get_unread_count(user: User = Depends(get_current_user)):
    """Get total unread message count for current user"""
    count = await db.messages.count_documents({
        "receiver_id": user.user_id,
        "read_at": None
    })
    return {"unread_count": count}

@api_router.post("/messages/{partner_id}/mark-read")
async def mark_messages_read(partner_id: str, user: User = Depends(get_current_user)):
    """Mark all messages from a partner as read"""
    result = await db.messages.update_many(
        {
            "sender_id": partner_id,
            "receiver_id": user.user_id,
            "read_at": None
        },
        {
            "$set": {"read_at": datetime.now(timezone.utc).isoformat()}
        }
    )
    return {"message": "Messages marked as read", "updated_count": result.modified_count}

@api_router.get("/messages/{partner_id}")
async def get_messages(partner_id: str, user: User = Depends(get_current_user)):
    """Get messages with a specific user"""
    messages = await db.messages.find({
        "$or": [
            {"sender_id": user.user_id, "receiver_id": partner_id},
            {"sender_id": partner_id, "receiver_id": user.user_id}
        ]
    }, {"_id": 0}).sort("created_at", 1).to_list(100)
    
    return messages

@api_router.post("/messages")
async def send_message(msg: MessageCreate, user: User = Depends(get_current_user)):
    """Send a message to another user"""
    message = Message(
        sender_id=user.user_id,
        receiver_id=msg.receiver_id,
        item_id=msg.item_id,
        content=msg.content,
        read_at=None
    )
    
    msg_dict = message.model_dump()
    msg_dict["created_at"] = msg_dict["created_at"].isoformat()
    
    # Create a copy for insertion to avoid _id contamination
    insert_dict = msg_dict.copy()
    await db.messages.insert_one(insert_dict)
    
    # Broadcast to WebSocket connections
    broadcast_data = {
        "type": "new_message",
        "message": msg_dict
    }
    # Send to sender and receiver if they're connected
    for user_id in [user.user_id, msg.receiver_id]:
        if user_id in active_connections:
            try:
                await active_connections[user_id].send_text(json.dumps(broadcast_data))
            except Exception:
                # Remove dead connection
                active_connections.pop(user_id, None)
    
    return msg_dict

@api_router.websocket("/ws/messages")
async def websocket_messages(websocket: WebSocket):
    """WebSocket endpoint for real-time message delivery"""
    await websocket.accept()
    user_id = None
    
    try:
        # Get user from query params or headers
        # For simplicity, we'll use a token-based approach
        # In production, you'd validate the token properly
        token = websocket.query_params.get("token") or websocket.headers.get("authorization", "").replace("Bearer ", "")
        
        if not token:
            await websocket.close(code=1008, reason="Authentication required")
            return
        
        # Get user from session token
        session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
        if not session:
            await websocket.close(code=1008, reason="Invalid session")
            return
        
        user_id = session["user_id"]
        active_connections[user_id] = websocket
        
        # Send connection confirmation
        await websocket.send_text(json.dumps({"type": "connected", "user_id": user_id}))
        
        # Keep connection alive and handle incoming messages
        while True:
            data = await websocket.receive_text()
            # Handle ping/pong or other messages if needed
            if data == "ping":
                await websocket.send_text("pong")
            
    except WebSocketDisconnect:
        if user_id:
            active_connections.pop(user_id, None)
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}")
        if user_id:
            active_connections.pop(user_id, None)
        await websocket.close()

# ============== TRADE ENDPOINTS ==============

@api_router.post("/trades")
async def create_trade(trade_data: TradeCreate, user: User = Depends(get_current_user)):
    """Initiate a trade for an item"""
    # Check if item exists and is available
    item = await db.items.find_one({"item_id": trade_data.item_id, "is_available": True}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found or not available")
    
    # Can't trade with yourself
    if item["user_id"] == user.user_id:
        raise HTTPException(status_code=400, detail="Cannot trade with yourself")
    
    # Validate trader's item exists and belongs to trader
    trader_item = await db.items.find_one({"item_id": trade_data.trader_item_id, "is_available": True}, {"_id": 0})
    if not trader_item:
        raise HTTPException(status_code=404, detail="Your item not found or not available")
    
    if trader_item["user_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="You can only trade with your own items")
    
    # Check if trade already exists
    existing_trade = await db.trades.find_one({
        "item_id": trade_data.item_id,
        "trader_item_id": trade_data.trader_item_id,
        "trader_id": user.user_id,
        "is_completed": False,
        "is_cancelled": False
    }, {"_id": 0})
    
    if existing_trade:
        return existing_trade
    
    trade = Trade(
        item_id=trade_data.item_id,
        trader_item_id=trade_data.trader_item_id,
        owner_id=item["user_id"],
        trader_id=user.user_id
    )
    
    trade_dict = trade.model_dump()
    trade_dict["created_at"] = trade_dict["created_at"].isoformat()
    
    # Create a copy for insertion to avoid _id contamination
    insert_dict = trade_dict.copy()
    await db.trades.insert_one(insert_dict)
    return trade_dict

@api_router.get("/trades")
async def get_my_trades(user: User = Depends(get_current_user)):
    """Get all trades for current user"""
    trades = await db.trades.find({
        "$or": [{"owner_id": user.user_id}, {"trader_id": user.user_id}]
    }, {"_id": 0}).sort("created_at", -1).to_list(50)
    
    # Enrich with item and user data
    result = []
    for trade in trades:
        item = await db.items.find_one({"item_id": trade["item_id"]}, {"_id": 0})
        trader_item = await db.items.find_one({"item_id": trade.get("trader_item_id")}, {"_id": 0}) if trade.get("trader_item_id") else None
        owner = await db.users.find_one({"user_id": trade["owner_id"]}, {"_id": 0})
        trader = await db.users.find_one({"user_id": trade["trader_id"]}, {"_id": 0})
        result.append({
            "trade": trade,
            "item": item,
            "trader_item": trader_item,
            "owner": owner,
            "trader": trader
        })
    
    return result

@api_router.get("/trades/{trade_id}")
async def get_trade(trade_id: str, user: User = Depends(get_current_user)):
    """Get trade details"""
    trade = await db.trades.find_one({"trade_id": trade_id}, {"_id": 0})
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    
    # Only participants can view
    if trade["owner_id"] != user.user_id and trade["trader_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    item = await db.items.find_one({"item_id": trade["item_id"]}, {"_id": 0})
    trader_item = await db.items.find_one({"item_id": trade.get("trader_item_id")}, {"_id": 0}) if trade.get("trader_item_id") else None
    owner = await db.users.find_one({"user_id": trade["owner_id"]}, {"_id": 0})
    trader = await db.users.find_one({"user_id": trade["trader_id"]}, {"_id": 0})
    
    return {"trade": trade, "item": item, "trader_item": trader_item, "owner": owner, "trader": trader}

@api_router.delete("/trades/{trade_id}")
async def cancel_trade(trade_id: str, user: User = Depends(get_current_user)):
    """Cancel a trade"""
    trade = await db.trades.find_one({"trade_id": trade_id}, {"_id": 0})
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    
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
    
    updated_trade = await db.trades.find_one({"trade_id": trade_id}, {"_id": 0})
    return {"message": "Trade cancelled", "trade": updated_trade}

@api_router.post("/trades/{trade_id}/confirm")
async def confirm_trade(trade_id: str, user: User = Depends(get_current_user)):
    """Confirm trade completion (both parties must confirm)"""
    trade = await db.trades.find_one({"trade_id": trade_id}, {"_id": 0})
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    
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
    
    if updated_trade["owner_confirmed"] and updated_trade["trader_confirmed"]:
        # Complete the trade
        await db.trades.update_one(
            {"trade_id": trade_id},
            {"$set": {
                "is_completed": True,
                "completed_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Mark item as unavailable
        await db.items.update_one(
            {"item_id": trade["item_id"]},
            {"$set": {"is_available": False}}
        )
        
        # Award trade points to both users
        await db.users.update_one({"user_id": trade["owner_id"]}, {"$inc": {"trade_points": 1}})
        await db.users.update_one({"user_id": trade["trader_id"]}, {"$inc": {"trade_points": 1}})
        
        updated_trade = await db.trades.find_one({"trade_id": trade_id}, {"_id": 0})
    
    return updated_trade

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
    
    # Delete all active trades involving this item
    deleted_trades = await db.trades.delete_many({
        "$or": [
            {"item_id": item_id, "is_completed": False, "is_cancelled": False},
            {"trader_item_id": item_id, "is_completed": False, "is_cancelled": False}
        ]
    })
    
    await db.items.delete_one({"item_id": item_id})
    return {"message": "Item deleted by admin", "trades_deleted": deleted_trades.deleted_count}

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
    
    return {"message": "User deleted"}

@api_router.get("/admin/trades")
async def admin_get_trades(admin: User = Depends(get_admin_user)):
    """Get all trades (admin only)"""
    trades = await db.trades.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # Enrich with item and user data
    result = []
    for trade in trades:
        item = await db.items.find_one({"item_id": trade["item_id"]}, {"_id": 0})
        owner = await db.users.find_one({"user_id": trade["owner_id"]}, {"_id": 0})
        trader = await db.users.find_one({"user_id": trade["trader_id"]}, {"_id": 0})
        result.append({
            "trade": trade,
            "item": item,
            "owner": owner,
            "trader": trader
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

# CORS configuration
cors_origins = os.environ.get('CORS_ORIGINS', 'https://swapflow-app.vercel.app').split(',')
# Remove any empty strings and ensure we have valid origins
cors_origins = [origin.strip() for origin in cors_origins if origin.strip()]

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
