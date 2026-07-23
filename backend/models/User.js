import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Google-authenticated accounts have no password of their own — Google
    // already verified identity, so this is only required for manual signup.
    password: {
      type: String,
      required: function () { return !this.googleId; },
      minlength: 6,
      select: false,
    },
    googleId: { type: String, unique: true, sparse: true },
    phone: { type: String, required: true, unique: true, trim: true },
    phoneVerified: { type: Boolean, default: false },
    address: { type: String, trim: true },
    role: {
      type: String,
      enum: ["admin", "client", "service"],
      default: "client",
    },
    company: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    // Brute-force lockout — see utils/security.js recordFailedLogin/
    // recordSuccessfulLogin. Not exposed via toSafeObject().
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date },
    // Bumped on logout and on password change — embedded in every JWT at
    // sign time, compared against the live value on every request (see
    // middleware/auth.js). This is what makes "logout" actually invalidate
    // the token server-side instead of only forgetting it client-side, and
    // makes a password change kill every other outstanding session too.
    tokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  if (!this.password) return Promise.resolve(false); // Google-only account, no password set
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toSafeObject = function () {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    phone: this.phone,
    phoneVerified: this.phoneVerified,
    address: this.address,
    role: this.role,
    company: this.company,
  };
};

export default mongoose.model("User", userSchema);
