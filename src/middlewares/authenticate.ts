import { type Request, type Response, type NextFunction } from "express";

import jwt from "jsonwebtoken";
import mongoose from "mongoose";

import { User } from "../models/User";

interface TokenPayload extends jwt.JwtPayload {
  userId: string;
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    businessId: string | null;
  };
}

export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // 1. Extract Authorization header
    const authorization = req.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        message: "Authentication token is required.",
      });
      return;
    }

    // 2. Extract token
    const token = authorization.slice(7);

    // 3. Get JWT secret
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      console.error("JWT_SECRET is not configured.");

      res.status(500).json({
        success: false,
        message: "Authentication service is unavailable.",
      });
      return;
    }

    // 4. Verify token
    const decoded = jwt.verify(token, secret, {
      algorithms: ["HS256"],
    });

    // 5. Validate decoded payload
    if (
      typeof decoded === "string" ||
      typeof decoded.userId !== "string" ||
      !mongoose.isValidObjectId(decoded.userId)
    ) {
      res.status(401).json({
        success: false,
        message: "Invalid authentication token.",
      });
      return;
    }

    const payload = decoded as TokenPayload;

    // 6. Find user in database
    const user = await User.findById(payload.userId)
      .select("_id businessId")
      .lean();

    if (!user) {
      res.status(401).json({
        success: false,
        message: "User account was not found.",
      });
      return;
    }

    // 7. Attach authenticated user to request
    req.user = {
      id: user._id.toString(),
      businessId: user.businessId?.toString() ?? null,
    };

    // 8. Continue to the next middleware
    next();
  } catch (error: unknown) {
    if (
      error instanceof jwt.JsonWebTokenError ||
      error instanceof jwt.TokenExpiredError ||
      error instanceof jwt.NotBeforeError
    ) {
      res.status(401).json({
        success: false,
        message: "Invalid or expired authentication token.",
      });
      return;
    }

    console.error("Authentication failed:", error);

    res.status(500).json({
      success: false,
      message: "Failed to authenticate request.",
    });
  }
};
