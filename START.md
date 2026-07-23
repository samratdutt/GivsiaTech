# GivsiaTech — 3D Animated Site + Role-Based Backend

Full-stack starter for Givsia Private Limited's tech freelancing brand.
Black / lavender / yellow theme, Orbitron + Space Grotesk type, 3D animated
hero (React Three Fiber), GSAP scroll animations, JWT auth, admin/manager/client
role system, and Razorpay payments on MongoDB.

## Structure

```
givsiatech-3d/
├── frontend/   Vite + React + Three.js + GSAP
└── backend/    Node + Express + MongoDB + Razorpay
```

## 1. Backend setup

```bash
cd backend
npm install
cp .env.example .env
```

Fill in `.env`:
- `MONGO_URI` — your MongoDB connection string (Atlas or local)
- `JWT_SECRET` — any long random string
- `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` — from your Razorpay dashboard

```bash
npm run dev
```

API runs at `http://localhost:5000`.

(See section 3 below for how to create your first admin — no manual
database editing required.)

## 2. Frontend setup

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Site runs at `http://localhost:5173`.

## 3. Creating your first admin (two ways)

Admin accounts are no longer something you hand-edit in MongoDB. Pick one:

**Option A — CLI seed script (recommended)**

In `backend/.env`, set:
```
ADMIN_EMAIL=you@givsiatech.com
ADMIN_PASSWORD=a-strong-password
ADMIN_NAME=Your Name
```
Then run:
```bash
cd backend
npm run seed:admin
```
This creates the account (or promotes it to admin if it already exists as a
regular user). Safe to run more than once.

**Option B — Admin invite code, from the site itself**

In `backend/.env`, set:
```
ADMIN_INVITE_CODE=some-long-random-string
```
Then on the site's `/register` page, click **"Have an admin invite code?
Register as admin →"** and enter the code. This calls
`POST /api/auth/register-admin`, which only succeeds if the code matches.

**Once your admins are set up, blank out or rotate `ADMIN_INVITE_CODE`** —
anyone with that code can self-register as admin, so treat it like a
password.

Additional admins after the first one don't need either of these — an
existing admin can create them directly from the admin dashboard's **Users**
tab (name, email, temp password, role — no invite code needed).

## 4. How the role system works

- **client** (default on public signup) — requests projects, pays via
  Razorpay, and can view only their own payments, invoices, and project
  status timeline. Nothing else in the system is visible to them.
- **manager** — sees only the projects an admin has assigned to them, can
  update status and post progress notes on those.
- **admin** — full visibility and control, via a tabbed dashboard:
  - **Overview** — live counts (users, orders, active projects, new leads)
    and total revenue collected, plus a recent-orders feed
  - **Orders** — every order in the system, assign a manager, change status,
    expand any order to see (and add to) its full progress timeline
  - **Users** — create any user directly (including other admins/managers),
    change anyone's role, activate/deactivate accounts, delete accounts
  - **Leads** — every contact-form submission, mark as contacted/closed

