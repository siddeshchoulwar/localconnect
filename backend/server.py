from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
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

# --- Constants ---
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7
APP_NAME = os.environ.get("APP_NAME", "localconnect-lite")
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
STORAGE_URL = "https://integrations.emergentagent.com/objstore/api/v1/storage"

MIME_TYPES = {
    "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
    "gif": "image/gif", "webp": "image/webp",
}

def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]

# --- App & Router ---
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

# --- Models ---
class UserSignup(BaseModel):
    name: str = Field(..., min_length=1, max_length=60)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)
    area: str = Field(..., min_length=1, max_length=60)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserUpdate(BaseModel):
    name: Optional[str] = None
    area: Optional[str] = None
    bio: Optional[str] = Field(None, max_length=180)
    avatar_path: Optional[str] = None

class UserOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    email: EmailStr
    area: str
    bio: str = ""
    avatar_path: Optional[str] = None
    created_at: datetime
    followers_count: int = 0
    following_count: int = 0
    is_following: bool = False

class AuthResponse(BaseModel):
    token: str
    user: UserOut

class PostCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=500)
    type: Literal["normal", "offer"] = "normal"
    image_path: Optional[str] = None

class PostOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    user_name: str
    user_avatar_path: Optional[str] = None
    content: str
    type: str
    area: str
    image_path: Optional[str] = None
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

class UploadResponse(BaseModel):
    path: str
    size: int

# --- Auth Helpers ---
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
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
    token = None
    if creds and creds.scheme.lower() == "bearer":
        token = creds.credentials
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

def normalize_area(area: str) -> str:
    return area.strip().lower()

async def serialize_user(doc: dict, viewer_id: Optional[str] = None) -> dict:
    followers_count = await db.users.count_documents({"following": doc["id"]})
    following_count = len(doc.get("following", []))
    is_following = False
    if viewer_id and viewer_id != doc["id"]:
        viewer = await db.users.find_one({"id": viewer_id}, {"following": 1, "_id": 0})
        is_following = bool(viewer and doc["id"] in viewer.get("following", []))
    created_at = doc["created_at"]
    if isinstance(created_at, str):
        created_at = datetime.fromisoformat(created_at)
    return {
        "id": doc["id"],
        "name": doc["name"],
        "email": doc["email"],
        "area": doc["area"],
        "bio": doc.get("bio", "") or "",
        "avatar_path": doc.get("avatar_path"),
        "created_at": created_at,
        "followers_count": followers_count,
        "following_count": following_count,
        "is_following": is_following,
    }

async def post_doc_to_out(doc: dict, viewer_id: str) -> dict:
    liked_by = doc.get("liked_by", [])
    saved_by = doc.get("saved_by", [])
    ts = doc["timestamp"]
    if isinstance(ts, str):
        ts = datetime.fromisoformat(ts)
    comments_count = await db.comments.count_documents({"post_id": doc["id"]})
    author = await db.users.find_one({"id": doc["user_id"]}, {"avatar_path": 1, "_id": 0})
    return {
        "id": doc["id"],
        "user_id": doc["user_id"],
        "user_name": doc["user_name"],
        "user_avatar_path": (author or {}).get("avatar_path"),
        "content": doc["content"],
        "type": doc["type"],
        "area": doc["area"],
        "image_path": doc.get("image_path"),
        "timestamp": ts,
        "likes": len(liked_by),
        "liked": viewer_id in liked_by,
        "saved": viewer_id in saved_by,
        "comments_count": comments_count,
    }

# --- Auth Routes ---
@api_router.post("/auth/signup", response_model=AuthResponse)
async def signup(payload: UserSignup):
    email = payload.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
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
        "following": [],
        "created_at": now,
    }
    await db.users.insert_one(user_doc)
    token = create_access_token(user_id, email)
    user_out = await serialize_user(user_doc, user_id)
    return AuthResponse(token=token, user=UserOut(**user_out))

@api_router.post("/auth/login", response_model=AuthResponse)
async def login(payload: UserLogin):
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user["id"], email)
    user_out = await serialize_user(user, user["id"])
    return AuthResponse(token=token, user=UserOut(**user_out))

@api_router.get("/auth/me", response_model=UserOut)
async def me(current_user: dict = Depends(get_current_user)):
    user_out = await serialize_user(current_user, current_user["id"])
    return UserOut(**user_out)

# --- Users ---
@api_router.patch("/users/me", response_model=UserOut)
async def update_me(payload: UserUpdate, current_user: dict = Depends(get_current_user)):
    updates = {}
    if payload.name is not None and payload.name.strip():
        updates["name"] = payload.name.strip()
    if payload.area is not None and payload.area.strip():
        updates["area"] = payload.area.strip()
        updates["area_key"] = normalize_area(payload.area)
    if payload.bio is not None:
        updates["bio"] = payload.bio.strip()
    if payload.avatar_path is not None:
        updates["avatar_path"] = payload.avatar_path or None
    if updates:
        await db.users.update_one({"id": current_user["id"]}, {"$set": updates})
        # propagate name change to existing posts for display
        if "name" in updates:
            await db.posts.update_many(
                {"user_id": current_user["id"]},
                {"$set": {"user_name": updates["name"]}},
            )
    updated = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "password_hash": 0})
    user_out = await serialize_user(updated, current_user["id"])
    return UserOut(**user_out)

