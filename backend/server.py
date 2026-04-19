from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import re
import uuid
import math
import logging
import bcrypt
import jwt
import requests
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, UploadFile, File, Header, Query, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict

# --- MongoDB Connection ---
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7
APP_NAME = os.environ.get("APP_NAME", "localconnect-lite")
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"
DEFAULT_RADIUS_KM = 5.0

MIME_TYPES = {
    "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
    "gif": "image/gif", "webp": "image/webp",
}

MENTION_RE = re.compile(r"(?:^|\s)@([a-zA-Z][a-zA-Z0-9_]{1,30})")

def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]

app = FastAPI(title="LocalConnect Lite API")
api_router = APIRouter(prefix="/api")
bearer_scheme = HTTPBearer(auto_error=False)

# --- Object Storage ---
_storage_key: Optional[str] = None

def init_storage() -> Optional[str]:
    global _storage_key
    if _storage_key:
        return _storage_key
    if not EMERGENT_KEY:
        return None
    try:
        resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
        resp.raise_for_status()
        _storage_key = resp.json()["storage_key"]
        return _storage_key
    except Exception as e:
        logging.error(f"Storage init failed: {e}")
        return None

def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    if not key:
        raise HTTPException(status_code=500, detail="Storage unavailable")
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120,
    )
    resp.raise_for_status()
    return resp.json()

def get_object(path: str):
    key = init_storage()
    if not key:
        raise HTTPException(status_code=500, detail="Storage unavailable")
    resp = requests.get(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key}, timeout=60,
    )
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")

# --- Geo helpers ---
def haversine_km(lat1, lng1, lat2, lng2) -> float:
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp/2)**2 + math.cos(p1) * math.cos(p2) * math.sin(dl/2)**2
    return 2 * R * math.asin(math.sqrt(a))

def normalize_area(area: str) -> str:
    return area.strip().lower()

def extract_mentions(text: str) -> list:
    return list({m.lower() for m in MENTION_RE.findall(text or "")})

# --- Models ---
AccountType = Literal["personal", "business"]
BusinessCategory = Literal["food", "grocery", "cafe", "retail", "services", "health", "other"]

class UserSignup(BaseModel):
    name: str = Field(..., min_length=1, max_length=60)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)
    area: str = Field(..., min_length=1, max_length=60)
    account_type: AccountType = "personal"
    phone: Optional[str] = Field(None, max_length=20)
    business_name: Optional[str] = Field(None, max_length=80)
    business_category: Optional[BusinessCategory] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserUpdate(BaseModel):
    name: Optional[str] = None
    area: Optional[str] = None
    bio: Optional[str] = Field(None, max_length=180)
    avatar_path: Optional[str] = None
    phone: Optional[str] = Field(None, max_length=20)
    business_name: Optional[str] = Field(None, max_length=80)
    business_category: Optional[BusinessCategory] = None
    shop_image_path: Optional[str] = None

class LocationUpdate(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lng: float = Field(..., ge=-180, le=180)

class UserOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    email: EmailStr
    area: str
    bio: str = ""
    avatar_path: Optional[str] = None
    account_type: str = "personal"
    phone: Optional[str] = None
    business_name: Optional[str] = None
    business_category: Optional[str] = None
    shop_image_path: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    created_at: datetime
    followers_count: int = 0
    following_count: int = 0
    is_following: bool = False
    distance_km: Optional[float] = None

class AuthResponse(BaseModel):
    token: str
    user: UserOut

class PostCreate(BaseModel):
    content: str = Field(default="", max_length=500)
    type: Literal["normal", "offer"] = "normal"
    image_paths: List[str] = Field(default_factory=list, max_length=6)

class PostOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    user_name: str
    user_avatar_path: Optional[str] = None
    user_account_type: str = "personal"
    content: str
    type: str
    area: str
    image_paths: List[str] = Field(default_factory=list)
    timestamp: datetime
    likes: int
    liked: bool = False
    saved: bool = False
    comments_count: int = 0

class LikeResponse(BaseModel):
    post_id: str
    likes: int
    liked: bool

class SaveResponse(BaseModel):
    post_id: str
    saved: bool

class FollowResponse(BaseModel):
    user_id: str
    following: bool
    followers_count: int

class CommentCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=300)

class CommentOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    post_id: str
    user_id: str
    user_name: str
    user_avatar_path: Optional[str] = None
    content: str
    timestamp: datetime

class ProductCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    description: str = Field(default="", max_length=300)
    price: float = Field(..., ge=0)
    image_path: Optional[str] = None
    category: str = Field(default="other", max_length=30)
    is_offer: bool = False
    is_available: bool = True

class ProductOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    business_id: str
    business_name: str
    business_category: Optional[str] = None
    shop_image_path: Optional[str] = None
    business_area: str
    name: str
    description: str = ""
    price: float
    image_path: Optional[str] = None
    category: str = "other"
    is_offer: bool = False
    is_available: bool = True
    created_at: datetime
    distance_km: Optional[float] = None

class EventCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=120)
    description: str = Field(default="", max_length=500)
    event_date: Optional[datetime] = None
    image_path: Optional[str] = None
    location_name: Optional[str] = Field(None, max_length=120)

class EventOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    user_name: str
    user_avatar_path: Optional[str] = None
    title: str
    description: str = ""
    event_date: Optional[datetime] = None
    image_path: Optional[str] = None
    area: str
    location_name: Optional[str] = None
    attendees_count: int = 0
    going: bool = False
    created_at: datetime
    distance_km: Optional[float] = None

class NotificationOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    type: str
    actor_id: Optional[str] = None
    actor_name: Optional[str] = None
    actor_avatar_path: Optional[str] = None
    target_post_id: Optional[str] = None
    target_event_id: Optional[str] = None
    target_product_id: Optional[str] = None
    message: str
    read: bool
    created_at: datetime

class UploadResponse(BaseModel):
    path: str
    size: int

# --- Auth Helpers ---
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id, "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
        "type": "access",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token type")
    return payload

async def get_current_user(
    request: Request,
    creds: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> dict:
    token = creds.credentials if creds and creds.scheme.lower() == "bearer" else None
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = decode_token(token)
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def to_iso(dt):
    if isinstance(dt, str):
        return datetime.fromisoformat(dt)
    return dt

async def serialize_user(doc: dict, viewer_id: Optional[str] = None, viewer_loc: Optional[dict] = None) -> dict:
    is_following = False
    if viewer_id and viewer_id != doc["id"]:
        viewer = await db.users.find_one({"id": viewer_id}, {"following": 1, "_id": 0})
        is_following = bool(viewer and doc["id"] in viewer.get("following", []))
    distance_km = None
    if viewer_loc and doc.get("lat") is not None and doc.get("lng") is not None:
        distance_km = round(haversine_km(viewer_loc["lat"], viewer_loc["lng"], doc["lat"], doc["lng"]), 2)
    return {
        "id": doc["id"],
        "name": doc["name"],
        "email": doc["email"],
        "area": doc["area"],
        "bio": doc.get("bio", "") or "",
        "avatar_path": doc.get("avatar_path"),
        "account_type": doc.get("account_type", "personal"),
        "phone": doc.get("phone"),
        "business_name": doc.get("business_name"),
        "business_category": doc.get("business_category"),
        "shop_image_path": doc.get("shop_image_path"),
        "lat": doc.get("lat"),
        "lng": doc.get("lng"),
        "created_at": to_iso(doc["created_at"]),
        "followers_count": doc.get("followers_count", 0),
        "following_count": doc.get("following_count", 0),
        "is_following": is_following,
        "distance_km": distance_km,
    }

async def post_doc_to_out(doc: dict, viewer_id: str) -> dict:
    liked_by = doc.get("liked_by", [])
    saved_by = doc.get("saved_by", [])
    comments_count = await db.comments.count_documents({"post_id": doc["id"]})
    author = await db.users.find_one({"id": doc["user_id"]}, {"avatar_path": 1, "account_type": 1, "_id": 0})
    image_paths = doc.get("image_paths") or ([doc["image_path"]] if doc.get("image_path") else [])
    return {
        "id": doc["id"],
        "user_id": doc["user_id"],
        "user_name": doc["user_name"],
        "user_avatar_path": (author or {}).get("avatar_path"),
        "user_account_type": (author or {}).get("account_type", "personal"),
        "content": doc["content"],
        "type": doc["type"],
        "area": doc["area"],
        "image_paths": image_paths,
        "timestamp": to_iso(doc["timestamp"]),
        "likes": len(liked_by),
        "liked": viewer_id in liked_by,
        "saved": viewer_id in saved_by,
        "comments_count": comments_count,
    }

async def notify(user_id: str, ntype: str, actor_id: Optional[str], message: str,
                 target_post_id: Optional[str] = None, target_event_id: Optional[str] = None,
                 target_product_id: Optional[str] = None):
    if user_id == actor_id:
        return
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "type": ntype,
        "actor_id": actor_id,
        "target_post_id": target_post_id,
        "target_event_id": target_event_id,
        "target_product_id": target_product_id,
        "message": message,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

async def process_mentions(content: str, actor: dict, post_id: Optional[str] = None):
    names = extract_mentions(content)
    if not names:
        return
    # Match mentions to users by name (simple: first word of name, case insensitive)
    for n in names:
        target = await db.users.find_one({
            "name": {"$regex": f"^{re.escape(n)}", "$options": "i"}
        }, {"id": 1, "_id": 0})
        if target and target["id"] != actor["id"]:
            await notify(
                target["id"], "mention", actor["id"],
                f"{actor['name']} mentioned you",
                target_post_id=post_id,
            )

# --- Auth Routes ---
@api_router.post("/auth/signup", response_model=AuthResponse)
async def signup(payload: UserSignup):
    email = payload.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    if payload.account_type == "business" and not payload.business_name:
        raise HTTPException(status_code=400, detail="Business name is required")
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    user_doc = {
        "id": user_id,
        "name": payload.name.strip(),
        "email": email,
        "password_hash": hash_password(payload.password),
        "area": payload.area.strip(),
        "area_key": normalize_area(payload.area),
        "bio": "",
        "avatar_path": None,
        "account_type": payload.account_type,
        "phone": payload.phone,
        "business_name": (payload.business_name or "").strip() or None,
        "business_category": payload.business_category,
        "shop_image_path": None,
        "lat": None,
        "lng": None,
        "following": [],
        "followers_count": 0,
        "following_count": 0,
        "created_at": now,
    }
    await db.users.insert_one(user_doc)
    token = create_access_token(user_id, email)
    return AuthResponse(token=token, user=UserOut(**(await serialize_user(user_doc, user_id))))

@api_router.post("/auth/login", response_model=AuthResponse)
async def login(payload: UserLogin):
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user["id"], email)
    return AuthResponse(token=token, user=UserOut(**(await serialize_user(user, user["id"]))))

