// Usage: npm run seed:founders
// Links a Founder document to each co-founder's existing User account by
// email. Safe to run more than once — updates in place rather than
// duplicating. Social links are deliberately left blank: each founder
// fills in their own via the "Founder profile" editor in their dashboard.
import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "../models/User.js";
import Founder from "../models/Founder.js";

dotenv.config();

const founders = [
  {
    email: "duttasamrat018@gmail.com",
    degree: "B.Tech in Electronics & Communication Engineering (ECE)",
    role: "System Engineer at TCS",
    expertise: ["MERN Web Development", "App Development", "AI/ML", "GenAI", "Agentic AI"],
    quote: "Great software isn't just shipped — it's engineered to last. I bring enterprise-grade rigor to every AI agent and web product I build.",
    order: 0,
  },
  {
    email: "tanmoybera9330315363@gmail.com",
    degree: "B.Tech in Electronics & Communication Engineering (ECE)",
    role: "GATE 2026 DA (Data Science & AI) Qualified",
    expertise: ["MERN Web Development", "App Development", "AI/ML", "Agentic AI", "GenAI"],
    quote: "Strong fundamentals make strong products. I pair deep AI theory with hands-on engineering to build systems that actually hold up in production.",
    order: 1,
  },
];

async function run() {
  await mongoose.connect(process.env.MONGO_URI);

  for (const f of founders) {
    const user = await User.findOne({ email: f.email });
    if (!user) {
      console.error(`No user account found for ${f.email} — skipping. Create the account first.`);
      continue;
    }

    await Founder.findOneAndUpdate(
      { user: user._id },
      {
        user: user._id,
        name: user.name,
        degree: f.degree,
        role: f.role,
        expertise: f.expertise,
        quote: f.quote,
        email: f.email,
        order: f.order,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log(`Founder profile ready for ${user.name} (${f.email})`);
  }

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("Seed founders failed:", err.message);
  process.exit(1);
});
