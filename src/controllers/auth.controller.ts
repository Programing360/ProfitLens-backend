import { type Request, type Response } from "express";

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

import { User } from "../models/User";
import { Business } from "../models/Business";

const createToken = (userId: string): string => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured.");
  }

  return jwt.sign({ userId }, secret, {
    algorithm: "HS256",
    expiresIn: "1d",
  });
};

// REGISTER
export const register = async (req: Request, res: Response): Promise<void> => {
  let createdUserId: mongoose.Types.ObjectId | null = null;

  try {
    const { name, email, password, businessName } = req.body;

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      typeof businessName !== "string"
    ) {
      res.status(400).json({
        success: false,
        message: "Name, email, password, and business name are required.",
      });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (
      !name.trim() ||
      !businessName.trim() ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    ) {
      res.status(400).json({
        success: false,
        message: "Please provide valid registration details.",
      });
      return;
    }

    if (password.length < 12 || Buffer.byteLength(password, "utf8") > 72) {
      res.status(400).json({
        success: false,
        message:
          "Password must be at least 12 characters and no more than 72 UTF-8 bytes.",
      });
      return;
    }

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
    });

    createdUserId = user._id;

    const business = await Business.create({
      name: businessName.trim(),
      ownerId: user._id,
    });

    user.businessId = business._id;
    await user.save();

    const token = createToken(user._id.toString());

    res.status(201).json({
      success: true,
      message: "Account created successfully.",
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        businessId: business._id.toString(),
      },
    });
  } catch (error: unknown) {
    // Remove a partially created account if business
    // creation or the remaining registration steps fail.
    if (createdUserId) {
      try {
        await Business.deleteOne({
          ownerId: createdUserId,
        });

        await User.deleteOne({
          _id: createdUserId,
        });
      } catch (cleanupError) {
        console.error("Registration cleanup failed:", cleanupError);
      }
    }

    if (error instanceof mongoose.Error && error.name === "ValidationError") {
      res.status(400).json({
        success: false,
        message: "Registration details are invalid.",
      });
      return;
    }

    if (
      error instanceof mongoose.mongo.MongoServerError &&
      error.code === 11000
    ) {
      res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
      return;
    }

    console.error("Registration failed:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create account.",
    });
  }
};

// LOGIN
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({
      email: normalizedEmail,
    }).select("+passwordHash");

    if (!user) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
      return;
    }

    const token = createToken(user._id.toString());

    res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        businessId: user.businessId?.toString() ?? null,
      },
    });
  } catch (error: unknown) {
    console.error("Login failed:", error);

    res.status(500).json({
      success: false,
      message: "Failed to log in.",
    });
  }
};