@api_router.get("/users/{user_id}", response_model=UserOut)
async def get_user(user_id: str, current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user_out = await serialize_user(user, current_user["id"])
    return UserOut(**user_out)

@api_router.get("/users/{user_id}/posts", response_model=List[PostOut])
async def user_posts(user_id: str, current_user: dict = Depends(get_current_user)):
    cursor = db.posts.find({"user_id": user_id}, {"_id": 0}).sort("timestamp", -1).limit(200)
    posts = await cursor.to_list(200)
    return [PostOut(**(await post_doc_to_out(p, current_user["id"]))) for p in posts]

@api_router.post("/users/{user_id}/follow", response_model=FollowResponse)
async def toggle_follow(user_id: str, current_user: dict = Depends(get_current_user)):
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")
    target = await db.users.find_one({"id": user_id}, {"_id": 0, "id": 1})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    following = current_user.get("following", [])
    if user_id in following:
        await db.users.update_one({"id": current_user["id"]}, {"$pull": {"following": user_id}})
        is_following = False
    else:
        await db.users.update_one({"id": current_user["id"]}, {"$addToSet": {"following": user_id}})
        is_following = True
    followers_count = await db.users.count_documents({"following": user_id})
    return FollowResponse(user_id=user_id, following=is_following, followers_count=followers_count)

@api_router.get("/users/{user_id}/followers", response_model=List[UserOut])
async def get_followers(user_id: str, current_user: dict = Depends(get_current_user)):
    cursor = db.users.find({"following": user_id}, {"_id": 0, "password_hash": 0}).limit(200)
    users = await cursor.to_list(200)
    return [UserOut(**(await serialize_user(u, current_user["id"]))) for u in users]

@api_router.get("/users/{user_id}/following", response_model=List[UserOut])
async def get_following(user_id: str, current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": user_id}, {"following": 1, "_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    ids = user.get("following", [])
    cursor = db.users.find({"id": {"$in": ids}}, {"_id": 0, "password_hash": 0}).limit(200)
    users = await cursor.to_list(200)
    return [UserOut(**(await serialize_user(u, current_user["id"]))) for u in users]

# --- Posts ---
@api_router.post("/posts", response_model=PostOut)
async def create_post(payload: PostCreate, current_user: dict = Depends(get_current_user)):
    content = payload.content.strip()
    if not content and not payload.image_path:
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
        "image_path": payload.image_path,
        "timestamp": now,
        "liked_by": [],
        "saved_by": [],
    }
    await db.posts.insert_one(doc)
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
        ts = c["timestamp"]
        if isinstance(ts, str):
            ts = datetime.fromisoformat(ts)
        results.append(CommentOut(
            id=c["id"], post_id=c["post_id"], user_id=c["user_id"],
            user_name=c["user_name"], user_avatar_path=(author or {}).get("avatar_path"),
            content=c["content"], timestamp=ts,
        ))
    return results

@api_router.post("/posts/{post_id}/comments", response_model=CommentOut)
async def add_comment(post_id: str, payload: CommentCreate, current_user: dict = Depends(get_current_user)):
    post = await db.posts.find_one({"id": post_id}, {"_id": 0, "id": 1})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    cid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": cid,
        "post_id": post_id,
        "user_id": current_user["id"],
        "user_name": current_user["name"],
        "content": payload.content.strip(),
        "timestamp": now,
    }
    await db.comments.insert_one(doc)
    return CommentOut(
        id=cid, post_id=post_id, user_id=current_user["id"],
        user_name=current_user["name"], user_avatar_path=current_user.get("avatar_path"),
        content=doc["content"], timestamp=datetime.fromisoformat(now),
    )

# --- Explore & Search ---
@api_router.get("/explore", response_model=List[PostOut])
async def explore(current_user: dict = Depends(get_current_user)):
    # Trending: recent posts sorted by likes count, across ALL areas
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
    q_lower = q.strip().lower()
    if not q_lower:
        return {"users": [], "posts": []}
    # Users: match name or area
    users_cursor = db.users.find({
        "$or": [
            {"name": {"$regex": q_lower, "$options": "i"}},
            {"area_key": {"$regex": q_lower}},
        ]
    }, {"_id": 0, "password_hash": 0}).limit(20)
    users = await users_cursor.to_list(20)
    users_out = [await serialize_user(u, current_user["id"]) for u in users]
    # Posts: content match
    posts_cursor = db.posts.find({"content": {"$regex": q, "$options": "i"}}, {"_id": 0}).sort("timestamp", -1).limit(30)
    posts = await posts_cursor.to_list(30)
    posts_out = [await post_doc_to_out(p, current_user["id"]) for p in posts]
    return {"users": users_out, "posts": posts_out}

