# Pulse Assessment Notes

## Phase 1 — Make it run

### Architectural Decisions

- **Map provider migration:** Mapbox requires payment verification to issue
  tokens, which blocked local development. Migrated to maplibre-gl with
  MapTiler as the tile provider — 1:1 API compatible, free tier sufficient,
  no credit card required for reviewers to run the app.
- **Attribution control:** maplibre-gl handles `attributionControl` slightly
  differently from mapbox-gl; updated the map init accordingly.
- **Prisma client generation:** Added `prisma generate` to the build pipeline
  to prevent missing schema artifact errors in the serverless environment.

### Bugs Fixed

- **Signaling race condition:** Both peers were sending offers simultaneously,
  leaving both stuck in `have-local-offer`. Fixed by guarding
  `onnegotiationneeded` to the initiator only, and adding signaling state
  checks in `handleSignal` to reject descriptions in the wrong state.
- **Signal re-delivery:** The poll API was returning the same signals on every
  tick. Fixed by deleting signals from the database immediately after delivery.
- **Signaling routing:** `offer` and `answer` cases in `processSignal` fell
  through to the `ice` handler with no actual processing. Fixed by routing
  all three signal types through `PeerSession.handleSignal`.
- **Chat protocol mismatch:** `sendChat` was sending `{ t: "msg" }` but the
  receiver checked for `{ t: "chat" }`. Messages were silently dropped.
- **Stale presence:** Dots stayed on the map after users closed the tab. Fixed
  by calling `leave` on `beforeunload`/`pagehide` and tightening presence
  expiry on the server.

## Phase 2 — Make it good

### Visual Direction

Chose a dark atmospheric aesthetic — deep space / night globe — to match the
anonymous, ephemeral nature of the product. The core idea: Pulse should feel
like looking at Earth from orbit, not like a chat app.

### Map

- Migrated map style from `streets-v2` to `backdrop-dark` (MapTiler) for a
  deep navy, near-black globe feel
- Enabled MapLibre globe projection (`setProjection("globe")`) with atmospheric
  fog and star field (`setFog`) for spatial depth
- Replaced static peer dots with blue glowing pulse rings (CSS box-shadow
  animation) — like sonar pings on a radar
- Own location dot uses emerald green to distinguish it instantly from peers
- Removed random per-peer hue coloring in favor of a consistent blue glow
  that reads clearly against the dark map

### Component Redesigns

- **EntryGate:** Full-screen dark background with ambient radial glow orbs,
  logo mark, shimmer CTA button, Framer Motion fade-in entrance
- **ChatPanel:** Frosted glass panel (`backdrop-blur + bg-white/5`) sliding in
  from the right with a spring animation. Avatar, status dot, icon buttons.
  Chat messages animate in individually with spring physics
- **ConnectionPrompt:** Glass card with spring scale entrance over a
  backdrop-blurred overlay. Pulsing dot indicator for incoming requests
- **VideoPanel:** Cinematic gradient overlays on remote video, animated PiP
  with spring entrance, gradient control bar

### Animations (Framer Motion)

- `AnimatePresence` wrapping all conditional UI so exit animations play
- Spring physics throughout (connection prompt, chat panel slide-in, message
  bubbles, video PiP)
- Toast notices animate down from top, exit upward
- Shimmer sweep on the Enter button on hover

### Polish

- Consistent `glass` utility class across all overlays
- Thin custom scrollbar on the chat panel
- Status indicator dot (green/yellow) on chat header
- Icon-only video button to reduce visual clutter
- Send button as icon circle instead of text label

## Phase 3 — Make it secure

### Threat Model

The app originally trusted all client-supplied identity claims with no
verification. Any client could impersonate another user, steal their signals,
spoof messages on their behalf, or kick them off the map entirely — no
authentication existed on any endpoint.

### Issues Found

| Priority | Issue                                                                                | Severity |
| -------- | ------------------------------------------------------------------------------------ | -------- |
| 1        | No authentication — `id` is fully client-controlled, anyone can impersonate any user | Critical |
| 2        | `fromId` unverified in `/api/signal` — anyone can spoof signals from other users     | Critical |
| 3        | No rate limiting — single client can flood the signal table or poll unboundedly      | High     |
| 4        | Payload size never enforced despite `MAX_PAYLOAD` being defined                      | High     |
| 5        | Signal `type` cast but never validated — arbitrary strings written to DB             | High     |
| 6        | Debug logs expose full session IDs and DB state in production                        | Medium   |
| 7        | Poll token passed in query string — appears in server access logs                    | Medium   |
| 8        | No CORS headers — any origin can read API responses                                  | Medium   |
| 9        | `id` only length-checked, not format-validated                                       | Low      |

