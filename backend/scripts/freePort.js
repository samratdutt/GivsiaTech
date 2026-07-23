import dotenv from "dotenv";
import kill from "kill-port";

dotenv.config();

// Runs automatically before `npm run dev`/`npm start` (see predev/prestart
// in package.json) — a previous run of this same backend (a crashed
// nodemon child, an orphaned background instance, a leftover test process)
// is by far the most common thing squatting on this port during local dev,
// so clearing it unconditionally before every start means EADDRINUSE never
// gets a chance to happen. No-ops silently if the port was already free.
const port = Number(process.env.PORT) || 5000;

try {
  await kill(port, "tcp");
  console.log(`[freePort] Cleared anything that was on port ${port}`);
} catch {
  console.log(`[freePort] Port ${port} was already free`);
}
