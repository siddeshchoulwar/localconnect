# LocalConnect Lite — PRD

## Problem Statement
MVP hyperlocal social networking platform. Users from the same "area" (manually entered text) can post updates and see posts from others in the same area. Focus on simplicity for a college project MVP.

## Architecture
- **Frontend**: React 19 + Tailwind + shadcn/ui + lucide-react + sonner (toasts)
- **Backend**: FastAPI + Motor (MongoDB async) + PyJWT + bcrypt
- **DB**: MongoDB (collections: `users`, `posts`)
- **Auth**: JWT Bearer tokens in Authorization header, token stored in localStorage (`lc_token`)

## User Personas
- **Community member** — wants to share local news, see neighbours' posts, like content.
- **Local business / offer-poster** — wants to promote deals to people in the same neighbourhood.

## Core Requirements (static)
1. Signup/Login with name, email, password, area
2. Feed shows posts ONLY from same area (case-insensitive match), sorted newest first
3. Create posts of type `normal` or `offer` — offers highlighted visually
4. Like button with count (toggle)
5. Profile page with user info and their posts

## Implemented (2026-02)
- ✅ JWT-based auth (signup, login, `/auth/me`)
- ✅ Area-based feed with `area_key` for case-insensitive filtering
- ✅ Create post (normal/offer) with 280-char limit
- ✅ Like / unlike toggle (`liked_by` array)
- ✅ Profile with stats (posts / likes / offers)
- ✅ Protected routes + redirect to `/login`
- ✅ Neo-brutalist UI (hard shadows, bold borders, warm cream palette)
- ✅ Demo data seeded: 3 users + 5 posts in "Koramangala"
- ✅ Toast notifications on post create
- ✅ 18/18 backend pytest tests passing + all critical frontend flows verified

## API Routes
- `POST /api/auth/signup` `{name, email, password, area}` → `{token, user}`
- `POST /api/auth/login` `{email, password}` → `{token, user}`
- `GET /api/auth/me` → user
- `GET /api/posts` → posts in caller's area
- `POST /api/posts` `{content, type}` → post
- `POST /api/posts/{id}/like` → `{post_id, likes, liked}`
- `GET /api/users/{id}` → user
- `GET /api/users/{id}/posts` → posts by user

## Backlog (prioritised)
**P1**
- Post deletion for authors
- Edit profile (change area, name)
- Comments on posts
- Search / filter (offers only, by keyword)

**P2**
- Pagination (beyond 200 posts)
- Image uploads on posts
- Follow neighbours / per-user notification badge
- Trending posts (most liked)
- Nearby areas (suggest adjacent neighbourhoods)

**P3**
- Pull-to-refresh on mobile
- Dark theme toggle
- Share post via link
- Email verification

## Next Tasks
1. Decide whether to add image uploads (needs object storage integration) or comments next
2. Polish: replace deprecated `@app.on_event` with FastAPI lifespan
3. Add post-deletion endpoint + UI
