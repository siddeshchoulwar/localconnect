# LocalConnect Lite — PRD

## Problem Statement
Hyperlocal super-app combining Instagram-style social feed (personal) with Blinkit/Zomato-style business directory (shops & offers) + community events — all connected within a **5 km radius** using OpenStreetMap.

## Architecture
- **Frontend**: React 19 + Tailwind + shadcn/ui + lucide-react + sonner + **react-leaflet + OpenStreetMap** (free, no API key)
- **Backend**: FastAPI + Motor (async MongoDB) + PyJWT + bcrypt + requests
- **DB**: MongoDB — `users`, `posts`, `comments`, `products`, `events`, `notifications`, `files`
- **Object Storage**: Emergent Object Storage (avatars, shop banners, post/product/event images)
- **Auth**: JWT Bearer tokens (localStorage `lc_token`); `?auth=` query param for `<img>` downloads
- **Geolocation**: Browser Geolocation API + Haversine distance (5 km default radius)

## User Personas
- **Neighbour** — shares/discovers life in the block (social feed + events).
- **Local business** — lists products/offers, builds a following, connects with nearby customers.
- **Event organiser** — posts meetups, cleanups, concerts, community events.

## Account Types (chosen at signup)
- **Personal** → social feed, events, follow neighbours & shops, bookmarks.
- **Business** → all of personal + shop profile (menu/products), offer listings, customer reach.

## Implemented (Feb 2026)

### Iteration 1 — MVP
JWT auth · Area-based feed · Normal/Offer posts · Likes · Profile with stats.

### Iteration 2 — Instagram/Threads rewrite
Image uploads · Comments · Follow/Unfollow · Bookmarks · Stories bar · Explore · Search · Edit profile · Post deletion · Double-tap-to-like · Bottom nav (Feed/Explore/Post/Saved/Profile) · User bios · Offers filter.

### Iteration 3 — Social + Commerce super-app
- **Account types**: personal vs business at signup (business requires `business_name` + category)
- **Business directory** (`/shops`): OpenStreetMap with 5 km circle + shop markers; category chips (Food/Grocery/Cafés/Retail/Services/Health/Other); hot-offers strip; distance-sorted list with 📞 call button
- **Business detail** (`/shop/:id`): shop card with stats; menu/products grid; Follow + Call + Add-item (for owners)
- **Products / offers**: businesses list items (name, price, category, image, `is_offer` flag); CRUD
- **Events** (`/events`): "What's new in area" — map + cards with date, location, "I'm in" going toggle, attendees count
- **Notifications** (`/notifications`): bell with unread badge + 30s polling; auto-created on like/comment/follow/mention; typed icons; mark-all-read on open
- **@mentions**: parsed in posts + comments → notification sent to mentioned user
- **Multi-image posts**: up to 6 images with prev/next carousel + counter
- **Location**: prompt on first visit; `/users/me/location` endpoint; Haversine filtering on `/businesses`, `/products`, `/events`, `/nearby/users`
- **Search upgrade**: now includes businesses + products + regex-escape for ReDoS safety
- **Perf**: denormalised `followers_count` / `following_count` on user docs (no more count-per-read)
- **Bottom nav** redesigned: Feed / Shops / Post / Events / Me
- **31/31 iter3 backend tests + critical frontend flows verified** (100% on new suite)

## API Routes (v3)
### Auth
`POST /auth/signup` (+ account_type, business_name, business_category, phone) · `POST /auth/login` · `GET /auth/me`

### Users
`PATCH /users/me` · `POST /users/me/location` · `GET /users/{id}` · `GET /users/{id}/posts` · `POST /users/{id}/follow`

### Posts
`GET /posts` · `POST /posts` (image_paths array) · `DELETE /posts/{id}` · `POST /posts/{id}/like` · `/save` · `GET /me/saved`

### Comments
`GET /posts/{id}/comments` · `POST /posts/{id}/comments`

### Products & Shops
`GET /products` (nearby, radius_km, category, business_id, offers_only) · `POST /products` (business only) · `DELETE /products/{id}`
`GET /businesses` (nearby, category, radius_km)

### Events
`GET /events` (nearby, radius_km) · `POST /events` · `POST /events/{id}/going` · `DELETE /events/{id}`

### Notifications
`GET /notifications` · `GET /notifications/unread-count` · `POST /notifications/read-all`

### Discover
`GET /explore` · `GET /search?q=` (users + posts + products + businesses) · `GET /stories` · `GET /nearby/users`

### Files
`POST /upload` (multipart, 6 MB cap) · `GET /files/{path:path}?auth=<token>`

## Seed Data
- 3 personal users (Aanya, Priya, Kabir) + 3 businesses (Brewberry Cafe, FreshCart 15, Patel's Kitchen) with real Bengaluru coords
- 4 posts · 8 products (mix of regular + offers) · 3 upcoming events

## Backlog
**P1**
- Order / cart flow for businesses (Zomato-style) — deferred (user chose directory-first)
- Real-time notifications via WebSocket (replace 30s poll)
- Event RSVP reminders

**P2**
- Delivery tracking / live status
- Ratings & reviews on shops and products
- @username handles (current: first-word-of-name match is brittle)
- Multi-image on events + products
- Shop banner hero image on business detail

**P3**
- Stripe integration for in-app offer redemption
- Web-push notifications
- Suggested shops / "people you may know"
- Dark theme

## Tech Debt (from iter3 review)
1. Split `server.py` (~1160 lines) into `routers/*` modules
2. Validate file owner_id on `image_path` references in products/events (currently trust client)
3. Batch avatar lookups in `/nearby/users` + `/businesses` (currently N+1)
4. Update/delete 3 obsolete legacy tests (API shape changes in iter3)
5. Migrate `@app.on_event` → FastAPI lifespan context
6. Add counter-drift repair script for followers_count
