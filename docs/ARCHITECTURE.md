# GivsiaTech — Architecture & Control Flow

Internal reference only. This file lives in `docs/`, outside `frontend/src`
and `frontend/public`, so it is never bundled by Vite or served by the
website — nothing here reaches the live site.

Diagrams are Mermaid — render natively in VS Code (Markdown Preview),
GitHub/GitLab, Obsidian, or open `architecture.html` in this same folder
for a standalone browser view (kept in sync with this file).

---

## 1. System architecture

```mermaid
graph TB
    subgraph Client["Browser — React 18 + Vite SPA"]
        direction TB
        Providers["Global Providers<br/>ThemeContext · AuthContext · ToastContext · ConfirmContext"]
        Router["React Router (BrowserRouter)"]
        Pages["Public Pages<br/>Home · Login · Register · Profile"]
        Dashboards["Role Dashboards<br/>AdminDashboard · ClientDashboard · ServiceDashboard"]
        Shared["Shared UI<br/>Navbar · Footer · GiviChat · CookieConsent · LoadingScreen · HeroScene (3D)"]
        Axios["axios instance<br/>(JWT bearer interceptor)"]
        Providers --> Router
        Router --> Pages
        Router --> Dashboards
        Pages --> Shared
        Dashboards --> Shared
        Pages -.-> Axios
        Dashboards -.-> Axios
    end

    subgraph Server["Docker container — Node.js + Express API"]
        direction TB
        MW["Middleware chain<br/>morgan → helmet → mongoSanitize → cors → ipBlocklist → express.json → activityLogger"]
        SecMW["Rate limiters (per-route) · brute-force lockout ·<br/>content screening · upload signature check → SecurityEvent / BlockedIP"]
        AuthMW["protect (JWT verify) → authorize(role)"]
        Routes["14 route modules<br/>auth · users · payments · contact · chat · pricing · portfolio<br/>company · reviews · founders · uploads · outreach · activity · security · bizLead"]
        MW --> SecMW --> AuthMW --> Routes
    end

    subgraph Data["Data & External Services"]
        Mongo[("MongoDB Atlas<br/>16 collections")]
        Gemini["Google Gemini API<br/>Givi chatbot · outreach drafts · AI lead emails/proposals"]
        Places["Google Places API<br/>AI Business Lead Finder discovery"]
        Twilio["Twilio SMS<br/>OTP delivery"]
        Razorpay["Razorpay<br/>payments + refunds"]
        Gmail["Gmail SMTP (nodemailer)<br/>notifications + outreach"]
        GoogleOAuth["Google OAuth<br/>Sign in with Google"]
        PDFKit["PDFKit<br/>invoice generation (in-process, no external call)"]
    end

    Axios ==>|HTTPS + JWT| MW
    Routes --> Mongo
    Routes --> Gemini
    Routes --> Places
    Routes --> Twilio
    Routes --> Razorpay
    Routes --> Gmail
    Routes --> PDFKit
    AuthMW -.-> GoogleOAuth
```

---

## 2. Request / control flow (a typical authenticated call)

```mermaid
sequenceDiagram
    actor U as User (Browser)
    participant FE as React App
    participant AX as axios (adds JWT)
    participant MW as Express Middleware Chain
    participant RT as Route Handler
    participant DB as MongoDB

    U->>FE: Clicks a button (e.g. "Send email")
    FE->>AX: api.post("/outreach/send", data)
    AX->>MW: HTTPS request + Authorization: Bearer <JWT>
    MW->>MW: morgan logs the raw request line
    MW->>MW: helmet, mongoSanitize, cors, ipBlocklist, express.json()
    MW->>MW: activityLogger wraps res.json() to capture the outcome later
    MW->>RT: protect() verifies JWT, attaches req.user
    RT->>RT: authorize("admin","service") checks role (+ per-route rate limiter)
    RT->>DB: Mongoose query / write
    DB-->>RT: result
    RT-->>MW: res.json(...)
    MW->>MW: "finish" event — activityLogger logs "who did what"<br/>to stdout (docker logs) AND the ActivityLog collection
    MW-->>AX: JSON response
    AX-->>FE: resolved promise
    FE->>U: ToastContext shows a success/error toast
```

Two logging layers run on every request, independently:
- **morgan** — raw HTTP line (method, path, status, timing) → stdout only.
- **activityLogger** — human-readable "who did what" → stdout **and**
  persisted to Mongo (`ActivityLog`), visible in the admin dashboard's
  Activity tab. Read-only GETs are skipped; only side-effecting requests
  are logged. This is fully generic (mounted once, works for every route
  without touching individual route files) — new routes like `bizLeadRoutes.js`
  get audited automatically, with friendly labels added to
  `middleware/activityLogger.js`'s `ACTION_RULES`.

