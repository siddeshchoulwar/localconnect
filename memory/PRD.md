# LocalConnect Lite — PRD

## Problem Statement
Hyperlocal social networking platform. Users from the same "area" (text field) see and share posts within their neighbourhood. Evolved from a simple MVP into an Instagram/Threads-inspired social app (requested by user, iteration 2).

## Architecture
- **Frontend**: React 19 + Tailwind + shadcn/ui + lucide-react + sonner
- **Backend**: FastAPI + Motor (async MongoDB) + PyJWT + bcrypt + requests (object storage)
- **DB**: MongoDB (collections: `users`, `posts`, `comments`, `files`)
- **Object Storage**: Emergent Object Storage via `EMERGENT_LLM_KEY` — stores avatars + post images
- **Auth**: JWT Bearer tokens in Authorization header + `?auth=` query param for `<img>` downloads

## User Personas
- **Neighbour** — shares news, recommendations, questions with area.
- **Local business / creator** — posts offers, announcements, connects with customers.
- **Explorer** — discovers trending content across nearby neighbourhoods.

## Core Requirements
1. Signup/Login (name, email, password, area)
2. Area-based feed (only posts from same area, case-insensitive)
3. Post types: `normal` + `offer` (offers highlighted yellow)
4. Like, comment, bookmark, delete posts
5. Image uploads on posts and avatars
6. Follow/unfollow users
7. Explore trending posts across all areas
8. Search users, areas, and posts
9. Edit profile (name, area, bio, avatar)

## Implemented

### Iteration 1 (2026-02)
- JWT auth, area-based feed, Normal/Offer posts, likes, profile with stats.

### Iteration 2 (2026-02) — Instagram/Threads rewrite
- Object-storage image uploads (posts + avatars) with 6MB limit + MIME validation
- Comments system with sheet-style UI
- Follow/unfollow with follower/following counts
- Bookmarks / Saved posts page
- Stories bar (neighbours in same area, gradient rings for active)
- Explore page (trending grid across all areas)
- Global search (users + posts, debounced 280ms)
- Edit profile with avatar upload
- Post deletion (author only)
- Double-tap-to-like on images
- Bottom navigation (Feed / Explore / Post / Saved / Profile)
- User bios (max 180 chars)
- Feed filter (All / Offers only)
- Instagram-style post cards (header, image, action row, caption, comments teaser)
- 38/38 backend pytest tests passing + all critical frontend flows verified

## API Routes
### Auth
- `POST /api/auth/signup` · `POST /api/auth/login` · `GET /api/auth/me`

### Users
- `PATCH /api/users/me` (name, area, bio, avatar_path)
- `GET /api/users/{id}` · `GET /api/users/{id}/posts`
- `POST /api/users/{id}/follow` (toggle)
- `GET /api/users/{id}/followers` · `/following`

### Posts
- `GET /api/posts` (area-filtered) · `POST /api/posts` · `DELETE /api/posts/{id}`
- `POST /api/posts/{id}/like` · `POST /api/posts/{id}/save`
- `GET /api/posts/{id}/comments` · `POST /api/posts/{id}/comments`
- `GET /api/me/saved`

### Discover
- `GET /api/explore` · `GET /api/search?q=` · `GET /api/stories`

### Files
- `POST /api/upload` (multipart) · `GET /api/files/{path:path}?auth=<token>`

## Backlog (prioritised)
**P1**
- Notifications (likes/comments/follows) — lightweight in-app bell
- Rich post images (multiple images / carousel)
- Tag/mention other users (@name)

**P2**
- Suggested neighbours to follow
- Nearby areas feed mix
- Push notifications (web-push)
- Activity feed / recent interactions

**P3**
- Dark theme toggle
- Email verification + password reset
- Shareable post links (?p=<id>)
- Post reporting + light moderation

## Next Tasks
1. Pick between: notifications, multi-image carousel, or mentions — highest-impact next
2. Denormalise `followers_count` on user doc for faster list endpoints (perf)
3. Escape regex input in `/api/search` (ReDoS safety)
4. Migrate `@app.on_event` → FastAPI lifespan context