@api_router.get("/auth/me", response_model=UserOut)
async def me(current_user: dict = Depends(get_current_user)):
    return UserOut(**(await serialize_user(current_user, current_user["id"])))

# --- Users ---
@api_router.patch("/users/me", response_model=UserOut)
async def update_me(payload: UserUpdate, current_user: dict = Depends(get_current_user)):
    updates = {}
    for key in ["name", "area", "bio", "avatar_path", "phone", "business_name", "business_category", "shop_image_path"]:
        val = getattr(payload, key)
        if val is None:
            continue
        if isinstance(val, str):
            val = val.strip()
        updates[key] = val
        if key == "area" and val:
            updates["area_key"] = normalize_area(val)
    if updates:
        await db.users.update_one({"id": current_user["id"]}, {"$set": updates})
        if "name" in updates:
            await db.posts.update_many({"user_id": current_user["id"]}, {"$set": {"user_name": updates["name"]}})
    updated = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "password_hash": 0})
    return UserOut(**(await serialize_user(updated, current_user["id"])))

@api_router.post("/users/me/location", response_model=UserOut)
async def update_location(payload: LocationUpdate, current_user: dict = Depends(get_current_user)):
    await db.users.update_one({"id": current_user["id"]}, {"$set": {"lat": payload.lat, "lng": payload.lng}})
    updated = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "password_hash": 0})
    return UserOut(**(await serialize_user(updated, current_user["id"])))

@api_router.get("/users/{user_id}", response_model=UserOut)
async def get_user(user_id: str, current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    viewer_loc = None
    if current_user.get("lat") is not None:
        viewer_loc = {"lat": current_user["lat"], "lng": current_user["lng"]}
    return UserOut(**(await serialize_user(user, current_user["id"], viewer_loc)))

@api_router.get("/users/{user_id}/posts", response_model=List[PostOut])
async def user_posts(user_id: str, current_user: dict = Depends(get_current_user)):
    cursor = db.posts.find({"user_id": user_id}, {"_id": 0}).sort("timestamp", -1).limit(200)
    posts = await cursor.to_list(200)
    return [PostOut(**(await post_doc_to_out(p, current_user["id"]))) for p in posts]

@api_router.post("/users/{user_id}/follow", response_model=FollowResponse)
async def toggle_follow(user_id: str, current_user: dict = Depends(get_current_user)):
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")
    target = await db.users.find_one({"id": user_id}, {"_id": 0, "id": 1, "name": 1})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    following = current_user.get("following", [])
    if user_id in following:
        await db.users.update_one({"id": current_user["id"]},
                                   {"$pull": {"following": user_id}, "$inc": {"following_count": -1}})
        await db.users.update_one({"id": user_id}, {"$inc": {"followers_count": -1}})
        is_following = False
    else:
        await db.users.update_one({"id": current_user["id"]},
                                   {"$addToSet": {"following": user_id}, "$inc": {"following_count": 1}})
        await db.users.update_one({"id": user_id}, {"$inc": {"followers_count": 1}})
        is_following = True
        await notify(user_id, "follow", current_user["id"], f"{current_user['name']} started following you")
    fresh = await db.users.find_one({"id": user_id}, {"followers_count": 1, "_id": 0})
    return FollowResponse(user_id=user_id, following=is_following, followers_count=fresh.get("followers_count", 0))

# --- Posts ---
@api_router.post("/posts", response_model=PostOut)
async def create_post(payload: PostCreate, current_user: dict = Depends(get_current_user)):
    content = payload.content.strip()
    if not content and not payload.image_paths:
        raise HTTPException(status_code=400, detail="Post cannot be empty")
    post_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": post_id,
        "user_id": current_user["id"],
        "user_name": current_user["name"],
        "content": content,
        "type": payload.type,
        "area": current_user["area"],
        "area_key": normalize_area(current_user["area"]),
        "image_paths": payload.image_paths or [],
        "timestamp": now,
        "liked_by": [],
        "saved_by": [],
    }
    await db.posts.insert_one(doc)
    await process_mentions(content, current_user, post_id=post_id)
    return PostOut(**(await post_doc_to_out(doc, current_user["id"])))

@api_router.get("/posts", response_model=List[PostOut])
async def list_posts(current_user: dict = Depends(get_current_user)):
    area_key = normalize_area(current_user["area"])
    cursor = db.posts.find({"area_key": area_key}, {"_id": 0}).sort("timestamp", -1).limit(200)
    posts = await cursor.to_list(200)
    return [PostOut(**(await post_doc_to_out(p, current_user["id"]))) for p in posts]