# --- Stories (visual bar of neighbours in same area) ---
@api_router.get("/stories")
async def stories(current_user: dict = Depends(get_current_user)):
    """Returns recent active neighbours in the same area for the stories ring bar."""
    area_key = normalize_area(current_user["area"])
    # Get distinct user_ids with posts in last 7 days in this area
    since = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    recent_author_ids = await db.posts.distinct("user_id", {"area_key": area_key, "timestamp": {"$gte": since}})
    # Also include all neighbours (not just active) so bar isn't empty
    all_ids = await db.users.distinct("id", {"area_key": area_key})
    # Active first
    ordered = list(dict.fromkeys(list(recent_author_ids) + list(all_ids)))
    ordered = [uid for uid in ordered if uid != current_user["id"]][:20]
    users = []
    for uid in ordered:
        u = await db.users.find_one({"id": uid}, {"_id": 0, "id": 1, "name": 1, "avatar_path": 1})
        if u:
            u["active"] = uid in recent_author_ids
            users.append(u)
    return {"items": users}

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
    return {"message": "LocalConnect Lite API is running"}

# --- Startup: Indexes + Demo Seed ---
DEMO_AREA = "Koramangala"
DEMO_USERS = [
    {"name": "Aanya Sharma", "email": "aanya@demo.com", "password": "demo123", "area": DEMO_AREA,
     "bio": "Farmers market hunter 🌱 · weekend runner · cat mum to Misha"},
    {"name": "Rohan Mehta", "email": "rohan@demo.com", "password": "demo123", "area": DEMO_AREA,
     "bio": "Running Brewberry Cafe since 2019 ☕ · ping me for deals"},
    {"name": "Priya Iyer", "email": "priya@demo.com", "password": "demo123", "area": DEMO_AREA,
     "bio": "RWA member · Cyclist · Bengaluru born & bred"},
    {"name": "Kabir Joshi", "email": "kabir@demo.com", "password": "demo123", "area": "Indiranagar",
     "bio": "Musician · vinyl collector · coffee snob"},
]
DEMO_POSTS = [
    ("aanya@demo.com", "Anyone know a good weekend farmer's market nearby? Looking for fresh produce 🌱", "normal"),
    ("rohan@demo.com", "FLAT 20% OFF at Brewberry Cafe this weekend! Mention LocalConnect at checkout ☕", "offer"),
    ("priya@demo.com", "Power outage on 5th Block expected tomorrow 10am-2pm. Plan accordingly!", "normal"),
    ("aanya@demo.com", "Lost my grey tabby cat near 80ft Road. Answers to 'Misha'. Please DM if spotted.", "normal"),
    ("rohan@demo.com", "Buy 1 Get 1 Pizza at Slice House until Sunday. Come hungry!", "offer"),
    ("priya@demo.com", "Starting a morning walking group at Cubbon Park — 6am Saturdays. Reply if keen!", "normal"),
    ("kabir@demo.com", "Open mic night at The Humming Tree this Friday. First 10 sign-ups get a free drink 🎸", "offer"),
]

@app.on_event("startup")
async def on_startup():
    init_storage()
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.users.create_index("area_key")
    await db.posts.create_index("id", unique=True)
    await db.posts.create_index([("area_key", 1), ("timestamp", -1)])
    await db.posts.create_index("user_id")
    await db.comments.create_index([("post_id", 1), ("timestamp", 1)])
    await db.files.create_index("storage_path")

    # Backfill existing users with new fields (idempotent)
    await db.users.update_many({"bio": {"$exists": False}}, {"$set": {"bio": ""}})
    await db.users.update_many({"avatar_path": {"$exists": False}}, {"$set": {"avatar_path": None}})
    await db.users.update_many({"following": {"$exists": False}}, {"$set": {"following": []}})
    await db.posts.update_many({"saved_by": {"$exists": False}}, {"$set": {"saved_by": []}})
    await db.posts.update_many({"image_path": {"$exists": False}}, {"$set": {"image_path": None}})

    # Seed demo users
    for u in DEMO_USERS:
        existing = await db.users.find_one({"email": u["email"]})
        if not existing:
            uid = str(uuid.uuid4())
            await db.users.insert_one({
                "id": uid,
                "name": u["name"],
                "email": u["email"],
                "password_hash": hash_password(u["password"]),
                "area": u["area"],
                "area_key": normalize_area(u["area"]),
                "bio": u.get("bio", ""),
                "avatar_path": None,
                "following": [],
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
        else:
            # ensure bio present for existing demo users
            if not existing.get("bio"):
                await db.users.update_one({"email": u["email"]}, {"$set": {"bio": u.get("bio", "")}})

    # Seed demo posts if none exist
    existing_count = await db.posts.count_documents({})
    if existing_count == 0:
        base_time = datetime.now(timezone.utc)
        for idx, (email, content, ptype) in enumerate(DEMO_POSTS):
            user = await db.users.find_one({"email": email})
            if not user:
                continue
            await db.posts.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": user["id"],
                "user_name": user["name"],
                "content": content,
                "type": ptype,
                "area": user["area"],
                "area_key": normalize_area(user["area"]),
                "image_path": None,
                "timestamp": (base_time - timedelta(hours=idx)).isoformat(),
                "liked_by": [],
                "saved_by": [],
            })

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

# --- Wire up ---
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
