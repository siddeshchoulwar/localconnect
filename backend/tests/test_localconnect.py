"""LocalConnect Lite - Backend API tests (auth, posts, likes, area filtering)."""
import os
import uuid
import pytest
import requests
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else "https://local-simple-net.preview.emergentagent.com"
# Fall back: read frontend .env because backend pytest needs public URL
if not os.environ.get("REACT_APP_BACKEND_URL"):
    fe_env = Path(__file__).resolve().parents[2] / "frontend" / ".env"
    if fe_env.exists():
        for line in fe_env.read_text().splitlines():
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

API = f"{BASE_URL}/api"
DEMO_EMAIL = "aanya@demo.com"
DEMO_PASS = "demo123"


@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def demo_token(client):
    r = client.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASS})
    assert r.status_code == 200, f"Demo login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def demo_auth(client, demo_token):
    return {"Authorization": f"Bearer {demo_token}"}


# ----- Health -----
def test_root(client):
    r = client.get(f"{API}/")
    assert r.status_code == 200
    assert "running" in r.json()["message"].lower()


# ----- Auth: signup / login -----
class TestAuth:
    def test_signup_and_login(self, client):
        suffix = uuid.uuid4().hex[:8]
        email = f"TEST_{suffix}@example.com"
        payload = {"name": "TEST User", "email": email, "password": "pwd12345", "area": "TestArea"}
        r = client.post(f"{API}/auth/signup", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data and isinstance(data["token"], str) and len(data["token"]) > 10
        assert data["user"]["email"] == email.lower()
        assert data["user"]["area"] == "TestArea"
        assert "id" in data["user"]

        # duplicate email
        r2 = client.post(f"{API}/auth/signup", json=payload)
        assert r2.status_code == 400

        # login with correct
        r3 = client.post(f"{API}/auth/login", json={"email": email, "password": "pwd12345"})
        assert r3.status_code == 200
        assert r3.json()["user"]["email"] == email.lower()

        # login wrong password
        r4 = client.post(f"{API}/auth/login", json={"email": email, "password": "wrongpass"})
        assert r4.status_code == 401

    def test_me_requires_auth(self, client):
        r = client.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_with_token(self, client, demo_auth):
        r = client.get(f"{API}/auth/me", headers=demo_auth)
        assert r.status_code == 200
        d = r.json()
        assert d["email"] == DEMO_EMAIL
        assert d["area"].lower() == "koramangala"

    def test_login_invalid_email(self, client):
        r = client.post(f"{API}/auth/login", json={"email": "nonexistent@demo.com", "password": "x"})
        assert r.status_code == 401


# ----- Posts: listing + create + area filter -----
class TestPosts:
    def test_list_requires_auth(self, client):
        assert client.get(f"{API}/posts").status_code == 401

    def test_list_demo_posts(self, client, demo_auth):
        r = client.get(f"{API}/posts", headers=demo_auth)
        assert r.status_code == 200
        posts = r.json()
        assert isinstance(posts, list)
        assert len(posts) >= 5, f"Expected >=5 seeded posts, got {len(posts)}"
        # all same area
        assert all(p["area"].lower() == "koramangala" for p in posts)
        # newest first
        timestamps = [p["timestamp"] for p in posts]
        assert timestamps == sorted(timestamps, reverse=True)
        # At least one offer
        assert any(p["type"] == "offer" for p in posts)

    def test_create_normal_and_offer(self, client, demo_auth):
        # Normal
        r = client.post(f"{API}/posts", headers=demo_auth, json={"content": "TEST_normal_post", "type": "normal"})
        assert r.status_code == 200
        d = r.json()
        assert d["content"] == "TEST_normal_post"
        assert d["type"] == "normal"
        assert d["area"].lower() == "koramangala"
        assert d["likes"] == 0 and d["liked"] is False

        # Offer
        r2 = client.post(f"{API}/posts", headers=demo_auth, json={"content": "TEST_offer_post", "type": "offer"})
        assert r2.status_code == 200
        assert r2.json()["type"] == "offer"

        # verify persistence via list
        r3 = client.get(f"{API}/posts", headers=demo_auth)
        contents = [p["content"] for p in r3.json()]
        assert "TEST_normal_post" in contents
        assert "TEST_offer_post" in contents

    def test_area_isolation(self, client):
        # create new user in a unique area
        suffix = uuid.uuid4().hex[:8]
        email = f"TEST_iso_{suffix}@example.com"
        area = f"TEST_Area_{suffix}"
        r = client.post(f"{API}/auth/signup", json={"name": "Iso", "email": email, "password": "pwd12345", "area": area})
        assert r.status_code == 200
        token = r.json()["token"]
        h = {"Authorization": f"Bearer {token}"}

        # feed should be empty
        r2 = client.get(f"{API}/posts", headers=h)
        assert r2.status_code == 200
        assert r2.json() == [], f"Expected empty feed for new area, got {r2.json()}"

        # create a post - should appear only for them
        r3 = client.post(f"{API}/posts", headers=h, json={"content": "isolated post", "type": "normal"})
        assert r3.status_code == 200
        r4 = client.get(f"{API}/posts", headers=h)
        assert len(r4.json()) == 1
        assert r4.json()[0]["content"] == "isolated post"

    def test_area_case_insensitive(self, client):
        # sign up two users with same area in different case
        s = uuid.uuid4().hex[:6]
        a_email = f"TEST_caseA_{s}@ex.com"
        b_email = f"TEST_caseB_{s}@ex.com"
        area_lower = f"caseTest_{s}"
        area_upper = area_lower.upper()
        rA = client.post(f"{API}/auth/signup", json={"name": "A", "email": a_email, "password": "pwd12345", "area": area_lower})
        rB = client.post(f"{API}/auth/signup", json={"name": "B", "email": b_email, "password": "pwd12345", "area": area_upper})
        assert rA.status_code == 200 and rB.status_code == 200
        hA = {"Authorization": f"Bearer {rA.json()['token']}"}
        hB = {"Authorization": f"Bearer {rB.json()['token']}"}
        # A posts
        client.post(f"{API}/posts", headers=hA, json={"content": f"shared_{s}", "type": "normal"})
        # B should see it
        posts_b = client.get(f"{API}/posts", headers=hB).json()
        assert any(p["content"] == f"shared_{s}" for p in posts_b)


# ----- Likes -----
class TestLikes:
    def test_like_toggle(self, client, demo_auth):
        # create a post to like
        r = client.post(f"{API}/posts", headers=demo_auth, json={"content": "TEST_like_target", "type": "normal"})
        pid = r.json()["id"]

        # like
        r1 = client.post(f"{API}/posts/{pid}/like", headers=demo_auth)
        assert r1.status_code == 200
        d1 = r1.json()
        assert d1["liked"] is True and d1["likes"] == 1

        # toggle idempotency: call again -> unlike
        r2 = client.post(f"{API}/posts/{pid}/like", headers=demo_auth)
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2["liked"] is False and d2["likes"] == 0

        # like again and verify via list
        client.post(f"{API}/posts/{pid}/like", headers=demo_auth)
        posts = client.get(f"{API}/posts", headers=demo_auth).json()
        found = next((p for p in posts if p["id"] == pid), None)
        assert found is not None and found["liked"] is True and found["likes"] == 1

    def test_like_not_found(self, client, demo_auth):
        r = client.post(f"{API}/posts/nonexistent-id/like", headers=demo_auth)
        assert r.status_code == 404

    def test_like_requires_auth(self, client):
        r = client.post(f"{API}/posts/anything/like")
        assert r.status_code == 401


# ----- Users -----
class TestUsers:
    def test_get_user_and_posts(self, client, demo_auth):
        me = client.get(f"{API}/auth/me", headers=demo_auth).json()
        uid = me["id"]
        r = client.get(f"{API}/users/{uid}", headers=demo_auth)
        assert r.status_code == 200
        assert r.json()["email"] == DEMO_EMAIL

        r2 = client.get(f"{API}/users/{uid}/posts", headers=demo_auth)
        assert r2.status_code == 200
        assert isinstance(r2.json(), list)
        assert all(p["user_id"] == uid for p in r2.json())

    def test_get_user_not_found(self, client, demo_auth):
        r = client.get(f"{API}/users/does-not-exist", headers=demo_auth)
        assert r.status_code == 404

    def test_users_requires_auth(self, client):
        assert client.get(f"{API}/users/anything").status_code == 401
        assert client.get(f"{API}/users/anything/posts").status_code == 401


# ----- Validation -----
class TestValidation:
    def test_signup_short_password(self, client):
        r = client.post(f"{API}/auth/signup", json={"name": "X", "email": "TEST_valid@ex.com", "password": "123", "area": "A"})
        assert r.status_code == 422

    def test_create_post_empty_content(self, client, demo_auth):
        r = client.post(f"{API}/posts", headers=demo_auth, json={"content": "", "type": "normal"})
        assert r.status_code == 422
