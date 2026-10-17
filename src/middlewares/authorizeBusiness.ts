import { type Response, type NextFunction } from "express";

import mongoose from "mongoose";

import { Business } from "../models/Business";
import type { AuthenticatedRequest } from "./authenticate";

export const authorizeBusiness = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // 1. Get authenticated user
    const user = req.user;

    if (!user) {
      res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
      return;
    }

    // 2. Validate business ID
    if (!user.businessId || !mongoose.isValidObjectId(user.businessId)) {
      res.status(403).json({
        success: false,
        message: "No business is associated with this account.",
      });
      return;
    }

    // 3. Verify business ownership
    const business = await Business.findOne({
      _id: user.businessId,
      ownerId: user.id,
    })
      .select("_id")
      .lean();

    if (!business) {
      res.status(403).json({
        success: false,
        message: "You are not authorized to access this business.",
      });
      return;
    }

    // 4. Continue if authorized
    next();
  } catch (error: unknown) {
    console.error("Business authorization failed:", error);

    res.status(500).json({
      success: false,
      message: "Failed to verify business access.",
    });
  }
};