---

## 3. Role-based registration & routing

```mermaid
graph TD
    Reg["/register — 3 tabs<br/>Sign up · Admin · Service"]
    Reg -->|default| RC["POST /api/auth/register"]
    Reg -->|admin invite code| RA["POST /api/auth/register-admin"]
    Reg -->|service invite code| RS["POST /api/auth/register-service"]
    RC & RA & RS --> JWT["JWT issued<br/>role embedded, fetched via GET /api/auth/me"]
    JWT --> PR["ProtectedRoute<br/>(client-side UX guard only)"]
    PR -->|role = admin| AD["/dashboard/admin — 14 tabs<br/>overview · orders · renewals · users · messages · pricing · portfolio<br/>about · transactions · reviews · activity · security<br/>+ AI Lead Finder · New Business Monitor (highlighted separately)"]
    PR -->|role = client| CD["/dashboard/client<br/>request project (price-floor enforced) · pay · download invoice · cancel/refund · track · support · review"]
    PR -->|role = service| SD["/dashboard/service<br/>AI cold-outreach email"]
    PR -.->|real enforcement happens here, not in the frontend| SRV["Backend authorize(role) middleware<br/>on every protected route"]
```

The frontend guard (`ProtectedRoute`) only controls what's *shown*. The
actual security boundary is server-side — every protected route re-checks
the JWT and role independently, so tampering with frontend state can't
grant access to data the backend wouldn't otherwise allow. The two AI
Business Discovery tabs are admin-only by the same mechanism — there is no
separate "sales rep" role in this pass, per the module's own scoping
decision (see §6).

---

## 4. Data model relationships

```mermaid
erDiagram
    USER ||--o{ ORDER : places
    USER ||--o{ REVIEW : writes
    USER ||--o{ CONTACTMESSAGE : sends
    USER ||--o| FOUNDER : "has a profile (2 accounts only)"
    USER ||--o{ OUTREACH : sends
    USER ||--o{ ACTIVITYLOG : performs
    USER ||--o{ SECURITYEVENT : "triggers (best-effort)"
    USER ||--o{ BIZLEAD : "creates / is assigned"
    ORDER ||--o| REVIEW : "optionally linked"
    ORDER ||--o| CONTACTMESSAGE : "optionally linked (support msgs)"
    BIZLEAD ||--o{ OUTREACH : "communication history (shared log)"
```

`Pricing`, `Portfolio`, and `CompanyInfo` are standalone content
collections (admin-editable, no user references) — they feed the public
site sections, Givi's chatbot context, *and* the AI Lead Finder's
outreach/proposal generation (same `buildServiceContext()` helper, shared
across `chatRoutes.js`, `outreachRoutes.js`, and `bizLeadRoutes.js` so all
three ground their AI output in the same real facts). `Otp` and
`PasswordReset` are ephemeral (TTL-expired). `SecurityEvent` (90-day TTL)
and `BlockedIP` are IP-keyed, not user-keyed — the USER link on those is
optional/best-effort. `BizLead` reuses the existing `Outreach` collection
as its communication history (an optional `lead` ref was added to
`Outreach` rather than building a second email-log) — so an email sent
from a lead's detail page shows up in both places from one write.

---

## 5. Phone OTP verification + registration flow

```mermaid
sequenceDiagram
    actor V as Visitor
    participant FE as Register Page
    participant API as Backend
    participant Twilio
    participant DB as MongoDB (Otp)

    V->>FE: Enters phone number
    FE->>API: POST /api/auth/send-otp
    API->>DB: store hashed 6-digit code (5 min TTL)
    API->>Twilio: send SMS
    alt Twilio succeeds
        Twilio-->>V: SMS with code
    else Twilio fails / not configured
        API-->>FE: devCode returned directly (dev fallback only)
    end
    V->>FE: types code into OtpBoxes (auto-advance + paste support)
    FE->>API: POST /api/auth/verify-otp
    API->>DB: compare hash, mark verified (15 min window)
    API-->>FE: verified: true
    FE->>FE: animated checkmark reveal ("Verified!")
    V->>FE: completes name / email / password
    FE->>API: POST /api/auth/register (or register-admin / register-service)
    API->>DB: create User, delete the spent Otp
    API-->>FE: JWT + user
    FE->>FE: store token, redirect to the role's dashboard
```

