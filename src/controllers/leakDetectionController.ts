import { User } from "./../models/User.js";
import { type Request, type Response } from "express";
import { Product } from "../models/Product.js";
import { Sale } from "../models/Sales.js";
import { Business } from "../models/Business.js";

export interface ILeakAlert {
  productId: string;
  productName: string;

  issueType: "LOW_MARGIN" | "SLOW_MOVING_INVENTORY";

  severity: "HIGH" | "MEDIUM" | "LOW";

  message: string;

  evidence: {
    actualValue: number;
    threshold: number;
    unit: string;
  };

  suggestedAction: string;
}

export const detectBusinessLeaks = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    // Analyze sales from the last 30 days.
    const endDate = new Date();
    const businessId = req.User.businessId;

    const business = await Business.findById(businessId);

    if (!business) {
      res.status(404).json({
        success: false,
        message: "Business not found.",
      });
      return;
    }

    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 30);

    // Fetch products.
    const products = await Product.find({
      businessId,
    }).lean();

    // Aggregate sales by product within the selected period.
    const salesSummary = await Sale.aggregate([
      {
        $match: {
          businessId,
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
              $multiply: ["$quantitySold", "$unitCostAtSale"],
            },
          },
        },
      },
    ]);

    // Build a lookup map for efficient access.
    const salesMap = new Map<
      string,
      { totalSold: number; totalRevenue: number; totalProductCost: number }
    >();

    for (const sale of salesSummary) {
      salesMap.set(sale._id.toString(), {
        totalSold: sale.totalSold,
        totalRevenue: sale.totalRevenue,
        totalProductCost: sale.totalProductCost,
      });
    }

    const alerts: ILeakAlert[] = [];

    for (const product of products) {
      const productId = product._id.toString();

      const productAgeInDays =
        (Date.now() - product.createdAt.getTime()) / (1000 * 60 * 60 * 24);

      const salesData = salesMap.get(productId) ?? {
        totalSold: 0,
        totalRevenue: 0,
        totalProductCost: 0,
      };

      const { totalSold, totalRevenue, totalProductCost } = salesData;

      // RULE 1: Low Profit Margin.
      if (totalRevenue > 0) {
        const grossProfit = totalRevenue - totalProductCost;

        const grossProfitMargin = (grossProfit / totalRevenue) * 100;

        const totalUnitCost = product.productCost + product.otherCosts;

        const totalCost = totalUnitCost * totalSold;

        const netProfit = totalRevenue - totalCost;

        const profitMargin = (netProfit / totalRevenue) * 100;

        if (profitMargin < 15) {
          alerts.push({
            productId,
            productName: product.name,

            issueType: "LOW_MARGIN",

            severity: profitMargin < 5 ? "HIGH" : "MEDIUM",

            message:
              `Product '${product.name}' has a profit margin ` +
              `of ${profitMargin.toFixed(1)}% over the last 30 days.`,

            evidence: {
              actualValue: Number(profitMargin.toFixed(2)),
              threshold: 15,
              unit: "%",
            },

            suggestedAction:
              "Review product cost, discounts, and other expenses.",
          });
        }
      }

      // RULE 2: Slow-moving inventory.
      if (
        productAgeInDays >= 30 &&
        product.stockQuantity > 30 &&
        totalSold < 5
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
            threshold: 5,
            unit: "units sold in 30 days",
          },

          suggestedAction:
            "Review demand, purchasing plans, and inventory levels.",
        });
      }
    }

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
