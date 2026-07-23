import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOADS_DIR = path.join(__dirname, "..", "uploads");

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export const uploadImage = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    // This only checks the Content-Type header the client sent, which is
    // trivially spoofable — real content verification happens after the
    // file lands on disk, via verifyImageSignature below.
    if (!ALLOWED_TYPES.has(file.mimetype)) {
      return cb(new Error("Only JPEG, PNG, WebP, or GIF images are allowed"));
    }
    cb(null, true);
  },
});

// Real file-type verification: reads the first bytes actually written to
// disk and checks them against each format's magic number, instead of
// trusting the client-supplied filename/MIME type. Catches the classic
// "rename a .php/.exe to .jpg" trick and any file whose content doesn't
// match what it claims to be. This is signature verification, not virus
// scanning — a real malware/AV scan would need an external engine (e.g. a
// ClamAV daemon) wired in as a further layer; see docs/DEVELOPMENT_LOG.html
// for that as a documented next step rather than something faked here.
const SIGNATURES = [
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { mime: "image/gif", bytes: [0x47, 0x49, 0x46, 0x38] }, // "GIF8"
];

function matchesSignature(header, bytes) {
  return bytes.every((b, i) => header[i] === b);
}

export function verifyImageSignature(filePath) {
  const fd = fs.openSync(filePath, "r");
  const header = Buffer.alloc(16);
  fs.readSync(fd, header, 0, 16, 0);
  fs.closeSync(fd);

  if (SIGNATURES.some((sig) => matchesSignature(header, sig.bytes))) return true;

  // WEBP: "RIFF" (bytes 0-3) then "WEBP" (bytes 8-11)
  if (header.slice(0, 4).toString("ascii") === "RIFF" && header.slice(8, 12).toString("ascii") === "WEBP") return true;

  return false;
}
