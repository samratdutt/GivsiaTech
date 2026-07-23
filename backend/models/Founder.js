import mongoose from "mongoose";

// One document per founder, tied to a specific User account. There's no
// admin-facing "create a founder" endpoint — only these pre-seeded
// documents can ever be edited, and only by the account they're linked to
// (see routes/founderRoutes.js). This is what makes "only these two admins
// can edit the founders section" true: a third admin simply has no
// document matching their own user ID to edit.
const founderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    name: { type: String, required: true, trim: true },
    degree: { type: String, trim: true },
    role: { type: String, trim: true }, // job title / qualification line
    expertise: { type: [String], default: [] },
    quote: { type: String, trim: true },
    email: { type: String, trim: true },
    links: {
      facebook: { type: String, trim: true },
      instagram: { type: String, trim: true },
      linkedin: { type: String, trim: true },
      github: { type: String, trim: true },
      portfolio: { type: String, trim: true },
    },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model("Founder", founderSchema);