### Fixes Shipped

- **Token authentication** — `/api/join` generates a `randomBytes(32)` token,
  stores it on the `Presence` row, and returns it once to the client.
  All subsequent requests (`poll`, `signal`, `leave`) must present the token.
  Verified server-side with `crypto.timingSafeEqual` to prevent timing attacks.
  Tying the token to `fromId` in `/api/signal` eliminates sender spoofing —
  a client can only send signals as the identity it joined with.

- **Rate limiting** — per-endpoint limits via Upstash Ratelimit (Redis),
  persistent across Vercel cold starts. Limits: join 10/min, poll 120/min,
  signal 60/min, leave 20/min. Checked before any parsing or DB work so
  floods are rejected cheaply.

- **Payload and type validation** — enforced the existing `MAX_PAYLOAD` (64 KB)
  limit that was defined but never checked. Added `VALID_TYPES` enforcement
  so arbitrary strings can't be written to the signal table.

- **Production log gating** — all `console.log` calls gated behind
  `NODE_ENV !== "production"`. `console.error` on DB failures left ungated.

- **Poll token moved to Authorization header** — token removed from the query
  string and sent as `Authorization: Bearer <token>` so it never appears in
  server access logs or browser history.

- **CORS headers** — `proxy.ts` at the project root sets
  `Access-Control-Allow-Origin` to the production domain only. Handles
  OPTIONS preflight. Permissive in development.

- **UUID v4 validation** — replaced loose length check with a strict regex
  on all `id`, `fromId`, and `toId` fields. Only valid UUIDs can interact
  with the API.

### Known Remaining Issues

- **Token in `localStorage`** — accessible to any JS on the page (XSS risk).
  The hardened alternative is an `HttpOnly` cookie set server-side, but that
  is a meaningful refactor of the join flow and out of scope here.

## Phase 4 — Make it better

### What I built

A **shared drawing canvas** that appears as a second tab alongside chat during
an active connection. Both strangers can draw on the same canvas in real time
— strokes sync peer-to-peer over the existing WebRTC data channel, with no
server involvement. The canvas is destroyed the moment either person
disconnects: nothing is saved, nothing persists.

### Why this

Pulse's whole identity is built on ephemerality and anonymity — "no accounts,
no history, nothing stored." A shared canvas takes that idea and makes it
_felt_ rather than just stated. Two strangers can build something together —
a doodle, a game of tic-tac-toe, a shared joke — and the moment the connection
ends, it's gone. That's a much more memorable expression of the product's
philosophy than a chat log ever could be, and it gives two strangers something
to _do_ together beyond typing.

It was also the right scope for the time available: no new server
infrastructure, no new signaling types, no schema changes. It reuses the data
channel that chat and WebRTC negotiation already use, just with two new
message types (`draw`, `clear`).

### How it works

- `PeerSession` (in `lib/webrtc.ts`) gained two new outbound methods,
  `sendDraw()` and `sendClear()`, and two new callbacks, `onDraw` and
  `onClear`, wired into the existing data channel message router.
- `DrawCanvas` is a new component: an HTML canvas with pointer event handlers
  for drawing, a small color palette (8 colors), three brush sizes, and a
  clear button. Every local stroke segment is sent over the data channel as
  `{ t: "draw", x0, y0, x1, y1, color, width }` and rendered immediately
  on the remote canvas via a ref the parent wires up.
- `ChatPanel` now has a Chat / Draw tab switcher so the panel doesn't need to
  grow — drawing lives in the same space as chat.
- Coordinates are sent in canvas pixel space. Both canvases are rendered at a
  fixed size, so strokes line up correctly between peers without needing a
  shared coordinate transform.

### What I'd do with more time

- **Responsive canvas sizing** — currently fixed at 384x480px. With more time
  I'd send canvas dimensions on first connect and scale incoming strokes to
  the recipient's actual canvas size, so it works well on different screen
  sizes.
- **Smoothing / interpolation** — fast strokes can produce visible segment
  gaps on the receiving end if the data channel is congested. A simple
  client-side smoothing pass (e.g. quadratic curve through recent points)
  would make remote strokes look as smooth as local ones.
- **Shapes and undo** — basic shape tools (line, rectangle, circle) and a
  per-user undo would make it feel more like a real collaborative tool rather
  than a sketchpad.
- **Presence cursor** — a small ghost cursor showing where the other person's
  pointer currently is, even before they draw, to make the "together" feeling
  stronger.
- **Touch testing** — pointer events should work on mobile, but I'd want to
  test on an actual touchscreen device to confirm `touch-none` and pressure
  behave as expected across browsers.
