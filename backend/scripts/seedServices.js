// Usage: npm run seed:services
// Seeds the original 4 services if the collection is empty. Safe to run
// more than once — it no-ops if any services already exist.
import dotenv from "dotenv";
import mongoose from "mongoose";
import Service from "../models/Service.js";

dotenv.config();

// `key` on the first 4 matches the serviceKey values seedPricing.js already
// links its tiers to (see backend/models/Pricing.js) — keep them as-is so
// existing tier links keep resolving; only new services get an
// auto-generated key (see serviceRoutes.js's generateKey).
const defaultServices = [
  {
    tag: "Build",
    title: "Production Websites",
    key: "website",
    copy: "Full-stack web apps and marketing sites — React/Vite frontends, Node/Express or Django backends, shipped fast and built to scale.",
    order: 0,
  },
  {
    tag: "Automate",
    title: "AI Automation",
    key: "ai-automation",
    copy: "Custom AI agents, chatbots, and workflow automation wired into your existing tools — cutting manual work out of your operations.",
    order: 1,
  },
  {
    tag: "Scale",
    title: "SaaS Platforms",
    key: "saas",
    copy: "Role-based dashboards, subscription billing, and multi-tenant architecture — the full backend a growing product needs.",
    order: 2,
  },
  {
    tag: "Mobile",
    title: "App Development",
    key: "app-development",
    copy: "Native and cross-platform mobile apps for iOS and Android, wired into the same backend and APIs as your web product.",
    order: 3,
  },
];

async function run() {
  await mongoose.connect(process.env.MONGO_URI);

  const existing = await Service.countDocuments();
  if (existing > 0) {
    console.log(`Services collection already has ${existing} service(s) — skipping seed.`);
  } else {
    await Service.insertMany(defaultServices);
    console.log(`Seeded ${defaultServices.length} services.`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("Seed services failed:", err.message);
  process.exit(1);
});
