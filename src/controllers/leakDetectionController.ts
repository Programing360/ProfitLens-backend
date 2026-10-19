import { type Response } from "express";
import type { AuthenticatedRequest } from "../middlewares/authenticate";
import { Product } from "../models/Product";
import { Sale } from "../models/Sales";
import { Business } from "../models/Business";
import { Alert } from "../models/Alert";
import mongoose from "mongoose";

type LeakIssueType = "LOW_MARGIN" | "SLOW_MOVING_INVENTORY";

type LeakSeverity = "HIGH" | "MEDIUM" | "LOW";

interface ILeakAlert {
  productId: string;
  productName: string;
  issueType: LeakIssueType;
  severity: LeakSeverity;
  message: string;

  evidence: {
    metric: string;
    actualValue: number;
    threshold: number;
    unit: string;
  };

  suggestedAction: string;
}

interface ISalesSummary {
  _id: mongoose.Types.ObjectId;
  totalSold: number;
  totalRevenue: number;
  totalProductCost: number;
  totalPackagingCost: number;
  totalDeliveryCost: number;
  totalPaymentFee: number;
  totalOtherVariableCosts: number;
  salesCount: number;
  salesWithoutHistoricalCost: number;
}

export const detectBusinessLeaks = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    // 1. Validate authenticated user and business ID.
    const user = req.user;
    const businessId = user?.businessId;

    if (!user || !businessId) {
      res.status(403).json({
        success: false,
        message: "No business is associated with this account.",
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

    const businessObjectId = new mongoose.Types.ObjectId(businessId);

    // 2. Verify business ownership.
    const business = await Business.findOne({
      _id: businessObjectId,
      ownerId: user.id,
    });

    if (!business) {
      res.status(404).json({
        success: false,
        message: "Business not found or access denied.",
      });
      return;
    }

    const {
      lowMarginThreshold,
      slowMovingDays,
      minimumStockForSlowMoving,
      maximumSalesForSlowMoving,
    } = business.settings;

    // 3. Define analysis period.
    const endDate = new Date();
    const startDate = new Date(endDate);

    startDate.setDate(startDate.getDate() - 30);

    // 4. Fetch business products.
    const products = await Product.find({
      businessId: businessObjectId,
    }).lean();

    // 5. Aggregate sales from the last 30 days.
    const salesSummary: ISalesSummary[] = await Sale.aggregate([
      {
        $match: {
          businessId: businessObjectId,
          saleDate: {
            $gte: startDate,
            $lt: endDate,
          },
        },
      },
      {
        $group: {
          _id: "$productId",

          totalSold: {
            $sum: "$quantitySold",
          },

          totalRevenue: {
            $sum: "$totalRevenue",
          },

          totalProductCost: {
            $sum: {
              $cond: [
                { $isNumber: "$unitCostAtSale" },
                {
                  $multiply: ["$quantitySold", "$unitCostAtSale"],
                },
                0,
              ],
            },
          },

          totalPackagingCost: {
            $sum: "$packagingCost",
          },

          totalDeliveryCost: {
            $sum: "$deliveryCost",
          },

          totalPaymentFee: {
            $sum: "$paymentFee",
          },

          totalOtherVariableCosts: {
            $sum: "$otherVariableCosts",
          },

          salesCount: {
            $sum: 1,
          },

          salesWithoutHistoricalCost: {
            $sum: {
              $cond: [{ $isNumber: "$unitCostAtSale" }, 0, 1],
            },
          },
        },
      },
    ]);

    // 6. Create sales lookup map.
    const salesMap = new Map<string, ISalesSummary>();

    for (const sale of salesSummary) {
      salesMap.set(sale._id.toString(), sale);
    }

    // 7. Detect potential business leaks.
    const detectedAlerts: ILeakAlert[] = [];

    const now = Date.now();
    const millisecondsPerDay = 1000 * 60 * 60 * 24;

    for (const product of products) {
      const productId = product._id.toString();

      const salesData = salesMap.get(productId);

      const totalSold = salesData?.totalSold ?? 0;
      const totalRevenue = salesData?.totalRevenue ?? 0;
      const totalProductCost = salesData?.totalProductCost ?? 0;

      const totalPackagingCost = salesData?.totalPackagingCost ?? 0;

      const totalDeliveryCost = salesData?.totalDeliveryCost ?? 0;

      const totalPaymentFee = salesData?.totalPaymentFee ?? 0;

      const totalOtherVariableCosts = salesData?.totalOtherVariableCosts ?? 0;

      const salesCount = salesData?.salesCount ?? 0;

      const salesWithoutHistoricalCost =
        salesData?.salesWithoutHistoricalCost ?? 0;

      const productAgeInDays =
        (now - new Date(product.createdAt).getTime()) / millisecondsPerDay;

      // RULE 1: Low contribution margin.
      if (
        totalRevenue > 0 &&
        salesCount > 0 &&
        salesWithoutHistoricalCost === 0
      ) {
        const grossProfit = totalRevenue - totalProductCost;

        const totalVariableCosts =
          totalPackagingCost +
          totalDeliveryCost +
          totalPaymentFee +
          totalOtherVariableCosts;

        const contributionProfit = grossProfit - totalVariableCosts;

        const contributionMargin = (contributionProfit / totalRevenue) * 100;

        if (contributionMargin < lowMarginThreshold) {
          detectedAlerts.push({
            productId,
            productName: product.name,
            issueType: "LOW_MARGIN",

            severity: contributionMargin < 5 ? "HIGH" : "MEDIUM",

            message:
              `Product '${product.name}' has a contribution margin of ` +
              `${contributionMargin.toFixed(1)}% over the last 30 days.`,

            evidence: {
              metric: "contributionMargin",
              actualValue: Number(contributionMargin.toFixed(2)),
              threshold: lowMarginThreshold,
              unit: "%",
            },

            suggestedAction:
              "Review historical product costs, selling prices, discounts, and direct expenses.",
          });
        }
      }

      // RULE 2: Slow-moving inventory.
      if (
        productAgeInDays >= slowMovingDays &&
        product.stockQuantity > minimumStockForSlowMoving &&
        totalSold <= maximumSalesForSlowMoving
      ) {
        detectedAlerts.push({
          productId,
          productName: product.name,
          issueType: "SLOW_MOVING_INVENTORY",

          severity: product.stockQuantity > 50 ? "HIGH" : "MEDIUM",

          message:
            `Product '${product.name}' has ` +
            `${product.stockQuantity} units in stock, ` +
            `but only ${totalSold} units sold in the last 30 days.`,

          evidence: {
            metric: "unitsSold30Days",
            actualValue: totalSold,
            threshold: maximumSalesForSlowMoving,
            unit: "units sold in 30 days",
          },

          suggestedAction:
            "Review demand, purchasing plans, and inventory levels.",
        });
      }
    }

    // 8. Persist detected alerts.
    const savedAlerts = [];

    for (const detectedAlert of detectedAlerts) {
      const productObjectId = new mongoose.Types.ObjectId(
        detectedAlert.productId,
      );

      // Find an existing unresolved alert for this product and issue.
      const existingAlert = await Alert.findOne({
        businessId: businessObjectId,
        productId: productObjectId,
        issueType: detectedAlert.issueType,
        status: { $in: ["OPEN", "ACKNOWLEDGED"] },
      });

      let savedAlert;

      if (existingAlert) {
        // Update the existing alert without resetting its status.
        existingAlert.productName = detectedAlert.productName;
        existingAlert.severity = detectedAlert.severity;
        existingAlert.message = detectedAlert.message;
        existingAlert.evidence = detectedAlert.evidence;
        existingAlert.suggestedAction = detectedAlert.suggestedAction;

        savedAlert = await existingAlert.save();
      } else {
        // No unresolved alert exists, so create a new one.
        savedAlert = await Alert.create({
          businessId: businessObjectId,
          productId: productObjectId,
          productName: detectedAlert.productName,
          issueType: detectedAlert.issueType,
          severity: detectedAlert.severity,
          message: detectedAlert.message,
          evidence: detectedAlert.evidence,
          suggestedAction: detectedAlert.suggestedAction,
          status: "OPEN",
        });
      }

      savedAlerts.push(savedAlert);
    }

    // 9. Return saved alerts, including MongoDB-generated _id.
    res.status(200).json({
      success: true,

      period: {
        startDate,
        endDate,
      },

      totalAlerts: savedAlerts.length,

      summary: {
        high: savedAlerts.filter((alert) => alert.severity === "HIGH").length,

        medium: savedAlerts.filter((alert) => alert.severity === "MEDIUM")
          .length,

        low: savedAlerts.filter((alert) => alert.severity === "LOW").length,
      },

      alerts: savedAlerts,
    });
  } catch (error: unknown) {
    console.error("Business leak detection failed:", error);

    res.status(500).json({
      success: false,
      message: "Failed to analyze business data.",
    });
  }
};
