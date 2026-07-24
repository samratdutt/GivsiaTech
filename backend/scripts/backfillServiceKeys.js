// Usage: npm run migrate:service-keys
// One-off migration for services that existed before Service.key was added
// (see serviceRoutes.js / models/Service.js) — generates a slug for any
// service missing one. Safe to run more than once: already-keyed services
// are left untouched.
import dotenv from "dotenv";
import mongoose from "mongoose";
import Service from "../models/Service.js";

dotenv.config();

function slugify(title) {
  return (
    title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "service"
  );
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI);

  const unkeyed = await Service.find({ $or: [{ key: null }, { key: { $exists: false } }, { key: "" }] });
  if (unkeyed.length === 0) {
    console.log("Every service already has a key — nothing to do.");
  } else {
    const taken = new Set((await Service.find({ key: { $nin: [null, ""] } }, "key")).map((s) => s.key));
    for (const service of unkeyed) {
      const base = slugify(service.title);
      let key = base;
      let n = 2;
      while (taken.has(key)) {
        key = `${base}-${n}`;
        n += 1;
      }
      taken.add(key);
      service.key = key;
      await service.save();
      console.log(`"${service.title}" -> ${key}`);
    }
    console.log(`Backfilled ${unkeyed.length} service key(s).`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("Backfill service keys failed:", err.message);
  process.exit(1);
});
