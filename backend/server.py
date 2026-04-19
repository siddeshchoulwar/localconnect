from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import uuid
import logging
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, status
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
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days for simpler MVP UX

def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]

# --- App & Router ---
app = FastAPI(title="LocalConnect Lite API")
api_router = APIRouter(prefix="/api")
bearer_scheme = HTTPBearer(auto_error=False)

# --- Models ---
class UserSignup(BaseModel):
    name: str = Field(..., min_length=1, max_length=60)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)
    area: str = Field(..., min_length=1, max_length=60)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    email: EmailStr
    area: str
    created_at: datetime

class AuthResponse(BaseModel):
    token: str
    user: UserOut

class PostCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=1000)
    type: Literal["normal", "offer"] = "normal"

class PostOut(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    user_name: str
    content: str
    type: str
    area: str
    timestamp: datetime
    likes: int
    liked: bool = False

class LikeResponse(BaseModel):
    post_id: str
    likes: int
    liked: bool

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
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def serialize_user(doc: dict) -> dict:
    return {
        "id": doc["id"],
        "name": doc["name"],
        "email": doc["email"],
        "area": doc["area"],
        "created_at": doc["created_at"] if isinstance(doc["created_at"], datetime)
        else datetime.fromisoformat(doc["created_at"]),
    }

def normalize_area(area: str) -> str:
    return area.strip().lower()

# --- Auth Routes ---
@api_router.post("/auth/signup", response_model=AuthResponse)
async def signup(payload: UserSignup):
    email = payload.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    user_doc = {
        "id": user_id,
        "name": payload.name.strip(),
        "email": email,
        "password_hash": hash_password(payload.password),
        "area": payload.area.strip(),
        "area_key": normalize_area(payload.area),
        "created_at": now.isoformat(),
    }
    await db.users.insert_one(user_doc)
    token = create_access_token(user_id, email)
    return AuthResponse(token=token, user=UserOut(**serialize_user(user_doc)))

@api_router.post("/auth/login", response_model=AuthResponse)
async def login(payload: UserLogin):
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user["id"], email)
    return AuthResponse(token=token, user=UserOut(**serialize_user(user)))

@api_router.get("/auth/me", response_model=UserOut)
async def me(current_user: dict = Depends(get_current_user)):
    return UserOut(**serialize_user(current_user))

# --- Posts Routes ---
def post_doc_to_out(doc: dict, current_user_id: str) -> PostOut:
    liked_by = doc.get("liked_by", [])
    ts = doc["timestamp"]
    if isinstance(ts, str):
        ts = datetime.fromisoformat(ts)
    return PostOut(
        id=doc["id"],
        user_id=doc["user_id"],
        user_name=doc["user_name"],
        content=doc["content"],
        type=doc["type"],
        area=doc["area"],
        timestamp=ts,
        likes=len(liked_by),
        liked=current_user_id in liked_by,
    )

@api_router.post("/posts", response_model=PostOut)
async def create_post(payload: PostCreate, current_user: dict = Depends(get_current_user)):
    post_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    doc = {
        "id": post_id,
        "user_id": current_user["id"],
        "user_name": current_user["name"],
        "content": payload.content.strip(),
        "type": payload.type,
        "area": current_user["area"],
        "area_key": normalize_area(current_user["area"]),
        "timestamp": now.isoformat(),
        "liked_by": [],
    }
    await db.posts.insert_one(doc)
    return post_doc_to_out(doc, current_user["id"])

@api_router.get("/posts", response_model=List[PostOut])
async def list_posts(current_user: dict = Depends(get_current_user)):
    area_key = normalize_area(current_user["area"])
    cursor = db.posts.find({"area_key": area_key}, {"_id": 0}).sort("timestamp", -1).limit(200)
    posts = await cursor.to_list(200)
    return [post_doc_to_out(p, current_user["id"]) for p in posts]

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

@api_router.get("/users/{user_id}", response_model=UserOut)
async def get_user(user_id: str, current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserOut(**serialize_user(user))

@api_router.get("/users/{user_id}/posts", response_model=List[PostOut])
async def user_posts(user_id: str, current_user: dict = Depends(get_current_user)):
    cursor = db.posts.find({"user_id": user_id}, {"_id": 0}).sort("timestamp", -1).limit(200)
    posts = await cursor.to_list(200)
    return [post_doc_to_out(p, current_user["id"]) for p in posts]

@api_router.get("/")
async def root():
    return {"message": "LocalConnect Lite API is running"}

# --- Startup: Indexes + Demo Seed ---
DEMO_AREA = "Koramangala"
DEMO_USERS = [
    {"name": "Aanya Sharma", "email": "aanya@demo.com", "password": "demo123", "area": DEMO_AREA},
    {"name": "Rohan Mehta", "email": "rohan@demo.com", "password": "demo123", "area": DEMO_AREA},
    {"name": "Priya Iyer",  "email": "priya@demo.com", "password": "demo123", "area": DEMO_AREA},
]
DEMO_POSTS = [
    ("aanya@demo.com", "Anyone know a good weekend farmer's market nearby? Looking for fresh produce 🌱", "normal"),
    ("rohan@demo.com", "FLAT 20% OFF at Brewberry Cafe this weekend! Mention LocalConnect at checkout ☕", "offer"),
    ("priya@demo.com", "Power outage on 5th Block expected tomorrow 10am-2pm. Plan accordingly!", "normal"),
    ("aanya@demo.com", "Lost my grey tabby cat near 80ft Road. Answers to 'Misha'. Please DM if spotted.", "normal"),
    ("rohan@demo.com", "Buy 1 Get 1 Pizza at Slice House until Sunday. Come hungry!", "offer"),
]

@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.posts.create_index("id", unique=True)
    await db.posts.create_index([("area_key", 1), ("timestamp", -1)])

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
                "created_at": datetime.now(timezone.utc).isoformat(),
            })

    # Seed demo posts only if posts collection empty for the demo area
    existing_count = await db.posts.count_documents({"area_key": normalize_area(DEMO_AREA)})
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
                "timestamp": (base_time - timedelta(hours=idx)).isoformat(),
                "liked_by": [],
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
