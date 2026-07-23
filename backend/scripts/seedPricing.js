// Usage: npm run seed:pricing
// Seeds the original 4 pricing tiers if the collection is empty. Safe to
// run more than once — it no-ops if any pricing tiers already exist.
import dotenv from "dotenv";
import mongoose from "mongoose";
import Pricing from "../models/Pricing.js";

dotenv.config();

const defaultTiers = [
  {
    name: "Website",
    price: "From ₹25,000",
    basePrice: 25000,
    serviceKey: "website",
    desc: "A production-ready marketing site or web app.",
    features: ["React/Vite or Next.js frontend", "API + database backend", "Deployment included", "2 weeks of post-launch support", "Rate limiting & brute-force login protection built in"],
    order: 0,
  },
  {
    name: "AI Automation",
    price: "From ₹40,000",
    basePrice: 40000,
    serviceKey: "ai-automation",
    desc: "Custom AI agents wired into your workflow.",
    features: ["Chatbot or workflow agent", "Integration with your existing tools", "Claude/GPT API setup", "Usage monitoring dashboard", "AI-assisted spam & prompt-injection screening"],
    featured: true,
    order: 1,
  },
  {
    name: "SaaS Platform",
    price: "From ₹80,000",
    basePrice: 80000,
    serviceKey: "saas",
    desc: "Multi-tenant product with billing and roles.",
    features: ["Role-based dashboards", "Subscription billing (Razorpay/Stripe)", "Admin + analytics tooling", "Ongoing dev retainer available", "Security event logging & automatic IP blocking"],
    order: 2,
  },
  {
    name: "App Development",
    price: "From ₹45,000",
    basePrice: 45000,
    serviceKey: "app-development",
    desc: "A native or cross-platform mobile app for iOS and Android.",
    features: ["React Native cross-platform build", "Wired into the same backend/API as your web product", "App Store & Play Store submission", "Push notifications & offline support"],
    order: 3,
  },
];

async function run() {
  await mongoose.connect(process.env.MONGO_URI);

  const existing = await Pricing.countDocuments();
  if (existing > 0) {
    console.log(`Pricing collection already has ${existing} tier(s) — skipping seed.`);
  } else {
    await Pricing.insertMany(defaultTiers);
    console.log(`Seeded ${defaultTiers.length} pricing tiers.`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("Seed pricing failed:", err.message);
  process.exit(1);
});