Every email/phone input site-wide (this form, Login, Profile, Contact,
Admin's Add User) now also gets live client-side format validation — a red
warning icon while the value doesn't match the expected shape, a green
check once it does (`ValidatedInput.jsx` + `utils/validators.js`, the
phone regex mirroring the backend's own `normalizePhone`). This is UX
feedback only; the backend independently re-validates on every write.

---

## 6. Payment → Invoice → Refund flow

```mermaid
sequenceDiagram
    actor C as Client
    participant FE as Client Dashboard
    participant API as paymentRoutes.js
    participant RZP as Razorpay
    participant DB as MongoDB (Order)
    participant Mail as sendEmail

    C->>FE: Requests a project (service + custom amount)
    FE->>API: POST /payments/create-order
    API->>API: Enforce price floor —<br/>amount >= Pricing.basePrice - 5000
    API->>RZP: orders.create()
    RZP-->>API: razorpay order id
    API->>DB: Order { paymentStatus: "unpaid" }
    C->>RZP: Completes checkout (Razorpay widget)
    FE->>API: POST /payments/verify (signature)
    API->>DB: Order { paymentStatus: "paid" }
    API-->>Mail: payment confirmation email

    Note over C,DB: Self-cancellation window — 48h from request
    C->>FE: Cancel project
    FE->>API: PATCH /payments/orders/:id/cancel
    alt order is paid
        API->>RZP: payments.refund(paymentId, amount)
        alt refund API call succeeds
            RZP-->>API: refund id
            API->>DB: Order { paymentStatus: "refunded", refundId, refundedAt }
            API-->>Mail: refund confirmation email
        else refund API call fails
            API-->>FE: 502 — order left COMPLETELY unchanged
            Note over API,DB: fail-safe: never mark "cancelled"<br/>on a refund promise that didn't actually succeed
        end
    else order was never paid
        API->>DB: Order { status: "cancelled" }
    end

    C->>FE: Download invoice / payment details
    FE->>API: GET /payments/orders/:id/invoice (blob, JWT header)
    API->>API: generateInvoicePdf() — PDFKit, streamed directly to the response
    API-->>FE: application/pdf
    Note over FE: axios responseType:"blob" + createObjectURL —<br/>a plain &lt;a href&gt; can't carry the Authorization header
```

The invoice PDF includes a refund note section when
`paymentStatus === "refunded"`. PDFKit's standard fonts have no ₹ (U+20B9)
glyph, so amounts render as `Rs. 25,000` rather than the rupee symbol —
a font limitation, not a bug.

---

## Key architectural decisions worth remembering

- **Security enforced server-side only.** `ProtectedRoute` on the frontend
  is UX convenience; every backend route independently re-verifies the JWT
  and role via `protect`/`authorize`.
- **AI features are grounded, not freeform.** Givi (chat), the Service
  Dashboard's outreach drafts, and the AI Lead Finder's email/proposal
  generation all pull live data from MongoDB (pricing/portfolio/founders)
  into the prompt context via one shared `buildServiceContext()` helper,
  rather than letting the model invent facts — or drift between three
  separate copies of "what services do we offer."
- **Two independent logging layers.** `morgan` (raw HTTP) and
  `activityLogger` (semantic audit trail) are separate, composable
  middleware — one is infra-level, the other is business-level.
- **Security controls are detection-driven, not just preventive.** Rate
  limits, brute-force lockout, and content screening all feed one
  `SecurityEvent` log; `registerViolation()` correlates violations *across*
  endpoints per IP, not just per-route.
- **Fail-safe over fail-silent for money.** The refund flow never marks an
  order "cancelled"/"refunded" unless Razorpay's refund call actually
  succeeded — a failed API call leaves the order's state untouched and
  surfaces a clear error, instead of silently promising a refund that
  didn't happen.
- **Price floor is enforced where the money moves, not just in the UI.**
  The client dashboard's request-project form mirrors the ₹5,000-below-
  `basePrice` floor for UX, but `POST /payments/create-order` re-derives
  and enforces it server-side independently — the frontend check is
  convenience, not the boundary.
- **New data-gathering features are scoped to what's actually legal to
  automate.** The AI Business Lead Finder discovers businesses via
  Google's official Places API (paid, ToS-compliant) rather than scraping
  Google Maps/Justdial; the New Business Monitor (company-registry
  leads) is CSV-import/manual-entry only, since India's MCA registry has
  no free bulk API and scraping it isn't ToS-compliant either. Both facts
  are surfaced directly in the admin UI's own copy, not hidden.
- **Theme system is CSS-variable-driven.** Almost everything adapts to
  light/dark automatically via `var(--lavender)`, `var(--surface)`, etc.
  Only real WebGL/Canvas scenes (`HeroScene`, `LoadingScreen`) need an
  explicit per-theme JS color palette, since Three.js materials require
  literal hex values.
