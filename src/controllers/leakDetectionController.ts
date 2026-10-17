import { type Response } from "express";
import type { AuthenticatedRequest } from "../middlewares/authenticate";
import { Product } from "../models/Product";
import { Sale } from "../models/Sales";
import { Business } from "../models/Business";
import mongoose from "mongoose";

export interface ILeakAlert {
  productId: string;
  productName: string;

  issueType: "LOW_MARGIN" | "SLOW_MOVING_INVENTORY";

  severity: "HIGH" | "MEDIUM" | "LOW";

  message: string;

  evidence: {
    metric: any;
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
    // 1. Get authenticated user and business ID
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

    // 2. Verify business ownership and retrieve settings
    const business = await Business.findById({
      _id: businessId,
      ownerId: user?.id,
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

    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 30);

    // Fetch products.
    const products = await Product.find({
      businessId,
    }).lean();

    // Aggregate sales by product within the selected period.
    const salesSummary: ISalesSummary[] = await Sale.aggregate([
      {
        $match: {
          businessId: new mongoose.Types.ObjectId(businessId),
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

    // 6. Create a sales lookup map
    const salesMap = new Map<string, ISalesSummary>();

    for (const sale of salesSummary) {
      salesMap.set(sale._id.toString(), sale);
    }

    const alerts: ILeakAlert[] = [];
    const now = Date.now();
    const millisecondsPerDay = 1000 * 60 * 60 * 24;

    for (const product of products) {
      const productId = product._id.toString();

      //   const productAgeInDays =
      //     (Date.now() - product.createdAt.getTime()) / (1000 * 60 * 60 * 24);

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

      //   const { totalSold, totalRevenue, totalProductCost } = salesData;

      // RULE 1: Low Profit Margin.
      if (
        totalRevenue > 0 &&
        salesCount > 0 &&
        salesWithoutHistoricalCost === 0
      ) {
        const grossProfit = totalRevenue - totalProductCost;

        //   const grossProfitMargin =
        //     totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

        const totalVariableCosts =
          totalPackagingCost +
          totalDeliveryCost +
          totalPaymentFee +
          totalOtherVariableCosts;

        const contributionProfit = grossProfit - totalVariableCosts;

        const contributionMargin =
          totalRevenue > 0 ? (contributionProfit / totalRevenue) * 100 : 0;

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
              metric: undefined
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
            metric: undefined
          },

          suggestedAction:
            "Review demand, purchasing plans, and inventory levels.",
        });
      }
    }

    // 8. Return analysis results
    res.status(200).json({
      success: true,

      period: {
        startDate,
        endDate,
      },

      totalAlerts: alerts.length,

      summary: {
        high: alerts.filter((alert) => alert.severity === "HIGH").length,

        medium: alerts.filter((alert) => alert.severity === "MEDIUM").length,

        low: alerts.filter((alert) => alert.severity === "LOW").length,
      },

      alerts,
    });
  } catch (error: unknown) {
    console.error("Business leak detection failed:", error);

    res.status(500).json({
      success: false,
      message: "Failed to analyze business data.",
    });
  }
};
