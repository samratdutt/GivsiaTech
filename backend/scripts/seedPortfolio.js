// Usage: npm run seed:portfolio
// Seeds the original 3 portfolio items if the collection is empty. Safe to
// run more than once — it no-ops if any portfolio items already exist.
import dotenv from "dotenv";
import mongoose from "mongoose";
import Portfolio from "../models/Portfolio.js";

dotenv.config();

const defaultItems = [
  {
    title: "GIVSIA",
    tag: "E-commerce",
    desc: "Full-stack e-commerce platform — Django/DRF backend, React + Vite + TypeScript frontend, Razorpay payments with webhook handling, JWT auth with phone/OTP registration.",
    stack: "Django, React, TypeScript, Razorpay",
    order: 0,
  },
  {
    title: "GivsiaTech",
    tag: "SaaS",
    desc: "This platform — a marketing site with three role-based dashboards, JWT auth, Razorpay billing, and an AI chatbot wired into the Gemini API.",
    stack: "React, Node.js, MongoDB, Gemini API",
    order: 1,
  },
  {
    title: "AI Automation Engine",
    tag: "Coming soon",
    desc: "A client workflow-automation build is in progress. Case study goes up once it ships.",
    stack: "In development",
    order: 2,
  },
];

async function run() {
  await mongoose.connect(process.env.MONGO_URI);

  const existing = await Portfolio.countDocuments();
  if (existing > 0) {
    console.log(`Portfolio collection already has ${existing} item(s) — skipping seed.`);
  } else {
    await Portfolio.insertMany(defaultItems);
    console.log(`Seeded ${defaultItems.length} portfolio items.`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("Seed portfolio failed:", err.message);
  process.exit(1);
});
