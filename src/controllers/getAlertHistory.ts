import { Response } from "express";
import type { FilterQuery } from "mongoose";
import mongoose from "mongoose";

import type { AuthenticatedRequest } from "../middlewares/authenticate";
import { Alert, type ILeakAlert } from "../models/Alert";

const VALID_STATUSES = ["OPEN", "ACKNOWLEDGED", "RESOLVED"] as const;

const VALID_SEVERITIES = ["HIGH", "MEDIUM", "LOW"] as const;

export const getAlertHistory = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const user = req.user;
    const businessId = user?.businessId;

    if (!user || !businessId) {
      res.status(403).json({
        success: false,
        message: "Business access is required.",
      });
      return;
    }

    if (!mongoose.isValidObjectId(businessId)) {
      res.status(400).json({
        success: false,
        message: "Invalid business ID.",
      });
      return;
    }

    const { status, severity, search, page = "1", limit = "10" } = req.query;

    // Validate status
    if (
      status &&
      (typeof status !== "string" ||
        !VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number]))
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid status filter.",
      });
      return;
    }

    // Validate severity
    if (
      severity &&
      (typeof severity !== "string" ||
        !VALID_SEVERITIES.includes(
          severity as (typeof VALID_SEVERITIES)[number],
        ))
    ) {
      res.status(400).json({
        success: false,
        message: "Invalid severity filter.",
      });
      return;
    }

    // Validate pagination
    const currentPage = Number(page);
    const pageSize = Number(limit);

    if (
      !Number.isInteger(currentPage) ||
      !Number.isInteger(pageSize) ||
      currentPage < 1 ||
      pageSize < 1 ||
      pageSize > 100
    ) {
      res.status(400).json({
        success: false,
        message: "Page must be positive and limit must be between 1 and 100.",
      });
      return;
    }

    // Prevent excessively long search queries
    if (
      search !== undefined &&
      (typeof search !== "string" || search.trim().length > 100)
    ) {
      res.status(400).json({
        success: false,
        message: "Search must be a string of at most 100 characters.",
      });
      return;
    }

    // Every query is restricted to the authenticated user's business.
    const businessObjectId = new mongoose.Types.ObjectId(businessId);

    const filter: FilterQuery<ILeakAlert> = {
      businessId: businessObjectId,
    };

    // Optional status filter
    if (status) {
      filter.status = status as (typeof VALID_STATUSES)[number];
    }

    // Optional severity filter
    if (severity) {
      filter.severity = severity as (typeof VALID_SEVERITIES)[number];
    }

    // Escape regex special characters before searching.
    if (typeof search === "string" && search.trim()) {
      const escapedSearch = search
        .trim()
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      filter.productName = {
        $regex: escapedSearch,
        $options: "i",
      };
    }

    const skip = (currentPage - 1) * pageSize;

    // Fetch alerts and counts in parallel.
    const [alerts, totalAlerts, statusCounts] = await Promise.all([
      Alert.find(filter)
        .sort({ detectedAt: -1, _id: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean(),

      Alert.countDocuments(filter),

      Alert.aggregate([
        {
          $match: {
            businessId: businessObjectId,
          },
        },
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const counts = {
      ALL: 0,
      OPEN: 0,
      ACKNOWLEDGED: 0,
      RESOLVED: 0,
    };

    for (const item of statusCounts) {
      if (item._id in counts && item._id !== "ALL") {
        counts[item._id as keyof typeof counts] = item.count;
      }

      counts.ALL += item.count;
    }

    res.status(200).json({
      success: true,
      message: "Alert history retrieved successfully.",
      data: alerts,
      meta: {
        pagination: {
          currentPage,
          pageSize,
          totalAlerts,
          totalPages: Math.ceil(totalAlerts / pageSize),
          hasNextPage: skip + alerts.length < totalAlerts,
          hasPreviousPage: currentPage > 1,
        },
        statusCounts: counts,
        filters: {
          status: status || "ALL",
          severity: severity || "ALL",
          search: search || "",
        },
      },
    });
  } catch (error) {
    console.error("Get alert history error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve alert history.",
    });
  }
};
