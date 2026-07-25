import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import mongoSanitize from "express-mongo-sanitize";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import contactRoutes from "./routes/contactRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import pricingRoutes from "./routes/pricingRoutes.js";
import serviceRoutes from "./routes/serviceRoutes.js";
import portfolioRoutes from "./routes/portfolioRoutes.js";
import companyRoutes from "./routes/companyRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import founderRoutes from "./routes/founderRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import outreachRoutes from "./routes/outreachRoutes.js";
import activityRoutes from "./routes/activityRoutes.js";
import securityRoutes from "./routes/securityRoutes.js";
import bizLeadRoutes from "./routes/bizLeadRoutes.js";
import visitorRoutes from "./routes/visitorRoutes.js";
import { UPLOADS_DIR } from "./middleware/upload.js";
import { activityLogger } from "./middleware/activityLogger.js";
import { ipBlocklist } from "./middleware/ipBlocklist.js";

dotenv.config();

// Fail fast and loud on missing critical config, instead of limping along:
// a missing MONGO_URI means every DB call hangs/retries forever with no
// clear cause in the logs, and a missing JWT_SECRET means every single
// authenticated request quietly 401s ("token invalid") with nothing pointing
// at the real problem. Everything else (Razorpay, Gemini, Twilio, SMTP,
// Google OAuth, Google Places) already degrades gracefully per-feature when
// unset, so only these two actually belong here.
const REQUIRED_ENV_VARS = ["MONGO_URI", "JWT_SECRET"];
const missingEnvVars = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
if (missingEnvVars.length) {
  console.error(`FATAL: missing required environment variable(s): ${missingEnvVars.join(", ")}`);
  console.error("Set them in backend/.env (see .env.example) before starting the server.");
  process.exit(1);
}

const app = express();

// req.ip normally reads the direct socket address — correct when this
// container is reachable directly (the current docker-compose setup: port
// 5000 published straight to the host). If this is later put behind a
// reverse proxy or load balancer, set TRUST_PROXY=1 in .env so req.ip reads
// the real client IP from X-Forwarded-For instead of the proxy's own
// address — every IP-based control below (rate limits, the blocklist,
// brute-force logging) depends on this being accurate. Left off by default
// on purpose: blindly trusting X-Forwarded-For with no proxy in front of
// you lets a client spoof their own IP and walk straight through it.
if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);

// Logs every request to stdout (method, path, status, size, timing) — never
// the request/response body, so auth tokens/passwords/OTP codes never end
// up in logs. Mounted first so even a CORS-rejected or 404 request still
// gets a line. Plain console output is intentional: Docker's default
// logging driver captures a container's stdout/stderr automatically, so
// `docker compose logs -f backend` (or `docker logs -f <container>`) is
// already a live, per-request activity feed with no extra plumbing needed.
app.use(morgan(":date[iso] :method :url :status :res[content-length]b - :response-time ms"));

// contentSecurityPolicy is left off: this server only ever returns JSON
// (except the static /uploads images), so there's no HTML document here for
// a CSP to protect — enabling the default would just require whitelisting
// every third-party script (Razorpay, Google Identity) for no real benefit.
// crossOriginResourcePolicy is relaxed to "cross-origin" so <img> tags on
// the frontend origin can load images served from /uploads here.
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(mongoSanitize());

// In development, Vite may bind to a different port than 5173 if it's
// taken (5174, 5175, ...), so any localhost origin is allowed alongside
// the configured CLIENT_URL. In production only CLIENT_URL is allowed.
const isLocalhost = (origin) => /^http:\/\/localhost:\d+$/.test(origin);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || origin === process.env.CLIENT_URL || isLocalhost(origin)) {
        return callback(null, true);
      }
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// Blocked IPs (auto- or manually-blocked — see utils/security.js and the
// admin Security tab) get a flat 403 here, before body parsing or any
// route handler runs at all.
app.use(ipBlocklist);

// Razorpay webhook needs the raw body for signature verification,
// so it's mounted BEFORE express.json() with its own raw parser.
app.use("/api/payments/webhook", express.raw({ type: "application/json" }));
app.use(express.json());

// Who-did-what audit trail (separate from morgan's raw request log above) —
// logs a human-readable line per side-effecting request AND persists it to
// Mongo so it's queryable later, not just docker scrollback. See
// middleware/activityLogger.js for exactly what does/doesn't get logged.
app.use(activityLogger);

app.use("/uploads", express.static(UPLOADS_DIR));

app.get("/api/health", (req, res) => res.json({ status: "ok", service: "GivsiaTech API" }));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/pricing", pricingRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/portfolio", portfolioRoutes);
app.use("/api/company", companyRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/founders", founderRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/outreach", outreachRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/security", securityRoutes);
app.use("/api/bizleads", bizLeadRoutes);
app.use("/api/visitors", visitorRoutes);

app.use((req, res) => res.status(404).json({ message: "Route not found" }));

app.use((err, req, res, next) => {
  console.error(err.stack);

  if (err.name === "CastError") {
    return res.status(400).json({ message: `Invalid ${err.path}: ${err.value}` });
  }
  if (err.name === "ValidationError") {
    return res.status(400).json({ message: Object.values(err.errors).map((e) => e.message).join(", ") });
  }
  if (err.code === 11000) {
    return res.status(409).json({ message: "A record with that value already exists" });
  }
  if (err.status) {
    return res.status(err.status).json({ message: err.message });
  }

  res.status(500).json({ message: "Internal server error" });
});

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => console.log(`GivsiaTech API running on port ${PORT}`));
});
