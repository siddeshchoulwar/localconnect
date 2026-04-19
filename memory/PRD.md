# LocalConnect — PRD

## Problem Statement
Hyperlocal super-app combining Instagram-style social feed (personal accounts) with Blinkit/Zomato-style business directory (shops & offers) + community events + proper friends system — all connected within a **5 km radius** using OpenStreetMap.

## Branding
**App name**: LocalConnect (formerly "LocalConnect Lite" during MVP phase — renamed in iter 4 as app grew beyond MVP scope).

## Architecture
- **Frontend**: React 19 + Tailwind + shadcn/ui + lucide-react + sonner + react-leaflet + OpenStreetMap (free, no API key)
- **Backend**: FastAPI + Motor (MongoDB async) + PyJWT + bcrypt + requests
- **DB**: MongoDB — `users`, `posts`, `comments`, `products`, `events`, `notifications`, `files`, `friendships`, `friend_requests`
- **Object Storage**: Emergent Object Storage (avatars, shop banners, post/product/event images)
- **Auth**: JWT Bearer tokens (localStorage `lc_token`); `?auth=` query param for `<img>` downloads
- **Geolocation**: Browser Geolocation API + Haversine distance (5 km default radius)

## Account Types
- **Personal** — social feed, events, friends, follows, bookmarks.
- **Business** — all of personal + shop profile (menu/products), offers, customer reach. Redirected to `/shop/:id` by default.

## Implemented

### Iteration 1 — MVP (Feb 2026)
JWT auth · Area-based feed · Normal/Offer posts · Likes · Profile with stats.

### Iteration 2 — Instagram/Threads rewrite
Image uploads · Comments · Follow · Bookmarks · Stories bar · Explore · Search · Edit profile · Post deletion · Double-tap-to-like · Bottom nav · Bios · Offers filter.

### Iteration 3 — Social + Commerce super-app
Account types (personal/business) · Business directory `/shops` with OpenStreetMap + 5 km circle · Category chips · Hot-offers strip · Shop profile `/shop/:id` with menu/products · Product CRUD · Events `/events` with RSVP · Notifications with bell + polling · @mentions · Multi-image posts (up to 6, carousel) · Location-based filtering (Haversine) · Regex-escape safe search · Denormalised follower counts.

### Iteration 4 — Friends system + rebrand (current)
- **Friends system** — separate from Follow; symmetric with explicit accept/reject
  - `POST /users/{id}/friend-request` (auto-accepts if reverse-pending exists)
  - `POST /friend-requests/{id}/{accept,reject}` · `DELETE /friend-requests/{id}` · `DELETE /friends/{user_id}`
  - `GET /friends` · `/friend-requests/incoming` · `/outgoing` · `/counts`
  - `UserOut.friendship_status` enum: self | friends | pending_out | pending_in | none
  - `UserOut.friends_count` denormalised-ish
  - Notifications: `friend_request` + `friend_accept` with icons
- **Friends page `/friends`** — 3 tabs (Friends · Requests · Sent) with accept/reject/cancel/unfriend actions
- **Profile page enhancements**:
  - Stats row now has 4 cells: Posts · Friends · Followers · Following (Friends clickable → /friends on own profile)
  - Own profile: 3-button CTA row — Edit · Post · Friends
  - Other profiles: Friend-action button (Add / Cancel / Accept / Unfriend) alongside Follow button
- **TopBar search** — inline "+ Friend" / "Sent" / "Friends" badge on user rows
- **Rebrand**: "LocalConnect Lite" → "LocalConnect" across TopBar logo, HTML title, meta description, API root message, FastAPI title
- **24/24 iter-4 backend tests + full regression (all prior iterations pass)**

## API Routes (v3.1)
### Auth
`POST /auth/{signup,login}` (+ account_type, business fields) · `GET /auth/me`

### Users
`PATCH /users/me` · `POST /users/me/location` · `GET /users/{id}` · `/posts` · `POST /users/{id}/follow`

### Friends (new)
`POST /users/{id}/friend-request` · `POST /friend-requests/{id}/accept` · `/reject` · `DELETE /friend-requests/{id}` (cancel)
`DELETE /friends/{user_id}` · `GET /friends` · `/friend-requests/{incoming,outgoing,counts}`

### Posts / Comments / Saves
`GET/POST /posts` · `DELETE /posts/{id}` · `POST /posts/{id}/{like,save}` · `GET /me/saved`
`GET/POST /posts/{id}/comments`

### Shops / Products / Events
`GET /businesses` · `GET /products` · `POST/DELETE /products/{...}` · `GET/POST /events` · `POST /events/{id}/going`

### Notifications
`GET /notifications` · `/unread-count` · `POST /notifications/read-all`

### Discover
`GET /explore` · `/search?q=` · `/stories` · `/nearby/users`

### Files
`POST /upload` · `GET /files/{path:path}?auth=<token>`

## Seed Data
- **3 personal users** (Aanya, Priya, Kabir) + **3 businesses** (Brewberry Cafe, FreshCart 15, Patel's Kitchen) with real Bengaluru coords
- **5 posts · 8 products · 3 events**
- **Pre-seeded friendship**: Aanya ↔ Priya
- **Pre-seeded incoming request**: Kabir → Aanya (so UI demo is non-empty)

## Backlog
**P1**
- Real-time via WebSockets (replace 30s notification polling)
- Event RSVP reminder notifications
- Proper `@username` handles (current: first-word-of-name match is brittle)

**P2**
- Ratings & reviews on shops/products
- Multi-image on events/products
- "Suggested neighbours" in Friends page
- Shop banner hero image

**P3**
- Cart / ordering flow for businesses (Zomato-style)
- Stripe integration for in-app offer redemption
- Web-push notifications
- Dark theme

## Tech Debt
1. Split `server.py` (~1380 lines) into `routers/*` modules
2. Batch avatar lookups in `/nearby/users` + `/businesses` (N+1)
3. Migrate `@app.on_event` → FastAPI lifespan
4. Validate file `owner_id` on image_path references (trust client currently)
5. Drift-repair script for denormalised `followers_count` / `following_count`
