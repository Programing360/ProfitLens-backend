import type { Response } from "express";
import type { AuthenticatedRequest } from "../middlewares/authenticate";
import { Business } from "../models/Business";

const DEFAULT_SETTINGS = {
  lowMarginThreshold: 15,
  slowMovingDays: 30,
  minimumStockForSlowMoving: 30,
  maximumSalesForSlowMoving: 5,
  lowStockThreshold: 10,
  currency: "BDT",
} as const;

const ALLOWED_FIELDS = [
  "lowMarginThreshold",
  "slowMovingDays",
  "minimumStockForSlowMoving",
  "maximumSalesForSlowMoving",
  "lowStockThreshold",
  "currency",
] as const;

type SettingsField = (typeof ALLOWED_FIELDS)[number];

const isValidNumber = (
  value: unknown,
  min: number,
  max?: number,
): value is number => {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= min &&
    (max === undefined || value <= max)
  );
};

const getBusiness = async (req: AuthenticatedRequest) => {
  const user = req.user;

  if (!user?.id || !user.businessId) {
    return null;
  }

  return Business.findOne({
    _id: user.businessId,
    ownerId: user.id,
  });
};

// GET /api/business/settings
export const getBusinessSettings = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const business = await getBusiness(req);

    if (!business) {
      res.status(404).json({
        success: false,
        message: "Business not found or access denied.",
      });
      return;
    }

    const settings = {
      ...DEFAULT_SETTINGS,
      ...business.settings,
    };

    res.status(200).json({
      success: true,
      data: {
        businessName: business.name,
        settings,
      },
    });
  } catch (error: unknown) {
    console.error("Get business settings error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to retrieve business settings.",
    });
  }
};

// PATCH /api/business/settings
export const updateBusinessSettings = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const business = await getBusiness(req);

    if (!business) {
      res.status(404).json({
        success: false,
        message: "Business not found or access denied.",
      });
      return;
    }

    const body: unknown = req.body;

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      res.status(400).json({
        success: false,
        message: "Request body must be an object.",
      });
      return;
    }

    const input = body as Record<string, unknown>;
    const inputFields = Object.keys(input);

    if (inputFields.length === 0) {
      res.status(400).json({
        success: false,
        message: "Provide at least one setting to update.",
      });
      return;
    }

    const invalidFields = inputFields.filter(
      (field) => !ALLOWED_FIELDS.includes(field as SettingsField),
    );

    if (invalidFields.length > 0) {
      res.status(400).json({
        success: false,
        message: "Unknown settings fields provided.",
        fields: invalidFields,
      });
      return;
    }

    const errors: Record<string, string> = {};

    for (const [field, value] of Object.entries(input)) {
      switch (field) {
        case "lowMarginThreshold":
          if (!isValidNumber(value, 0, 100)) {
            errors[field] = "Must be a number between 0 and 100.";
          }
          break;

        case "slowMovingDays":
          if (!isValidNumber(value, 1, 365) || !Number.isInteger(value)) {
            errors[field] = "Must be an integer between 1 and 365.";
          }
          break;

        case "minimumStockForSlowMoving":
        case "maximumSalesForSlowMoving":
        case "lowStockThreshold":
          if (!isValidNumber(value, 0) || !Number.isInteger(value)) {
            errors[field] = "Must be a non-negative integer.";
          }
          break;

        case "currency":
          if (
            typeof value !== "string" ||
            !["BDT", "USD", "EUR", "GBP", "INR"].includes(value)
          ) {
            errors[field] = "Unsupported currency.";
          }
          break;
      }
    }

    if (Object.keys(errors).length > 0) {
      res.status(400).json({
        success: false,
        message: "Invalid settings provided.",
        errors,
      });
      return;
    }

    for (const [field, value] of Object.entries(input)) {
      business.set(`settings.${field}`, value);
    }

    await business.save();

    res.status(200).json({
      success: true,
      message: "Business settings updated successfully.",
      data: {
        businessName: business.name,
        settings: {
          ...DEFAULT_SETTINGS,
          ...business.settings,
        },
      },
    });
  } catch (error: unknown) {
    console.error("Update business settings error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update business settings.",
    });
  }
};