@api_router.post("/posts/{post_id}/like", response_model=LikeResponse)
async def toggle_like(post_id: str, current_user: dict = Depends(get_current_user)):
    post = await db.posts.find_one({"id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    liked_by = post.get("liked_by", [])
    uid = current_user["id"]
    if uid in liked_by:
        await db.posts.update_one({"id": post_id}, {"$pull": {"liked_by": uid}})
        liked_by = [x for x in liked_by if x != uid]
        liked = False
    else:
        await db.posts.update_one({"id": post_id}, {"$addToSet": {"liked_by": uid}})
        liked_by = liked_by + [uid]
        liked = True
        await notify(post["user_id"], "like", uid, f"{current_user['name']} liked your post",
                     target_post_id=post_id)
    return LikeResponse(post_id=post_id, likes=len(liked_by), liked=liked)

@api_router.post("/posts/{post_id}/save", response_model=SaveResponse)
async def toggle_save(post_id: str, current_user: dict = Depends(get_current_user)):
    post = await db.posts.find_one({"id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    saved_by = post.get("saved_by", [])
    uid = current_user["id"]
    if uid in saved_by:
        await db.posts.update_one({"id": post_id}, {"$pull": {"saved_by": uid}})
        saved = False
    else:
        await db.posts.update_one({"id": post_id}, {"$addToSet": {"saved_by": uid}})
        saved = True
    return SaveResponse(post_id=post_id, saved=saved)

@api_router.delete("/posts/{post_id}")
async def delete_post(post_id: str, current_user: dict = Depends(get_current_user)):
    post = await db.posts.find_one({"id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not your post")
    await db.posts.delete_one({"id": post_id})
    await db.comments.delete_many({"post_id": post_id})
    await db.notifications.delete_many({"target_post_id": post_id})
    return {"deleted": True, "post_id": post_id}

@api_router.get("/me/saved", response_model=List[PostOut])
async def my_saved(current_user: dict = Depends(get_current_user)):
    cursor = db.posts.find({"saved_by": current_user["id"]}, {"_id": 0}).sort("timestamp", -1).limit(200)
    posts = await cursor.to_list(200)
    return [PostOut(**(await post_doc_to_out(p, current_user["id"]))) for p in posts]

# --- Comments ---
@api_router.get("/posts/{post_id}/comments", response_model=List[CommentOut])
async def list_comments(post_id: str, current_user: dict = Depends(get_current_user)):
    cursor = db.comments.find({"post_id": post_id}, {"_id": 0}).sort("timestamp", 1).limit(300)
    comments = await cursor.to_list(300)
    results = []
    for c in comments:
        author = await db.users.find_one({"id": c["user_id"]}, {"avatar_path": 1, "_id": 0})
        results.append(CommentOut(
            id=c["id"], post_id=c["post_id"], user_id=c["user_id"],
            user_name=c["user_name"], user_avatar_path=(author or {}).get("avatar_path"),
            content=c["content"], timestamp=to_iso(c["timestamp"]),
        ))
    return results

@api_router.post("/posts/{post_id}/comments", response_model=CommentOut)
async def add_comment(post_id: str, payload: CommentCreate, current_user: dict = Depends(get_current_user)):
    post = await db.posts.find_one({"id": post_id}, {"_id": 0, "id": 1, "user_id": 1})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    cid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": cid, "post_id": post_id, "user_id": current_user["id"],
        "user_name": current_user["name"], "content": payload.content.strip(), "timestamp": now,
    }
    await db.comments.insert_one(doc)
    await notify(post["user_id"], "comment", current_user["id"],
                 f"{current_user['name']} commented on your post", target_post_id=post_id)
    await process_mentions(payload.content, current_user, post_id=post_id)
    return CommentOut(
        id=cid, post_id=post_id, user_id=current_user["id"],
        user_name=current_user["name"], user_avatar_path=current_user.get("avatar_path"),
        content=doc["content"], timestamp=datetime.fromisoformat(now),
    )

# --- Explore & Search ---
@api_router.get("/explore", response_model=List[PostOut])
async def explore(current_user: dict = Depends(get_current_user)):
    cursor = db.posts.aggregate([
        {"$addFields": {"likes_count": {"$size": {"$ifNull": ["$liked_by", []]}}}},
        {"$sort": {"likes_count": -1, "timestamp": -1}},
        {"$limit": 60},
        {"$project": {"_id": 0}},
    ])
    posts = await cursor.to_list(60)
    return [PostOut(**(await post_doc_to_out(p, current_user["id"]))) for p in posts]

@api_router.get("/search")
async def search(q: str = Query(..., min_length=1), current_user: dict = Depends(get_current_user)):
    q_escaped = re.escape(q.strip())
    if not q_escaped:
        return {"users": [], "posts": [], "products": [], "businesses": []}
    users_cursor = db.users.find({
        "$or": [
            {"name": {"$regex": q_escaped, "$options": "i"}},
            {"area_key": {"$regex": q_escaped.lower()}},
            {"business_name": {"$regex": q_escaped, "$options": "i"}},
        ]
    }, {"_id": 0, "password_hash": 0}).limit(20)
    users = await users_cursor.to_list(20)
    users_out = [await serialize_user(u, current_user["id"]) for u in users]

    posts_cursor = db.posts.find({"content": {"$regex": q_escaped, "$options": "i"}}, {"_id": 0}).sort("timestamp", -1).limit(30)
    posts = await posts_cursor.to_list(30)
    posts_out = [await post_doc_to_out(p, current_user["id"]) for p in posts]

    products_cursor = db.products.find({"name": {"$regex": q_escaped, "$options": "i"}}, {"_id": 0}).sort("created_at", -1).limit(30)
    products = await products_cursor.to_list(30)
    products_out = [await product_doc_to_out(p, current_user) for p in products]

    businesses_cursor = db.users.find({
        "account_type": "business",
        "$or": [
            {"business_name": {"$regex": q_escaped, "$options": "i"}},
            {"name": {"$regex": q_escaped, "$options": "i"}},
        ]
    }, {"_id": 0, "password_hash": 0}).limit(20)
    businesses = await businesses_cursor.to_list(20)
    businesses_out = [await serialize_user(b, current_user["id"]) for b in businesses]

    return {"users": users_out, "posts": posts_out, "products": products_out, "businesses": businesses_out}

# --- Stories ---
@api_router.get("/stories")
async def stories(current_user: dict = Depends(get_current_user)):
    area_key = normalize_area(current_user["area"])
    since = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    recent_author_ids = await db.posts.distinct("user_id", {"area_key": area_key, "timestamp": {"$gte": since}})
    all_ids = await db.users.distinct("id", {"area_key": area_key})
    ordered = list(dict.fromkeys(list(recent_author_ids) + list(all_ids)))
    ordered = [uid for uid in ordered if uid != current_user["id"]][:20]
    users = []
    for uid in ordered:
        u = await db.users.find_one({"id": uid}, {"_id": 0, "id": 1, "name": 1, "avatar_path": 1})
        if u:
            u["active"] = uid in recent_author_ids
            users.append(u)
    return {"items": users}

# --- Businesses & Products ---
async def product_doc_to_out(doc: dict, current_user: dict) -> dict:
    biz = await db.users.find_one({"id": doc["business_id"]},
                                    {"_id": 0, "business_name": 1, "business_category": 1,
                                     "shop_image_path": 1, "area": 1, "lat": 1, "lng": 1, "name": 1})
    biz = biz or {}
    distance = None
    if current_user.get("lat") is not None and biz.get("lat") is not None:
        distance = round(haversine_km(current_user["lat"], current_user["lng"], biz["lat"], biz["lng"]), 2)
    return {
        "id": doc["id"],
        "business_id": doc["business_id"],
        "business_name": biz.get("business_name") or biz.get("name", ""),
        "business_category": biz.get("business_category"),
        "shop_image_path": biz.get("shop_image_path"),
        "business_area": biz.get("area", ""),
        "name": doc["name"],
        "description": doc.get("description", ""),
        "price": doc["price"],
        "image_path": doc.get("image_path"),
        "category": doc.get("category", "other"),
        "is_offer": doc.get("is_offer", False),
        "is_available": doc.get("is_available", True),
        "created_at": to_iso(doc["created_at"]),
        "distance_km": distance,
    }

@api_router.post("/products", response_model=ProductOut)
async def create_product(payload: ProductCreate, current_user: dict = Depends(get_current_user)):
    if current_user.get("account_type") != "business":
        raise HTTPException(status_code=403, detail="Only businesses can create products")
    pid = str(uuid.uuid4())
    doc = {
        "id": pid, "business_id": current_user["id"],
        "name": payload.name.strip(), "description": payload.description.strip(),
        "price": float(payload.price), "image_path": payload.image_path,
        "category": payload.category, "is_offer": payload.is_offer,
        "is_available": payload.is_available,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.products.insert_one(doc)
    return ProductOut(**(await product_doc_to_out(doc, current_user)))

@api_router.get("/products", response_model=List[ProductOut])
async def list_products(
    current_user: dict = Depends(get_current_user),
    category: Optional[str] = None,
    business_id: Optional[str] = None,
    nearby: bool = False,
    radius_km: float = DEFAULT_RADIUS_KM,
    offers_only: bool = False,
):
    query: dict = {"is_available": True}
    if category:
        query["category"] = category
    if business_id:
        query["business_id"] = business_id
    if offers_only:
        query["is_offer"] = True
    cursor = db.products.find(query, {"_id": 0}).sort("created_at", -1).limit(300)
    products = await cursor.to_list(300)
    out = [await product_doc_to_out(p, current_user) for p in products]
    if nearby and current_user.get("lat") is not None:
        out = [p for p in out if p.get("distance_km") is not None and p["distance_km"] <= radius_km]
        out.sort(key=lambda p: p["distance_km"])
    return [ProductOut(**p) for p in out]

@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str, current_user: dict = Depends(get_current_user)):
    prod = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")
    if prod["business_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not your product")
    await db.products.delete_one({"id": product_id})
    return {"deleted": True, "product_id": product_id}

@api_router.get("/businesses", response_model=List[UserOut])
async def list_businesses(
    current_user: dict = Depends(get_current_user),
    category: Optional[str] = None,
    nearby: bool = False,
    radius_km: float = DEFAULT_RADIUS_KM,
):
    query: dict = {"account_type": "business"}
    if category:
        query["business_category"] = category
    cursor = db.users.find(query, {"_id": 0, "password_hash": 0}).limit(200)
    businesses = await cursor.to_list(200)
    viewer_loc = None
    if current_user.get("lat") is not None:
        viewer_loc = {"lat": current_user["lat"], "lng": current_user["lng"]}
    out = [await serialize_user(b, current_user["id"], viewer_loc) for b in businesses]
    if nearby and viewer_loc:
        out = [b for b in out if b.get("distance_km") is not None and b["distance_km"] <= radius_km]
        out.sort(key=lambda b: b["distance_km"])
    return [UserOut(**b) for b in out]

# --- Events ---
async def event_doc_to_out(doc: dict, current_user: dict) -> dict:
    author = await db.users.find_one({"id": doc["user_id"]}, {"_id": 0, "name": 1, "avatar_path": 1})
    author = author or {}
    attendees = doc.get("attendees", [])
    distance = None
    if current_user.get("lat") is not None and doc.get("lat") is not None:
        distance = round(haversine_km(current_user["lat"], current_user["lng"], doc["lat"], doc["lng"]), 2)
    return {
        "id": doc["id"],
        "user_id": doc["user_id"],
        "user_name": doc.get("user_name") or author.get("name", ""),
        "user_avatar_path": author.get("avatar_path"),
        "title": doc["title"],
        "description": doc.get("description", ""),
        "event_date": to_iso(doc["event_date"]) if doc.get("event_date") else None,
        "image_path": doc.get("image_path"),
        "area": doc["area"],
        "location_name": doc.get("location_name"),
        "attendees_count": len(attendees),
        "going": current_user["id"] in attendees,
        "created_at": to_iso(doc["created_at"]),
        "distance_km": distance,
    }

@api_router.post("/events", response_model=EventOut)
async def create_event(payload: EventCreate, current_user: dict = Depends(get_current_user)):
    eid = str(uuid.uuid4())
    doc = {
        "id": eid, "user_id": current_user["id"], "user_name": current_user["name"],
        "title": payload.title.strip(), "description": payload.description.strip(),
        "event_date": payload.event_date.isoformat() if payload.event_date else None,
        "image_path": payload.image_path,
        "area": current_user["area"], "area_key": normalize_area(current_user["area"]),
        "location_name": payload.location_name,
        "lat": current_user.get("lat"), "lng": current_user.get("lng"),
        "attendees": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.events.insert_one(doc)
    return EventOut(**(await event_doc_to_out(doc, current_user)))

@api_router.get("/events", response_model=List[EventOut])
async def list_events(
    current_user: dict = Depends(get_current_user),
    nearby: bool = False, radius_km: float = DEFAULT_RADIUS_KM,
):
    query = {}
    if not nearby:
        query["area_key"] = normalize_area(current_user["area"])
    cursor = db.events.find(query, {"_id": 0}).sort("created_at", -1).limit(200)
    events = await cursor.to_list(200)
    out = [await event_doc_to_out(e, current_user) for e in events]
    if nearby and current_user.get("lat") is not None:
        out = [e for e in out if e.get("distance_km") is not None and e["distance_km"] <= radius_km]
        out.sort(key=lambda e: e["distance_km"])
    return [EventOut(**e) for e in out]

@api_router.post("/events/{event_id}/going")
async def toggle_going(event_id: str, current_user: dict = Depends(get_current_user)):
    ev = await db.events.find_one({"id": event_id}, {"_id": 0, "attendees": 1, "user_id": 1})
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")
    attendees = ev.get("attendees", [])
    uid = current_user["id"]
    if uid in attendees:
        await db.events.update_one({"id": event_id}, {"$pull": {"attendees": uid}})
        going = False
    else:
        await db.events.update_one({"id": event_id}, {"$addToSet": {"attendees": uid}})
        going = True
    fresh = await db.events.find_one({"id": event_id}, {"_id": 0, "attendees": 1})
    return {"event_id": event_id, "going": going, "attendees_count": len(fresh.get("attendees", []))}

@api_router.delete("/events/{event_id}")
async def delete_event(event_id: str, current_user: dict = Depends(get_current_user)):
    ev = await db.events.find_one({"id": event_id}, {"_id": 0, "user_id": 1})
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")
    if ev["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Not your event")
    await db.events.delete_one({"id": event_id})
    return {"deleted": True}

# --- Nearby people (for map) ---
@api_router.get("/nearby/users", response_model=List[UserOut])
async def nearby_users(
    current_user: dict = Depends(get_current_user),
    radius_km: float = DEFAULT_RADIUS_KM,
):
    if current_user.get("lat") is None:
        return []
    cursor = db.users.find({
        "lat": {"$ne": None}, "id": {"$ne": current_user["id"]},
    }, {"_id": 0, "password_hash": 0}).limit(500)
    users = await cursor.to_list(500)
    viewer_loc = {"lat": current_user["lat"], "lng": current_user["lng"]}
    out = [await serialize_user(u, current_user["id"], viewer_loc) for u in users]
    out = [u for u in out if u.get("distance_km") is not None and u["distance_km"] <= radius_km]
    out.sort(key=lambda u: u["distance_km"])
    return [UserOut(**u) for u in out]

# --- Notifications ---
@api_router.get("/notifications", response_model=List[NotificationOut])
async def list_notifications(current_user: dict = Depends(get_current_user)):
    cursor = db.notifications.find({"user_id": current_user["id"]}, {"_id": 0}).sort("created_at", -1).limit(100)
    notes = await cursor.to_list(100)
    out = []
    for n in notes:
        actor = None
        if n.get("actor_id"):
            actor = await db.users.find_one({"id": n["actor_id"]}, {"_id": 0, "name": 1, "avatar_path": 1})
        out.append(NotificationOut(
            id=n["id"], type=n["type"],
            actor_id=n.get("actor_id"),
            actor_name=(actor or {}).get("name") if actor else None,
            actor_avatar_path=(actor or {}).get("avatar_path") if actor else None,
            target_post_id=n.get("target_post_id"),
            target_event_id=n.get("target_event_id"),
            target_product_id=n.get("target_product_id"),
            message=n["message"], read=n.get("read", False),
            created_at=to_iso(n["created_at"]),
        ))
    return out

@api_router.get("/notifications/unread-count")
async def unread_count(current_user: dict = Depends(get_current_user)):
    count = await db.notifications.count_documents({"user_id": current_user["id"], "read": False})
    return {"count": count}

@api_router.post("/notifications/read-all")
async def read_all(current_user: dict = Depends(get_current_user)):
    await db.notifications.update_many({"user_id": current_user["id"], "read": False}, {"$set": {"read": True}})
    return {"ok": True}

# --- Upload & Serve Files ---
@api_router.post("/upload", response_model=UploadResponse)
async def upload_file(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    ext = (file.filename.split(".")[-1] if file.filename and "." in file.filename else "bin").lower()
    if ext not in MIME_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported file type")
    data = await file.read()
    if len(data) > 6 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 6MB)")
    path = f"{APP_NAME}/uploads/{current_user['id']}/{uuid.uuid4()}.{ext}"
    content_type = MIME_TYPES[ext]
    result = put_object(path, data, content_type)
    await db.files.insert_one({
        "id": str(uuid.uuid4()),
        "storage_path": result["path"],
        "owner_id": current_user["id"],
        "original_filename": file.filename,
        "content_type": content_type,
        "size": result.get("size", len(data)),
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return UploadResponse(path=result["path"], size=result.get("size", len(data)))

@api_router.get("/files/{path:path}")
async def serve_file(path: str, authorization: Optional[str] = Header(None), auth: Optional[str] = Query(None)):
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
    elif auth:
        token = auth
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        decode_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")
    record = await db.files.find_one({"storage_path": path, "is_deleted": False}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
    data, ctype = get_object(path)
    return Response(content=data, media_type=record.get("content_type", ctype))

@api_router.get("/")
async def root():
    return {"message": "LocalConnect Lite API is running", "version": "3.0"}

# --- Startup ---
DEMO_AREA = "Koramangala"
# Koramangala approx centre: 12.9352, 77.6245
DEMO_USERS = [
    # Personal accounts (all within ~2-3 km of Koramangala centre)
    {"name": "Aanya Sharma", "email": "aanya@demo.com", "password": "demo123", "area": DEMO_AREA,
     "bio": "Farmers market hunter 🌱 · weekend runner · cat mum to Misha",
     "account_type": "personal", "lat": 12.9352, "lng": 77.6245},
    {"name": "Priya Iyer", "email": "priya@demo.com", "password": "demo123", "area": DEMO_AREA,
     "bio": "RWA member · Cyclist · Bengaluru born & bred",
     "account_type": "personal", "lat": 12.9370, "lng": 77.6280},
    {"name": "Kabir Joshi", "email": "kabir@demo.com", "password": "demo123", "area": "Indiranagar",
     "bio": "Musician · vinyl collector · coffee snob",
     "account_type": "personal", "lat": 12.9716, "lng": 77.6412},
    # Business accounts
    {"name": "Rohan Mehta", "email": "rohan@demo.com", "password": "demo123", "area": DEMO_AREA,
     "bio": "Running Brewberry Cafe since 2019 ☕",
     "account_type": "business", "business_name": "Brewberry Cafe",
     "business_category": "cafe", "phone": "+91 98100 00001",
     "lat": 12.9340, "lng": 77.6230},
    {"name": "Meera Ramesh", "email": "meera@demo.com", "password": "demo123", "area": DEMO_AREA,
     "bio": "Fresh groceries delivered in 15 mins",
     "account_type": "business", "business_name": "FreshCart 15",
     "business_category": "grocery", "phone": "+91 98100 00002",
     "lat": 12.9345, "lng": 77.6260},
    {"name": "Vikram Patel", "email": "vikram@demo.com", "password": "demo123", "area": DEMO_AREA,
     "bio": "Authentic Gujarati thali · Home-style",
     "account_type": "business", "business_name": "Patel's Kitchen",
     "business_category": "food", "phone": "+91 98100 00003",
     "lat": 12.9360, "lng": 77.6255},
]

DEMO_POSTS = [
    ("aanya@demo.com", "Anyone know a good weekend farmer's market nearby? Looking for fresh produce 🌱", "normal"),
    ("priya@demo.com", "Power outage on 5th Block expected tomorrow 10am-2pm. Plan accordingly!", "normal"),
    ("aanya@demo.com", "Lost my grey tabby cat near 80ft Road. Answers to 'Misha'. Please DM if spotted.", "normal"),
    ("priya@demo.com", "Starting a morning walking group at Cubbon Park — 6am Saturdays. Reply if keen!", "normal"),
]

DEMO_PRODUCTS = [
    # Brewberry Cafe
    ("rohan@demo.com", "Flat White", "Double-shot espresso with velvety microfoam", 180, "beverage", False),
    ("rohan@demo.com", "Cold Brew Combo — 20% OFF", "Our signature cold brew + a pastry of your choice", 240, "beverage", True),
    ("rohan@demo.com", "Vanilla Crème Brûlée", "House-made with Madagascan vanilla", 220, "dessert", False),
    # FreshCart 15
    ("meera@demo.com", "Organic Bananas (1 dozen)", "Chemical-free, farm-direct", 79, "fruit", False),
    ("meera@demo.com", "Weekend Veggie Bundle", "Tomato, onion, greens · 20% off on orders above ₹300", 299, "vegetable", True),
    ("meera@demo.com", "A2 Milk (1L)", "Desi cow ghee-rich", 99, "dairy", False),
    # Patel's Kitchen
    ("vikram@demo.com", "Gujarati Thali", "9 items incl. dal, 2 veg, kadhi, rice, rotli, sweet", 249, "meal", False),
    ("vikram@demo.com", "Dhokla (Pack of 6) — BOGO", "Steamed & fluffy · Buy 1 get 1 free today only", 120, "snack", True),
]

DEMO_EVENTS = [
    ("priya@demo.com", "Koramangala Street Cleanup", "RWA-organised — gloves and coffee provided. Meet at 5th Block park.",
     datetime.now(timezone.utc) + timedelta(days=5), "5th Block Park"),
    ("aanya@demo.com", "Farmers Market Pop-up", "Local farmers selling fresh produce, honey, and organic bread.",
     datetime.now(timezone.utc) + timedelta(days=2), "80ft Road Open Ground"),
    ("rohan@demo.com", "Open Mic Night at Brewberry", "Live acoustic. First 10 sign-ups get a free drink 🎸",
     datetime.now(timezone.utc) + timedelta(days=4), "Brewberry Cafe"),
]

@app.on_event("startup")
async def on_startup():
    init_storage()
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.users.create_index("area_key")
    await db.users.create_index("account_type")
    await db.posts.create_index("id", unique=True)
    await db.posts.create_index([("area_key", 1), ("timestamp", -1)])
    await db.comments.create_index([("post_id", 1), ("timestamp", 1)])
    await db.products.create_index("business_id")
    await db.products.create_index("category")
    await db.events.create_index("area_key")
    await db.notifications.create_index([("user_id", 1), ("created_at", -1)])

    # Idempotent backfills
    await db.users.update_many({"bio": {"$exists": False}}, {"$set": {"bio": ""}})
    await db.users.update_many({"avatar_path": {"$exists": False}}, {"$set": {"avatar_path": None}})
    await db.users.update_many({"following": {"$exists": False}}, {"$set": {"following": []}})
    await db.users.update_many({"account_type": {"$exists": False}}, {"$set": {"account_type": "personal"}})
    await db.users.update_many({"followers_count": {"$exists": False}}, {"$set": {"followers_count": 0}})
    await db.users.update_many({"following_count": {"$exists": False}}, {"$set": {"following_count": 0}})
    await db.users.update_many({"lat": {"$exists": False}}, {"$set": {"lat": None, "lng": None}})

    # Seed demo users
    for u in DEMO_USERS:
        existing = await db.users.find_one({"email": u["email"]})
        if not existing:
            await db.users.insert_one({
                "id": str(uuid.uuid4()),
                "name": u["name"], "email": u["email"],
                "password_hash": hash_password(u["password"]),
                "area": u["area"], "area_key": normalize_area(u["area"]),
                "bio": u.get("bio", ""), "avatar_path": None,
                "account_type": u.get("account_type", "personal"),
                "phone": u.get("phone"),
                "business_name": u.get("business_name"),
                "business_category": u.get("business_category"),
                "shop_image_path": None,
                "lat": u.get("lat"), "lng": u.get("lng"),
                "following": [], "followers_count": 0, "following_count": 0,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
        else:
            # ensure demo users have all fields
            update = {k: u[k] for k in ("bio", "account_type", "phone", "business_name", "business_category", "lat", "lng") if u.get(k) is not None}
            if update:
                await db.users.update_one({"email": u["email"]}, {"$set": update})

    # Seed posts if none
    if await db.posts.count_documents({}) == 0:
        base_time = datetime.now(timezone.utc)
        for idx, (email, content, ptype) in enumerate(DEMO_POSTS):
            user = await db.users.find_one({"email": email})
            if not user:
                continue
            await db.posts.insert_one({
                "id": str(uuid.uuid4()), "user_id": user["id"], "user_name": user["name"],
                "content": content, "type": ptype, "area": user["area"],
                "area_key": normalize_area(user["area"]), "image_paths": [],
                "timestamp": (base_time - timedelta(hours=idx)).isoformat(),
                "liked_by": [], "saved_by": [],
            })

    # Seed products
    if await db.products.count_documents({}) == 0:
        for email, name, desc, price, cat, is_offer in DEMO_PRODUCTS:
            user = await db.users.find_one({"email": email})
            if not user:
                continue
            await db.products.insert_one({
                "id": str(uuid.uuid4()), "business_id": user["id"],
                "name": name, "description": desc, "price": float(price),
                "image_path": None, "category": cat,
                "is_offer": is_offer, "is_available": True,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })

    # Seed events
    if await db.events.count_documents({}) == 0:
        for email, title, desc, when, loc in DEMO_EVENTS:
            user = await db.users.find_one({"email": email})
            if not user: continue
            await db.events.insert_one({
                "id": str(uuid.uuid4()), "user_id": user["id"], "user_name": user["name"],
                "title": title, "description": desc,
                "event_date": when.isoformat(),
                "image_path": None, "area": user["area"],
                "area_key": normalize_area(user["area"]),
                "location_name": loc,
                "lat": user.get("lat"), "lng": user.get("lng"),
                "attendees": [],
                "created_at": datetime.now(timezone.utc).isoformat(),
            })

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)
