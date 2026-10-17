import mongoose from "mongoose";

export const connectDB = async (): Promise<void> => {
  try {
    const mongoUri = process.env.MONGO_URI;

    if (!mongoUri) {
      throw new Error("MONGO_URI is not configured in .env");
    }

    const conn = await mongoose.connect(mongoUri);

    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error: unknown) {
    console.error(
      "MongoDB connection failed:",
      error instanceof Error ? error.message : error,
    );

    process.exit(1);
  }
};
