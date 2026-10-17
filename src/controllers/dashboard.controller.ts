import { type Response } from "express";
import mongoose from "mongoose";

import type { AuthenticatedRequest } from "../middlewares/authenticate";
import { Product } from "../models/Product";
import { Sale } from "../models/Sales";
import { Expense } from "../models/Expense";
import { Business } from "../models/Business";

export const getDashboardOverview = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
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

    const business = await Business.findOne({
      _id: businessId,
      ownerId: user.id,
    }).lean();

    if (!business) {
      res.status(404).json({
        success: false,
        message: "Business not found or access denied.",
      });
      return;
    }

    const businessObjectId = new mongoose.Types.ObjectId(businessId.toString());

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const [productCount, stockSummary, salesSummary, recentSales] =
      await Promise.all([
        Product.countDocuments({
          businessId: businessObjectId,
        }),

        Product.aggregate([
          {
            $match: {
              businessId: businessObjectId,
            },
          },
          {
            $group: {
              _id: null,
              totalStock: { $sum: "$stockQuantity" },
            },
          },
        ]),

        Sale.aggregate([
          {
            $match: {
              businessId: businessObjectId,
              saleDate: {
                $gte: startDate,
                $lte: new Date(),
              },
            },
          },
          {
            $group: {
              _id: null,

              totalRevenue: {
                $sum: "$totalRevenue",
              },

              totalProductCost: {
                $sum: {
                  $multiply: ["$quantitySold", "$unitCostAtSale"],
                },
              },

              totalVariableCosts: {
                $sum: {
                  $add: [
                    { $ifNull: ["$packagingCost", 0] },
                    { $ifNull: ["$deliveryCost", 0] },
                    { $ifNull: ["$paymentFee", 0] },
                    { $ifNull: ["$otherVariableCosts", 0] },
                  ],
                },
              },

              totalSales: {
                $sum: 1,
              },

              totalUnitsSold: {
                $sum: "$quantitySold",
              },
            },
          },
        ]),

        Sale.find({
          businessId: businessObjectId,
        })
          .sort({ saleDate: -1 })
          .limit(5)
          .populate("productId", "name")
          .lean(),
      ]);

    const sales = salesSummary[0] ?? {
      totalRevenue: 0,
      totalProductCost: 0,
      totalVariableCosts: 0,
      totalSales: 0,
      totalUnitsSold: 0,
    };

    /*
     * Expense Model currently has no businessId.
     * Do not aggregate all expenses, because that could expose
     * another business's financial information.
     */
    const expensesAvailable = false;

    const totalExpenses: number | null = expensesAvailable
      ? await Expense.countDocuments()
      : null;

    const estimatedProfit =
      sales.totalRevenue - sales.totalProductCost - sales.totalVariableCosts;

    res.status(200).json({
      success: true,

      business: {
        id: business._id,
        name: business.name,
      },

      period: {
        startDate,
        endDate: new Date(),
      },

      overview: {
        totalRevenue: sales.totalRevenue,
        totalExpenses,
        productCost: sales.totalProductCost,
        variableCosts: sales.totalVariableCosts,
        estimatedProfit,
        totalProducts: productCount,
        totalStock: stockSummary[0]?.totalStock ?? 0,
        totalSales: sales.totalSales,
        totalUnitsSold: sales.totalUnitsSold,
      },

      recentSales,
    });
  } catch (error: unknown) {
    console.error("Dashboard overview error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to load dashboard overview.",
    });
  }
};