All of this is enforced **server-side** in `backend/middleware/role.js` and
directly in each route handler (e.g. a client hitting
`GET /api/payments/orders/:id` for an order that isn't theirs gets a 403).
The frontend route guards in `ProtectedRoute.jsx` are just UX — the backend
is the real security boundary, so it's safe even if someone tampers with
the frontend.

A few built-in guardrails: an admin can't delete or demote their own
currently-logged-in account, and the system refuses to delete the last
remaining admin — so you can't accidentally lock yourself out.

## 5. Project status & invoices — how clients see them

Every order now has:
- An **invoice number**, auto-generated on creation (`GVT-2026-XXXXXX`)
- A **progress timeline** — a running log of notes admins/managers post
  (`POST /api/payments/orders/:id/progress`), each optionally changing the
  order's overall status

On the client dashboard, each project shows its payment status, amount, and
a "View status & invoice" toggle that reveals the same timeline admins see
(read-only) — so clients always know exactly where their project stands
without needing to ask. A "Print invoice" button opens a clean, printable
invoice in a new tab once the order is paid.

## 6. Payments flow

1. Client picks a service + amount on their dashboard → `POST /api/payments/create-order`
2. Backend creates a Mongo `Order` + a Razorpay order, returns the Razorpay key + order id
3. Frontend opens the Razorpay checkout modal
4. On success, frontend calls `POST /api/payments/verify` which checks the
   HMAC signature server-side before marking the order paid
5. (Optional, recommended for production) Configure a Razorpay webhook
   pointing at `POST /api/payments/webhook` as a second, server-to-server
   confirmation in case the client closes the tab mid-flow

## 7. Givi — the AI chatbot

`backend/routes/chatRoutes.js` proxies `POST /api/chat/givi` to Google's
Gemini API (`gemini-2.0-flash` by default — free tier, no credit card
required). Every request also fetches live pricing tiers from MongoDB and
combines them with the site's services/portfolio copy into a context block
injected into the system prompt, so answers are grounded in what's actually
true rather than guessed (a lightweight RAG pattern — no vector DB needed
for a corpus this small). The frontend widget is `GiviChat.jsx` — a floating
button bottom-right on every page, stateless on the backend (the frontend
re-sends the running message history each turn).

**Required:** set `GEMINI_API_KEY` in `backend/.env` (get one free at
aistudio.google.com). Without it, the endpoint returns a friendly
"not configured" message instead of erroring.

## 8. Site sections

The one-page marketing site (`Home.jsx`) now includes, in order:
Hero (3D scene) → Services → About → Portfolio/Work → Pricing →
Testimonials → Contact form. Nav anchors jump to each via `#id`.

- **Portfolio** ships with two real projects pulled from prior work (GIVSIA,
  GivsiaTech itself) plus one "coming soon" placeholder — replace as new
  client work ships.
- **Testimonials** are placeholder quotes, clearly marked in the source
  (`TestimonialsSection.jsx`) — swap in real client feedback before launch,
  don't ship fake attributed quotes.
- **Contact form** posts to `POST /api/contact`, stored in MongoDB and
  visible to admins/managers under the dashboard's "Leads" tab. Optionally
  emails you on submit if SMTP is configured (see below).
- **Pricing** cards are starting-range estimates, not fixed quotes — edit
  `PricingSection.jsx` to match your actual rates.

## 9. Email notifications (optional)

`backend/utils/sendEmail.js` uses Nodemailer. If `SMTP_HOST` is left blank
in `.env`, emails are skipped silently (logged to console instead) so
nothing breaks without it configured. When set, it sends:
- A notification to `ADMIN_NOTIFY_EMAIL` on new contact-form leads
- A notification to a manager when an admin assigns them an order

## 10. Sitewide 3D + motion

Every section now has its own distinct 3D motion instead of reusing the hero
treatment everywhere:

| Section | Effect | File |
|---|---|---|
| Hero | Rotating icosahedron core + orbit ring + node lattice (WebGL, React Three Fiber); headline types itself out character-by-character with a blinking cursor | `HeroScene.jsx`, `TypingHeadline.jsx` |
| Services | Cards arranged on a 3D ring that continuously orbits (`rotateY` + `translateZ`), pauses on hover | `ServicesSection.jsx` + `OrbitCarousel.jsx` |
| About | Decorative dashed ring slowly rotating behind the heading | `AboutSection.jsx` |
| Portfolio/Work | Cards slide slowly left-to-right in a seamless looping 3D marquee, pauses on hover to read | `PortfolioSection.jsx` (`.marquee-track` in `index.css`) |
| Pricing | Cards do a 3D flip-up entrance (`rotateX`), then glow toward the cursor on hover and pulse on click | `PricingSection.jsx` + `TiltCard.jsx` (`glow` prop) |
| Testimonials | Auto-rotating carousel, each quote flips in on the Y-axis (`rotateY`) | `TestimonialsSection.jsx` |
| Contact | Pulsing expanding rings behind the heading | `ContactSection.jsx` |
| Login/Register | A small rotating 3D cube emblem above the form | `AuthVisual.jsx` |
| Whole site (background) | Faint drifting particle field fixed behind every page, plus soft lavender/yellow/cyan glow blobs in the page background | `AmbientField.jsx`, `index.css` |

Everything except the hero and ambient field is done in pure CSS 3D
transforms (`transform-style: preserve-3d`, `rotateY`, `translateZ`) rather
than WebGL — much cheaper to render, so having motion on every section
doesn't tank performance on mobile. All scroll-triggered animations use
`IntersectionObserver` (or GSAP `ScrollTrigger` for the fade-ins) so nothing
animates until it's actually on screen.

`OrbitCarousel.jsx` is generic — pass it any array + a `renderItem` function
and it'll arrange them in a spinning 3D ring. Reuse it anywhere you want the
same "cards orbiting in a circle" effect (e.g. a future "clients" or "tech
stack" section).

`TiltCard.jsx` now takes an optional `glow` prop — when set, the card tracks
the cursor with a radial glow (`--mx`/`--my` CSS custom properties updated on
mousemove) and pulses on click. Pass it to any card you want the same
glowing, clickable feel as Pricing.

`TypingHeadline.jsx` takes a `segments` array (`{ text, accent?, break? }`)
and types through them in order, preserving per-segment color — used for the
hero h1. Reuse it anywhere else you want a typewriter effect.

**Theme**: the background is now three soft radial gradient blobs (lavender,
yellow, cyan) fixed behind the whole site instead of flat black, buttons and
the eyebrow label have a subtle glow, and there's a `.gradient-text` utility
class for lavender→yellow gradient text if you want it elsewhere.

## 11. The 3D hero scene

`frontend/src/components/HeroScene.jsx` — built with `@react-three/fiber` +
`@react-three/drei`:
- A rotating icosahedron "core crystal"
- An orbiting ring
- A node lattice (36 glowing nodes + connecting lines) representing your
  network of automation/web/SaaS work
- Ambient sparkles + environment lighting

Swap the geometry, colors, or node count to taste — it's all in one file.

## 12. Logo

`frontend/public/logo.jpg` is the GivsiaTech wordmark + icon (also delivered
separately). Source SVG is included if you want to re-export at a different
size or recolor it.

## 13. Deploying

- **Frontend**: Vercel/Netlify — `npm run build` outputs `dist/`
- **Backend**: Render/Railway/EC2 — point `MONGO_URI` at MongoDB Atlas in production
- Set `CLIENT_URL` in the backend `.env` to your deployed frontend URL (for CORS)
- Set `VITE_API_URL` in the frontend `.env` to your deployed backend URL

### Running the backend in Docker (with request logging)

`docker-compose.yml` at the repo root builds `backend/Dockerfile` and runs it:

```bash
docker compose up -d --build   # start (rebuilds if backend/ changed)
docker compose logs -f backend # live per-request log feed
docker compose down            # stop
```

Every request is logged to stdout by `morgan` (added in `server.js`) — one
line per request with timestamp, method, path, status, response size, and
timing, e.g.:

```
2026-07-15T10:46:07.143Z GET /api/health 200 42b - 3.822 ms
```

Never the request/response body, so passwords/tokens/OTP codes can't end up
in logs. Docker's default logging driver captures a container's stdout
automatically — that's all `docker compose logs` is reading — and the
`logging:` block in `docker-compose.yml` caps it at 10MB × 5 files so it
can't grow unbounded on a long-running host.

## 14. Secrets & security

All credentials in this project live in `backend/.env` and `frontend/.env`
only — never in source code. Both files are git-ignored (see `.gitignore`);
`backend/.env.example` and `frontend/.env.example` list every variable each
service needs, with placeholder values, so a fresh clone knows what to fill
in (`cp .env.example .env` in each folder, then fill in real values).

**⚠️ Rotate every credential below before/immediately after your first
deploy, and any time you suspect a `.env` file was shared, copied, or
committed:**

- `MONGO_URI` (MongoDB Atlas password)
- `JWT_SECRET`
- `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET`
- `TWILIO_AUTH_TOKEN`
- `GEMINI_API_KEY`
- `GOOGLE_CLIENT_ID` (if the OAuth consent screen / client was ever public)
- `ADMIN_PASSWORD` and `ADMIN_INVITE_CODE`
- `SMTP_PASS`

**If any of these were ever hardcoded in a source file and committed to
git, rotating them in `.env` is not enough** — the old value is still
readable in the git history (`git log -p`) even after you delete it from
the file, and stays there for anyone with repo access (including a public
GitHub repo, forks, and CI logs) until you rotate the credential at the
provider. Treat any such value as compromised and generate a new one from
the provider's dashboard; don't just edit `.env`.

Other things worth knowing:

- The Razorpay **key ID** (`RAZORPAY_KEY_ID`) is safe to send to the
  browser — it's returned by `POST /api/payments/create-order`
  ([paymentRoutes.js](backend/routes/paymentRoutes.js)) and used directly
  in Razorpay Checkout ([ClientDashboard.jsx](frontend/src/pages/dashboards/ClientDashboard.jsx)).
  The **key secret** never leaves the backend.
- This is a Vite app, so only variables prefixed `VITE_` are exposed to
  the browser bundle (the Next.js/CRA prefixes `NEXT_PUBLIC_`/`REACT_APP_`
  don't apply here). Only `VITE_API_URL` and `VITE_GOOGLE_CLIENT_ID` use
  it — both are meant to be public. Never add a `VITE_`-prefixed variable
  for `RAZORPAY_KEY_SECRET`, `JWT_SECRET`, `MONGO_URI`, or any other
  server-only credential.
- The dev fallback in `/api/auth/send-otp` returns the OTP code directly
  in the API response (`devCode`) when Twilio isn't configured. That's
  convenient for local dev but means anyone can register without a real
  phone if it's left active in production — configure `TWILIO_*` before
  going live.
- This project has no Supabase or Stripe integration; if you add either
  later, the same rule applies — Supabase's anon key and Stripe's
  publishable key are safe client-side only when Row Level Security
  (Supabase) is enabled on every table, and secret/service-role keys must
  stay server-side only, never behind a `VITE_` prefix.

## Next steps worth doing before going live

- Replace placeholder testimonials and the "coming soon" portfolio card with real work
- Add email verification / password reset flow
- Add pagination to the admin tables once you have real volume
- Add Razorpay webhook secret verification in production (`RAZORPAY_WEBHOOK_SECRET`)
- Add rate limiting (`express-rate-limit`) on `/api/auth/login` and `/api/chat/givi`
  (the chatbot endpoint is public and calls a paid API — rate-limit it before launch)
