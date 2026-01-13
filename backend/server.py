from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, UploadFile, File, Depends
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
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ItemCreate(BaseModel):
    title: str
    description: Optional[str] = None
    image: str
    category: str

class Category(BaseModel):
    name: str
    click_count: int = 0

class Message(BaseModel):
    message_id: str = Field(default_factory=lambda: f"msg_{uuid.uuid4().hex[:12]}")
    sender_id: str
    receiver_id: str
    item_id: Optional[str] = None
    content: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class MessageCreate(BaseModel):
    receiver_id: str
    item_id: Optional[str] = None
    content: str

class Trade(BaseModel):
    trade_id: str = Field(default_factory=lambda: f"trade_{uuid.uuid4().hex[:12]}")
    item_id: str
    owner_id: str
    trader_id: str
    owner_confirmed: bool = False
    trader_confirmed: bool = False
    is_completed: bool = False
    owner_rating: Optional[int] = None
    trader_rating: Optional[int] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None

class TradeCreate(BaseModel):
    item_id: str
    owner_id: str

class RatingCreate(BaseModel):
    rating: int

# ============== AUTH HELPERS ==============

async def get_current_user(request: Request) -> User:
    """Get current user from session token in cookie or Authorization header"""
    # #region agent log
    import json
    import time
    try:
        cookies = dict(request.cookies)
        auth_header = request.headers.get("Authorization")
        with open('/Users/ronaldabberman/Downloads/New-website-Yuh-main/.cursor/debug.log', 'a') as f:
            f.write(json.dumps({"location":"server.py:150","message":"get_current_user called","data":{"hasSessionCookie":"session_token" in cookies,"hasAuthHeader":bool(auth_header),"authHeaderPreview":auth_header[:30]+"..." if auth_header else None,"allCookies":list(cookies.keys()),"origin":request.headers.get("origin"),"path":str(request.url.path)},"timestamp":int(time.time()*1000),"sessionId":"debug-session","runId":"run1","hypothesisId":"H1"})+"\n")
    except:
        pass
    # #endregion

    session_token = request.cookies.get("session_token")
    
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
            # #region agent log
            try:
                with open('/Users/ronaldabberman/Downloads/New-website-Yuh-main/.cursor/debug.log', 'a') as f:
                    f.write(json.dumps({"location":"server.py:162","message":"Using Bearer token from header","data":{"tokenPreview":session_token[:20]+"..."},"timestamp":int(time.time()*1000),"sessionId":"debug-session","runId":"run1","hypothesisId":"H1"})+"\n")
            except:
                pass
            # #endregion
    
    if not session_token:
        # #region agent log
        try:
            with open('/Users/ronaldabberman/Downloads/New-website-Yuh-main/.cursor/debug.log', 'a') as f:
                f.write(json.dumps({"location":"server.py:170","message":"No session token found","data":{},"timestamp":int(time.time()*1000),"sessionId":"debug-session","runId":"run1","hypothesisId":"H1"})+"\n")
        except:
            pass
        # #endregion
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
    
    return User(**user)

async def get_optional_user(request: Request) -> Optional[User]:
    """Get current user if authenticated, otherwise return None"""
    try:
        return await get_current_user(request)
    except HTTPException:
        return None

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
    
    if existing_user:
        user_id = existing_user["user_id"]
        # Update user info if needed
        try:
            await db.users.update_one(
                {"user_id": user_id},
                {"$set": {
                    "name": name,
                    "picture": picture
                }}
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
        category=category
    )
    
    item_dict = item.model_dump()
    item_dict["created_at"] = item_dict["created_at"].isoformat()
    
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
    
    # Get user info for each conversation
    result = []
    for conv in conversations:
        partner = await db.users.find_one({"user_id": conv["_id"]}, {"_id": 0})
        if partner:
            result.append({
                "partner": partner,
                "last_message": conv["last_message"],
                "last_message_time": conv["last_message_time"],
                "item_id": conv.get("item_id")
            })
    
    return result

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
        content=msg.content
    )
    
    msg_dict = message.model_dump()
    msg_dict["created_at"] = msg_dict["created_at"].isoformat()
    
    # Create a copy for insertion to avoid _id contamination
    insert_dict = msg_dict.copy()
    await db.messages.insert_one(insert_dict)
    return msg_dict

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
    
    # Check if trade already exists
    existing_trade = await db.trades.find_one({
        "item_id": trade_data.item_id,
        "trader_id": user.user_id,
        "is_completed": False
    }, {"_id": 0})
    
    if existing_trade:
        return existing_trade
    
    trade = Trade(
        item_id=trade_data.item_id,
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
        owner = await db.users.find_one({"user_id": trade["owner_id"]}, {"_id": 0})
        trader = await db.users.find_one({"user_id": trade["trader_id"]}, {"_id": 0})
        result.append({
            "trade": trade,
            "item": item,
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
    owner = await db.users.find_one({"user_id": trade["owner_id"]}, {"_id": 0})
    trader = await db.users.find_one({"user_id": trade["trader_id"]}, {"_id": 0})
    
    return {"trade": trade, "item": item, "owner": owner, "trader": trader}

@api_router.post("/trades/{trade_id}/confirm")
async def confirm_trade(trade_id: str, user: User = Depends(get_current_user)):
    """Confirm trade completion (both parties must confirm)"""
    trade = await db.trades.find_one({"trade_id": trade_id}, {"_id": 0})
    if not trade:
        raise HTTPException(status_code=404, detail="Trade not found")
    
    if trade["is_completed"]:
        raise HTTPException(status_code=400, detail="Trade already completed")
    
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
