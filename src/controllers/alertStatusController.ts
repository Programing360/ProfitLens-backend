import type { Response } from "express";
import mongoose from "mongoose";

import type { AuthenticatedRequest } from "../middlewares/authenticate";
import { Alert, type LeakAlertStatus } from "../models/Alert";

const ALLOWED_STATUSES: LeakAlertStatus[] = ["ACKNOWLEDGED", "RESOLVED"];

export const updateAlertStatus = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const user = req.user;
    const businessId = user?.businessId;
    const { alertId } = req.params;
    const { status } = req.body as { status?: string };

    if (!user || !businessId) {
      res.status(403).json({
        success: false,
        message: "Business access is required.",
      });
      return;
    }

    if (!mongoose.isValidObjectId(alertId)) {
      res.status(400).json({
        success: false,
        message: "Invalid alert ID.",
      });
      return;
    }

    if (!status || !ALLOWED_STATUSES.includes(status as LeakAlertStatus)) {
      res.status(400).json({
        success: false,
        message: "Status must be ACKNOWLEDGED or RESOLVED.",
      });
      return;
    }

    const alert = await Alert.findOneAndUpdate(
      {
        _id: alertId,
        businessId: new mongoose.Types.ObjectId(businessId),
      },
      {
        $set: {
          status: status as LeakAlertStatus,
        },
      },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!alert) {
      res.status(404).json({
        success: false,
        message: "Alert not found for this business.",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Alert status updated successfully.",
      data: alert,
    });
  } catch (error) {
    console.error("Update alert status error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update alert status.",
    });
  }
};
