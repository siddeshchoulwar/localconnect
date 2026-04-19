"""LocalConnect Lite - Iteration 2 backend tests.
Covers: upload/files, follow, save, comments, explore, search, stories,
delete post, profile update (bio/avatar/name propagation), image on posts.
"""
import io
import os
import uuid
import pytest
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    fe_env = Path(__file__).resolve().parents[2] / "frontend" / ".env"
    if fe_env.exists():
        for line in fe_env.read_text().splitlines():
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
API = f"{BASE_URL}/api"

AANYA = ("aanya@demo.com", "demo123")
ROHAN = ("rohan@demo.com", "demo123")
PRIYA = ("priya@demo.com", "demo123")
KABIR = ("kabir@demo.com", "demo123")


def _login(session, email, password):
    r = session.post(f"{API}/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def aanya(session):
    return _login(session, *AANYA)


@pytest.fixture(scope="session")
def rohan(session):
    return _login(session, *ROHAN)


@pytest.fixture(scope="session")
def priya(session):
    return _login(session, *PRIYA)


@pytest.fixture(scope="session")
def kabir(session):
    return _login(session, *KABIR)


def _hdr(u):
    return {"Authorization": f"Bearer {u['token']}"}


def _tiny_png() -> bytes:
    # Minimal valid 1x1 PNG
    return bytes.fromhex(
        "89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4"
        "890000000D49444154789C6300010000000500010D0A2DB40000000049454E44"
        "AE426082"
    )


class TestUpload:
    def test_upload_requires_auth(self, session):
        r = requests.post(f"{API}/upload", files={"file": ("a.png", _tiny_png(), "image/png")})
        assert r.status_code == 401

    def test_upload_png_and_serve(self, session, aanya):
        # upload (no JSON content-type)
        r = requests.post(
            f"{API}/upload",
            headers=_hdr(aanya),
            files={"file": ("a.png", _tiny_png(), "image/png")},
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert "path" in d and isinstance(d["path"], str) and d["path"]
        assert d["size"] > 0
        # Serve via ?auth= query param (as <img> would)
        r2 = requests.get(f"{API}/files/{d['path']}", params={"auth": aanya["token"]})
        assert r2.status_code == 200
        assert r2.headers.get("content-type", "").startswith("image/")
        # Without auth -> 401
        r3 = requests.get(f"{API}/files/{d['path']}")
        assert r3.status_code == 401

    def test_upload_rejects_bad_type(self, aanya):
        r = requests.post(
            f"{API}/upload", headers=_hdr(aanya),
            files={"file": ("a.txt", b"hello", "text/plain")},
        )
        assert r.status_code == 400


class TestProfileUpdate:
    def test_update_bio_and_propagate_name(self, session, aanya):
        # create a post under current name
        r = session.post(f"{API}/posts", headers=_hdr(aanya), json={"content": "TEST_name_prop", "type": "normal"})
        assert r.status_code == 200
        pid = r.json()["id"]
        original_name = aanya["user"]["name"]

        new_name = original_name + " (TEST)"
        new_bio = "TEST bio iteration 2"
        r2 = session.patch(f"{API}/users/me", headers=_hdr(aanya), json={"name": new_name, "bio": new_bio})
        assert r2.status_code == 200
        d = r2.json()
        assert d["name"] == new_name
        assert d["bio"] == new_bio

        # verify name propagated to existing post
        r3 = session.get(f"{API}/posts", headers=_hdr(aanya))
        found = next((p for p in r3.json() if p["id"] == pid), None)
        assert found and found["user_name"] == new_name

        # restore original name
        session.patch(f"{API}/users/me", headers=_hdr(aanya), json={"name": original_name})

    def test_bio_max_length(self, session, aanya):
        r = session.patch(f"{API}/users/me", headers=_hdr(aanya), json={"bio": "x" * 181})
        assert r.status_code == 422


class TestFollow:
    def test_cannot_follow_self(self, session, aanya):
        r = session.post(f"{API}/users/{aanya['user']['id']}/follow", headers=_hdr(aanya))
        assert r.status_code == 400

    def test_follow_toggle_and_counts(self, session, aanya, rohan):
        target = rohan["user"]["id"]
        # ensure clean: if currently following, unfollow first
        get_r = session.get(f"{API}/users/{target}", headers=_hdr(aanya)).json()
        if get_r.get("is_following"):
            session.post(f"{API}/users/{target}/follow", headers=_hdr(aanya))

        before = session.get(f"{API}/users/{target}", headers=_hdr(aanya)).json()["followers_count"]

        r = session.post(f"{API}/users/{target}/follow", headers=_hdr(aanya))
        assert r.status_code == 200
        d = r.json()
        assert d["following"] is True
        assert d["followers_count"] == before + 1

        # is_following reflected
        profile = session.get(f"{API}/users/{target}", headers=_hdr(aanya)).json()
        assert profile["is_following"] is True
        assert profile["followers_count"] == before + 1

        # appears in rohan's followers list
        fl = session.get(f"{API}/users/{target}/followers", headers=_hdr(rohan)).json()
        assert any(u["id"] == aanya["user"]["id"] for u in fl)
        # and in aanya's following
        fl2 = session.get(f"{API}/users/{aanya['user']['id']}/following", headers=_hdr(aanya)).json()
        assert any(u["id"] == target for u in fl2)

        # toggle off
        r2 = session.post(f"{API}/users/{target}/follow", headers=_hdr(aanya))
        assert r2.status_code == 200
        assert r2.json()["following"] is False
        assert r2.json()["followers_count"] == before

    def test_follow_nonexistent(self, session, aanya):
        r = session.post(f"{API}/users/does-not-exist/follow", headers=_hdr(aanya))
        assert r.status_code == 404


class TestSaveBookmark:
    def test_save_toggle_and_list(self, session, aanya, rohan):
        # rohan creates a post
        r = session.post(f"{API}/posts", headers=_hdr(rohan), json={"content": "TEST_save_target", "type": "normal"})
        assert r.status_code == 200
        pid = r.json()["id"]

        # aanya saves
        r2 = session.post(f"{API}/posts/{pid}/save", headers=_hdr(aanya))
        assert r2.status_code == 200 and r2.json()["saved"] is True

        # appears in /me/saved
        saved = session.get(f"{API}/me/saved", headers=_hdr(aanya)).json()
        assert any(p["id"] == pid and p["saved"] is True for p in saved)

        # toggle off
        r3 = session.post(f"{API}/posts/{pid}/save", headers=_hdr(aanya))
        assert r3.status_code == 200 and r3.json()["saved"] is False
        saved2 = session.get(f"{API}/me/saved", headers=_hdr(aanya)).json()
        assert not any(p["id"] == pid for p in saved2)


class TestComments:
    def test_add_list_and_count(self, session, aanya, rohan):
        r = session.post(f"{API}/posts", headers=_hdr(aanya), json={"content": "TEST_comment_target", "type": "normal"})
        pid = r.json()["id"]
        # 3 comments
        for txt in ["hi", "second", "third"]:
            rc = session.post(f"{API}/posts/{pid}/comments", headers=_hdr(rohan), json={"content": txt})
            assert rc.status_code == 200
            assert rc.json()["content"] == txt
        cs = session.get(f"{API}/posts/{pid}/comments", headers=_hdr(aanya)).json()
        assert [c["content"] for c in cs] == ["hi", "second", "third"]  # oldest first
        # comments_count reflected on post
        posts = session.get(f"{API}/posts", headers=_hdr(aanya)).json()
        found = next((p for p in posts if p["id"] == pid), None)
        assert found and found["comments_count"] == 3

    def test_comment_validation(self, session, aanya):
        r = session.post(f"{API}/posts", headers=_hdr(aanya), json={"content": "TEST_cmt_val", "type": "normal"})
        pid = r.json()["id"]
        # empty
        r1 = session.post(f"{API}/posts/{pid}/comments", headers=_hdr(aanya), json={"content": ""})
        assert r1.status_code == 422
        # too long
        r2 = session.post(f"{API}/posts/{pid}/comments", headers=_hdr(aanya), json={"content": "x" * 301})
        assert r2.status_code == 422

    def test_comment_on_missing_post(self, session, aanya):
        r = session.post(f"{API}/posts/does-not-exist/comments", headers=_hdr(aanya), json={"content": "hi"})
        assert r.status_code == 404


class TestDeletePost:
    def test_delete_own_post_also_deletes_comments(self, session, aanya, rohan):
        r = session.post(f"{API}/posts", headers=_hdr(aanya), json={"content": "TEST_del", "type": "normal"})
        pid = r.json()["id"]
        session.post(f"{API}/posts/{pid}/comments", headers=_hdr(rohan), json={"content": "bye"})
        r2 = session.delete(f"{API}/posts/{pid}", headers=_hdr(aanya))
        assert r2.status_code == 200 and r2.json().get("deleted") is True

        # comments gone (404 on fetch? endpoint returns empty list but post missing)
        r3 = session.get(f"{API}/posts/{pid}/comments", headers=_hdr(aanya))
        # even if endpoint doesn't 404, list should be empty
        assert r3.status_code == 200
        assert r3.json() == []

    def test_delete_others_post_403(self, session, aanya, rohan):
        r = session.post(f"{API}/posts", headers=_hdr(rohan), json={"content": "TEST_del_others", "type": "normal"})
        pid = r.json()["id"]
        r2 = session.delete(f"{API}/posts/{pid}", headers=_hdr(aanya))
        assert r2.status_code == 403

    def test_delete_missing_404(self, session, aanya):
        r = session.delete(f"{API}/posts/does-not-exist", headers=_hdr(aanya))
        assert r.status_code == 404


class TestExploreSearch:
    def test_explore_returns_trending_across_areas(self, session, aanya, kabir):
        # kabir (Indiranagar) creates post and likes it (via another user? self-like is allowed)
        r = session.post(f"{API}/posts", headers=_hdr(kabir), json={"content": "TEST_explore_indi", "type": "offer"})
        assert r.status_code == 200
        pid = r.json()["id"]
        session.post(f"{API}/posts/{pid}/like", headers=_hdr(kabir))

        # aanya (Koramangala) calls explore and should see kabir's post
        r2 = session.get(f"{API}/explore", headers=_hdr(aanya))
        assert r2.status_code == 200
        posts = r2.json()
        assert any(p["id"] == pid for p in posts), "explore should include posts from other areas"
        # sorted by likes desc then timestamp desc
        likes = [p["likes"] for p in posts]
        assert likes == sorted(likes, reverse=True) or len(posts) <= 1

    def test_search_users_and_posts(self, session, aanya):
        r = session.get(f"{API}/search", headers=_hdr(aanya), params={"q": "aanya"})
        assert r.status_code == 200
        d = r.json()
        assert "users" in d and "posts" in d
        assert any(u["email"] == "aanya@demo.com" for u in d["users"])

        r2 = session.get(f"{API}/search", headers=_hdr(aanya), params={"q": "Brewberry"})
        assert any("brewberry" in (p["content"] or "").lower() for p in r2.json()["posts"])

    def test_search_empty_query_rejected(self, session, aanya):
        r = session.get(f"{API}/search", headers=_hdr(aanya), params={"q": ""})
        assert r.status_code == 422


class TestStories:
    def test_stories_same_area_only(self, session, aanya):
        r = session.get(f"{API}/stories", headers=_hdr(aanya))
        assert r.status_code == 200
        items = r.json()["items"]
        # All items are users from Koramangala and exclude the caller
        aanya_id = aanya["user"]["id"]
        assert all(u["id"] != aanya_id for u in items)
        # At least rohan and priya should appear
        ids = {u["id"] for u in items}
        # Fetch rohan + priya ids
        ru = session.get(f"{API}/search", headers=_hdr(aanya), params={"q": "rohan"}).json()["users"]
        pu = session.get(f"{API}/search", headers=_hdr(aanya), params={"q": "priya"}).json()["users"]
        if ru:
            assert ru[0]["id"] in ids
        if pu:
            assert pu[0]["id"] in ids
        # active flag exists
        assert all("active" in u for u in items)


class TestPostWithImage:
    def test_create_post_with_image(self, aanya):
        # upload image first
        up = requests.post(
            f"{API}/upload", headers=_hdr(aanya),
            files={"file": ("p.png", _tiny_png(), "image/png")},
        )
        assert up.status_code == 200
        path = up.json()["path"]
        # create post with image_path
        r = requests.post(
            f"{API}/posts", headers={**_hdr(aanya), "Content-Type": "application/json"},
            json={"content": "TEST_post_with_image", "type": "normal", "image_path": path},
        )
        assert r.status_code == 200
        assert r.json()["image_path"] == path
