import mongoose from "mongoose";

import { Business } from "../models/Business";
import { Product } from "../models/Product";
import { Sale } from "../models/Sales";
import { LeakIssueType, LeakSeverity } from "../models/Alert";

export interface IDetectedLeak {
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
export interface LeakDetectionResult {
  startDate: Date;
  endDate: Date;
  alerts: IDetectedLeak[];
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

export const analyzeBusinessLeaks = async (
  businessId: string,
  userId: string,
): Promise<LeakDetectionResult> => {
  // 1. Validate user and business ID
  if (!userId || !businessId) {
    throw new Error("User ID and business ID are required.");
  }

  if (
    !mongoose.isValidObjectId(businessId) ||
    !mongoose.isValidObjectId(userId)
  ) {
    throw new Error("Invalid user ID or business ID.");
  }

  // 2. Verify business ownership and retrieve settings
  const business = await Business.findOne({
    _id: businessId,
    ownerId: userId,
  }).lean();

  if (!business) {
    throw new Error("Business not found or access denied.");
  }

  const {
    lowMarginThreshold,
    slowMovingDays,
    minimumStockForSlowMoving,
    maximumSalesForSlowMoving,
  } = business.settings;

  // 3. Define analysis period: last 30 days
  const endDate = new Date();

  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 30);

  // 4. Fetch products belonging to this business
  const products = await Product.find({
    businessId: business._id,
  }).lean();

  // 5. Aggregate sales by product
  const salesSummary: ISalesSummary[] = await Sale.aggregate([
    {
      $match: {
        businessId: business._id,
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
              {
                $isNumber: "$unitCostAtSale",
              },
              {
                $multiply: ["$quantitySold", "$unitCostAtSale"],
              },
              0,
            ],
          },
        },

        totalPackagingCost: {
          $sum: {
            $ifNull: ["$packagingCost", 0],
          },
        },

        totalDeliveryCost: {
          $sum: {
            $ifNull: ["$deliveryCost", 0],
          },
        },

        totalPaymentFee: {
          $sum: {
            $ifNull: ["$paymentFee", 0],
          },
        },

        totalOtherVariableCosts: {
          $sum: {
            $ifNull: ["$otherVariableCosts", 0],
          },
        },

        salesCount: {
          $sum: 1,
        },

        salesWithoutHistoricalCost: {
          $sum: {
            $cond: [
              {
                $isNumber: "$unitCostAtSale",
              },
              0,
              1,
            ],
          },
        },
      },
    },
  ]);

  // 6. Create sales lookup map
  const salesMap = new Map<string, ISalesSummary>();

  for (const sale of salesSummary) {
    salesMap.set(sale._id.toString(), sale);
  }

  // 7. Detect business leaks
  const alerts: IDetectedLeak[] = [];

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
      product.createdAt instanceof Date
        ? (now - product.createdAt.getTime()) / millisecondsPerDay
        : (now - new Date(product.createdAt).getTime()) / millisecondsPerDay;

    // RULE 1: Low contribution margin
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
        alerts.push({
          productId,
          productName: product.name,

          issueType: "LOW_MARGIN",

          severity: contributionMargin < 5 ? "HIGH" : "MEDIUM",

          message:
            `Product '${product.name}' has a contribution margin of ` +
            `${contributionMargin.toFixed(1)}% over the last 30 days.`,

          evidence: {
            actualValue: Number(contributionMargin.toFixed(2)),
            threshold: lowMarginThreshold,
            unit: "%",
            metric: "contributionMargin",
          },

          suggestedAction:
            "Review historical product costs, selling prices, discounts, and direct expenses.",
        });
      }
    }

    // RULE 2: Slow-moving inventory
    if (
      productAgeInDays >= slowMovingDays &&
      product.stockQuantity > minimumStockForSlowMoving &&
      totalSold <= maximumSalesForSlowMoving
    ) {
      alerts.push({
        productId,
        productName: product.name,

        issueType: "SLOW_MOVING_INVENTORY",

        severity: product.stockQuantity > 50 ? "HIGH" : "MEDIUM",

        message:
          `Product '${product.name}' has ` +
          `${product.stockQuantity} units in stock, ` +
          `but only ${totalSold} units sold in the last 30 days.`,

        evidence: {
          actualValue: totalSold,
          threshold: maximumSalesForSlowMoving,
          unit: "units sold in 30 days",
          metric: "unitsSoldIn30Days",
        },

        suggestedAction:
          "Review demand, purchasing plans, and inventory levels.",
      });
    }
  }

  // 8. Return results without saving alerts to MongoDB
  return {
    startDate,
    endDate,
    alerts,
  };
};
