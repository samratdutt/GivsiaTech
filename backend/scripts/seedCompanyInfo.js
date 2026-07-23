// Usage: npm run seed:company
// Seeds the singleton CompanyInfo document if none exists yet. Safe to run
// more than once — it no-ops if a document already exists.
import dotenv from "dotenv";
import mongoose from "mongoose";
import CompanyInfo from "../models/CompanyInfo.js";

dotenv.config();

const defaultInfo = {
  heading: "A small, technical team — not an agency.",
  description:
    "GivsiaTech is the technology arm of Givsia Private Limited. We're founders and engineers who build the same production stack for clients that we use for our own products — no hand-off to a junior team, no templated builds. If we ship it, we maintain it.",
  stats: [
    { value: "5", label: "Founding team" },
    { value: "3", label: "Core service lines" },
    { value: "100%", label: "In-house build & support" },
  ],
};

async function run() {
  await mongoose.connect(process.env.MONGO_URI);

  const existing = await CompanyInfo.findOne();
  if (existing) {
    console.log("CompanyInfo document already exists — skipping seed.");
  } else {
    await CompanyInfo.create(defaultInfo);
    console.log("Seeded CompanyInfo document.");
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("Seed company info failed:", err.message);
  process.exit(1);
});
