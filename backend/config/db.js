import mongoose from "mongoose";

const MAX_RETRY_DELAY_MS = 30000;

// Retries with backoff instead of exiting the process, so a transient
// network blip (DNS hiccup, ISP throttling, Atlas maintenance) doesn't take
// the whole API down — it just keeps trying until the cluster is reachable.
export const connectDB = async () => {
  let attempt = 0;

  while (true) {
    try {
      const conn = await mongoose.connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 15000,
      });
      console.log(`MongoDB connected: ${conn.connection.host}`);
      return conn;
    } catch (err) {
      attempt += 1;
      const delay = Math.min(1000 * 2 ** attempt, MAX_RETRY_DELAY_MS);
      console.error(`MongoDB connection failed (attempt ${attempt}): ${err.message}`);
      console.error(`Retrying in ${delay / 1000}s...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

mongoose.connection.on("disconnected", () => {
  console.error("MongoDB disconnected — mongoose will attempt to reconnect automatically.");
});

mongoose.connection.on("reconnected", () => {
  console.log("MongoDB reconnected.");
});
