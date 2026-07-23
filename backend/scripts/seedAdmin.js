// Usage: npm run seed:admin
// Reads ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME from .env and either
// creates a new admin account or promotes an existing user with that
// email to the admin role. Safe to run more than once.
import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "../models/User.js";

dotenv.config();

async function run() {
  const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME, ADMIN_PHONE, ADMIN_ADDRESS, MONGO_URI } = process.env;

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error("Set ADMIN_EMAIL and ADMIN_PASSWORD in backend/.env before running this script.");
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);

  let user = await User.findOne({ email: ADMIN_EMAIL.toLowerCase() });

  if (user) {
    user.role = "admin";
    user.isActive = true;
    if (ADMIN_PHONE && !user.phone) user.phone = ADMIN_PHONE;
    if (ADMIN_ADDRESS && !user.address) user.address = ADMIN_ADDRESS;
    await user.save();
    console.log(`Existing user ${ADMIN_EMAIL} promoted to admin.`);
  } else {
    if (!ADMIN_PHONE) {
      console.error("Set ADMIN_PHONE in backend/.env before running this script (phone is now required).");
      process.exit(1);
    }
    user = await User.create({
      name: ADMIN_NAME || "Admin",
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      phone: ADMIN_PHONE,
      phoneVerified: true,
      address: ADMIN_ADDRESS,
      role: "admin",
    });
    console.log(`Admin account created: ${ADMIN_EMAIL}`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("Seed admin failed:", err.message);
  process.exit(1);
});
