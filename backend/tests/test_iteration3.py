"""
Iteration 3 — LocalConnect Lite MASSIVE expansion tests.

Covers:
- Account-type split (personal/business) at signup
- Location update + Haversine distance calc
- Products (business-only, CRUD, nearby/offers filtering)
- Businesses listing
- Events (CRUD, going toggle, nearby vs area)
- Notifications (like/comment/follow/mention auto-create, read-all, unread-count)
- Multi-image posts
- Search regex-escape + multi-resource return
- Denormalised followers_count / following_count
- Nearby users endpoint
"""
import os
import uuid
import time
import requests
import pytest
from pathlib import Path

# Load frontend/.env manually to get REACT_APP_BACKEND_URL when running via pytest
_env_file = Path("/app/frontend/.env")
if _env_file.exists():
    for line in _env_file.read_text().splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            os.environ.setdefault("REACT_APP_BACKEND_URL", line.split("=", 1)[1].strip())

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"


# ---------------- Fixtures ----------------

@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(session, email, password="demo123"):
    r = session.post(f"{API}/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"login failed for {email}: {r.text}"
    return r.json()["token"], r.json()["user"]


def _auth(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def aanya(session):
    token, user = _login(session, "aanya@demo.com")
    return {"token": token, "user": user}


@pytest.fixture(scope="module")
def rohan(session):
    token, user = _login(session, "rohan@demo.com")
    return {"token": token, "user": user}


@pytest.fixture(scope="module")
def priya(session):
    token, user = _login(session, "priya@demo.com")
    return {"token": token, "user": user}


@pytest.fixture(scope="module")
def kabir(session):
    token, user = _login(session, "kabir@demo.com")
    return {"token": token, "user": user}


@pytest.fixture(scope="module")
def meera(session):
    token, user = _login(session, "meera@demo.com")
    return {"token": token, "user": user}


# ---------------- Signup / Account type ----------------

class TestSignupAccountType:
    def test_business_signup_requires_business_name(self, session):
        email = f"TEST_biz_{uuid.uuid4().hex[:8]}@demo.com"
        r = session.post(f"{API}/auth/signup", json={
            "name": "TEST Biz NoName",
            "email": email,
            "password": "demo123",
            "area": "Koramangala",
            "account_type": "business",
        })
        assert r.status_code == 400
        assert "business" in r.json().get("detail", "").lower()

    def test_business_signup_with_business_name_ok(self, session):
        email = f"TEST_biz_{uuid.uuid4().hex[:8]}@demo.com"
        r = session.post(f"{API}/auth/signup", json={
            "name": "TEST Biz Owner",
            "email": email,
            "password": "demo123",
            "area": "Koramangala",
            "account_type": "business",
            "business_name": "TEST Shop LLP",
            "business_category": "cafe",
            "phone": "9999999999",
        })
        assert r.status_code == 200
        user = r.json()["user"]
        assert user["account_type"] == "business"
        assert user["business_name"] == "TEST Shop LLP"

    def test_personal_signup_no_business_name(self, session):
        email = f"TEST_pers_{uuid.uuid4().hex[:8]}@demo.com"
        r = session.post(f"{API}/auth/signup", json={
            "name": "TEST Person",
            "email": email,
            "password": "demo123",
            "area": "Koramangala",
            "account_type": "personal",
        })
        assert r.status_code == 200
        assert r.json()["user"]["account_type"] == "personal"


# ---------------- Location + Haversine ----------------

class TestLocationAndDistance:
    def test_update_location_persists(self, session, aanya):
        r = session.post(f"{API}/users/me/location",
                         json={"lat": 12.9352, "lng": 77.6245},
                         headers=_auth(aanya["token"]))
        assert r.status_code == 200
        u = r.json()
        assert u["lat"] == 12.9352
        assert u["lng"] == 77.6245

    def test_ensure_seed_locations(self, session, rohan, kabir):
        # rohan = Brewberry, kabir = Indiranagar; seed should already have them
        # Set them explicitly to guarantee distance math below.
        r1 = session.post(f"{API}/users/me/location",
                          json={"lat": 12.9340, "lng": 77.6230},
                          headers=_auth(rohan["token"]))
        assert r1.status_code == 200
        r2 = session.post(f"{API}/users/me/location",
                          json={"lat": 12.9716, "lng": 77.6412},
                          headers=_auth(kabir["token"]))
        assert r2.status_code == 200

    def test_haversine_distance_populated(self, session, aanya, rohan, kabir):
        # Aanya should see rohan close (~0.2 km) and kabir further (~4.5 km)
        r = session.get(f"{API}/users/{rohan['user']['id']}",
                        headers=_auth(aanya["token"]))
        assert r.status_code == 200
        d_rohan = r.json().get("distance_km")
        assert d_rohan is not None and d_rohan < 1.0, f"expected <1km, got {d_rohan}"

        r2 = session.get(f"{API}/users/{kabir['user']['id']}",
                         headers=_auth(aanya["token"]))
        assert r2.status_code == 200
        d_kabir = r2.json().get("distance_km")
        assert d_kabir is not None
        assert 3.5 < d_kabir < 6.5, f"expected 3.5-6.5 km, got {d_kabir}"


# ---------------- Products ----------------

class TestProducts:
    product_id = None

    def test_personal_cannot_create_product(self, session, aanya):
        r = session.post(f"{API}/products", json={
            "name": "TEST Product Personal",
            "price": 100,
            "category": "food",
            "is_offer": False,
        }, headers=_auth(aanya["token"]))
        assert r.status_code == 403

    def test_business_can_create_product(self, session, rohan):
        r = session.post(f"{API}/products", json={
            "name": "TEST Cappuccino",
            "price": 180,
            "category": "cafe",
            "description": "TEST desc",
            "is_offer": True,
        }, headers=_auth(rohan["token"]))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["name"] == "TEST Cappuccino"
        assert d["price"] == 180
        assert d["is_offer"] is True
        assert d["business_id"] == rohan["user"]["id"]
        TestProducts.product_id = d["id"]

    def test_list_products_by_business(self, session, aanya, rohan):
        r = session.get(f"{API}/products",
                        params={"business_id": rohan["user"]["id"]},
                        headers=_auth(aanya["token"]))
        assert r.status_code == 200
        ids = [p["id"] for p in r.json()]
        assert TestProducts.product_id in ids

    def test_list_products_nearby_5km(self, session, aanya):
        r = session.get(f"{API}/products",
                        params={"nearby": "true", "radius_km": 5},
                        headers=_auth(aanya["token"]))
        assert r.status_code == 200
        prods = r.json()
        # All returned should have distance <= 5 km
        for p in prods:
            if p.get("distance_km") is not None:
                assert p["distance_km"] <= 5.0

    def test_list_products_offers_only(self, session, aanya):
        r = session.get(f"{API}/products",
                        params={"offers_only": "true"},
                        headers=_auth(aanya["token"]))
        assert r.status_code == 200
        for p in r.json():
            assert p["is_offer"] is True

    def test_non_owner_cannot_delete_product(self, session, aanya):
        r = session.delete(f"{API}/products/{TestProducts.product_id}",
                           headers=_auth(aanya["token"]))
        assert r.status_code == 403

    def test_owner_can_delete_product(self, session, rohan):
        r = session.delete(f"{API}/products/{TestProducts.product_id}",
                           headers=_auth(rohan["token"]))
        assert r.status_code in (200, 204)


# ---------------- Businesses ----------------

class TestBusinesses:
    def test_list_businesses(self, session, aanya):
        r = session.get(f"{API}/businesses", headers=_auth(aanya["token"]))
        assert r.status_code == 200
        biz = r.json()
        assert len(biz) >= 1
        # all returned must be account_type=business
        for b in biz:
            assert b.get("account_type") == "business"

    def test_businesses_nearby_filter(self, session, aanya):
        r = session.get(f"{API}/businesses",
                        params={"nearby": "true", "radius_km": 5},
                        headers=_auth(aanya["token"]))
        assert r.status_code == 200
        for b in r.json():
            if b.get("distance_km") is not None:
                assert b["distance_km"] <= 5.0


# ---------------- Events ----------------

class TestEvents:
    event_id = None

    def test_create_event(self, session, aanya):
        r = session.post(f"{API}/events", json={
            "title": "TEST Clean-up Drive",
            "description": "TEST community cleanup",
            "event_date": "2026-06-15T10:00:00Z",
            "location_name": "Koramangala Park",
        }, headers=_auth(aanya["token"]))
        assert r.status_code == 200, r.text
        e = r.json()
        assert e["title"] == "TEST Clean-up Drive"
        assert e["attendees_count"] == 0
        TestEvents.event_id = e["id"]

    def test_list_events_area(self, session, aanya):
        r = session.get(f"{API}/events", headers=_auth(aanya["token"]))
        assert r.status_code == 200
        ids = [e["id"] for e in r.json()]
        assert TestEvents.event_id in ids

    def test_list_events_nearby(self, session, aanya):
        r = session.get(f"{API}/events", params={"nearby": "true"},
                        headers=_auth(aanya["token"]))
        assert r.status_code == 200

    def test_toggle_going(self, session, priya):
        r = session.post(f"{API}/events/{TestEvents.event_id}/going",
                         headers=_auth(priya["token"]))
        assert r.status_code == 200
        d = r.json()
        assert d["going"] is True
        assert d["attendees_count"] >= 1

        r2 = session.post(f"{API}/events/{TestEvents.event_id}/going",
                          headers=_auth(priya["token"]))
        assert r2.status_code == 200
        assert r2.json()["going"] is False

    def test_non_author_cannot_delete_event(self, session, priya):
        r = session.delete(f"{API}/events/{TestEvents.event_id}",
                           headers=_auth(priya["token"]))
        assert r.status_code == 403

    def test_author_can_delete_event(self, session, aanya):
        r = session.delete(f"{API}/events/{TestEvents.event_id}",
                           headers=_auth(aanya["token"]))
        assert r.status_code in (200, 204)


# ---------------- Multi-image posts + mentions + notifications ----------------

class TestPostsAndNotifications:
    post_id = None

    def test_create_multi_image_post(self, session, aanya):
        r = session.post(f"{API}/posts", json={
            "content": "TEST multi-image post @Rohan check this out",
            "image_paths": ["uploads/fake1.jpg", "uploads/fake2.jpg", "uploads/fake3.jpg"],
            "post_type": "general",
        }, headers=_auth(aanya["token"]))
        assert r.status_code == 200, r.text
        p = r.json()
        assert len(p.get("image_paths", [])) == 3
        TestPostsAndNotifications.post_id = p["id"]

    def test_mention_creates_notification(self, session, rohan):
        # Wait briefly for async notify
        time.sleep(0.5)
        r = session.get(f"{API}/notifications", headers=_auth(rohan["token"]))
        assert r.status_code == 200
        notifs = r.json()
        mention_found = any(n.get("type") == "mention" for n in notifs)
        assert mention_found, "expected mention notification for rohan"

    def test_like_creates_notification(self, session, priya, aanya):
        r = session.post(f"{API}/posts/{TestPostsAndNotifications.post_id}/like",
                         headers=_auth(priya["token"]))
        assert r.status_code == 200
        time.sleep(0.5)
        r2 = session.get(f"{API}/notifications", headers=_auth(aanya["token"]))
        assert r2.status_code == 200
        assert any(n.get("type") == "like" for n in r2.json())

    def test_comment_creates_notification(self, session, priya, aanya):
        r = session.post(f"{API}/posts/{TestPostsAndNotifications.post_id}/comments",
                         json={"content": "TEST comment"},
                         headers=_auth(priya["token"]))
        assert r.status_code == 200
        time.sleep(0.5)
        r2 = session.get(f"{API}/notifications", headers=_auth(aanya["token"]))
        assert any(n.get("type") == "comment" for n in r2.json())

    def test_unread_count_and_read_all(self, session, aanya):
        c1 = session.get(f"{API}/notifications/unread-count",
                         headers=_auth(aanya["token"]))
        assert c1.status_code == 200
        assert "count" in c1.json()
        assert c1.json()["count"] >= 0

        r = session.post(f"{API}/notifications/read-all",
                         headers=_auth(aanya["token"]))
        assert r.status_code == 200

        c2 = session.get(f"{API}/notifications/unread-count",
                         headers=_auth(aanya["token"]))
        assert c2.json()["count"] == 0

    def test_cleanup_post(self, session, aanya):
        r = session.delete(f"{API}/posts/{TestPostsAndNotifications.post_id}",
                           headers=_auth(aanya["token"]))
        assert r.status_code in (200, 204)


# ---------------- Follow denormalisation ----------------

class TestFollowDenormalisation:
    def test_follow_updates_counts(self, session, aanya, kabir):
        # Get baseline
        b1 = session.get(f"{API}/users/{kabir['user']['id']}",
                         headers=_auth(aanya["token"])).json()
        b2 = session.get(f"{API}/auth/me",
                         headers=_auth(aanya["token"])).json()
        f0 = b1.get("followers_count", 0)
        fl0 = b2.get("following_count", 0)

        # Follow
        r = session.post(f"{API}/users/{kabir['user']['id']}/follow",
                         headers=_auth(aanya["token"]))
        assert r.status_code == 200
        following_now = r.json().get("following")

        k_after = session.get(f"{API}/users/{kabir['user']['id']}",
                              headers=_auth(aanya["token"])).json()
        a_after = session.get(f"{API}/auth/me",
                              headers=_auth(aanya["token"])).json()

        if following_now:
            assert k_after["followers_count"] == f0 + 1
            assert a_after["following_count"] == fl0 + 1
            # Unfollow cleanup
            session.post(f"{API}/users/{kabir['user']['id']}/follow",
                         headers=_auth(aanya["token"]))
        else:
            # was already following -> just unfollowed
            assert k_after["followers_count"] == f0 - 1


# ---------------- Search ----------------

class TestSearch:
    def test_search_regex_escape_no_redos(self, session, aanya):
        # ".*" should be treated literally -> returns empty/no 500
        r = session.get(f"{API}/search", params={"q": "a.*"},
                        headers=_auth(aanya["token"]))
        assert r.status_code == 200
        d = r.json()
        # Should contain keys users, posts (and ideally products/businesses)
        assert "users" in d and "posts" in d

    def test_search_multi_resource(self, session, aanya):
        r = session.get(f"{API}/search", params={"q": "a"},
                        headers=_auth(aanya["token"]))
        assert r.status_code == 200
        d = r.json()
        for key in ("users", "posts"):
            assert key in d
        # products / businesses optional but checked
        # (iteration 3 added them)
        has_new_keys = ("products" in d) and ("businesses" in d)
        assert has_new_keys, f"search should include products+businesses, got keys={list(d.keys())}"


# ---------------- Nearby users ----------------

class TestNearbyUsers:
    def test_nearby_users_within_5km(self, session, aanya):
        r = session.get(f"{API}/nearby/users",
                        params={"radius_km": 5},
                        headers=_auth(aanya["token"]))
        assert r.status_code == 200
        users = r.json()
        for u in users:
            if u.get("distance_km") is not None:
                assert u["distance_km"] <= 5.0
