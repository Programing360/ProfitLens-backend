import { type Response } from "express";
import type { AuthenticatedRequest } from "../middlewares/authenticate";
import { Product } from "../models/Product";
import { Sale } from "../models/Sales";
import { Expense } from "../models/Expense";

export const getFinancialAnalytics = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const businessId = req.user?.businessId;

    if (!businessId) {
      res.status(403).json({
        success: false,
        message: "No business is associated with this account.",
      });
      return;
    }

    // Fetch only the current business's data.
    const [products, sales, expenses] = await Promise.all([
      Product.find({ businessId }).lean(),
      Sale.find({ businessId }).lean(),
      Expense.find({ businessId }).lean(),
    ]);

    // Product-wise analytics.
    const productAnalytics = products.map((product) => {
      const productSales = sales.filter(
        (sale) => sale.productId.toString() === product._id.toString(),
      );

      const productExpenses = expenses.filter(
        (expense) => expense.productId?.toString() === product._id.toString(),
      );

      const totalQuantitySold = productSales.reduce(
        (total, sale) => total + sale.quantitySold,
        0,
      );

      const revenue = productSales.reduce(
        (total, sale) => total + sale.totalRevenue,
        0,
      );

      const totalProductCost = productSales.reduce(
        (total, sale) => total + sale.unitCostAtSale * sale.quantitySold,
        0,
      );

      const totalVariableCosts = productSales.reduce(
        (total, sale) =>
          total +
          sale.packagingCost +
          sale.deliveryCost +
          sale.paymentFee +
          sale.otherVariableCosts,
        0,
      );

      const totalProductExpenses = productExpenses.reduce(
        (total, expense) => total + expense.amount,
        0,
      );

      const netProfit =
        revenue - totalProductCost - totalVariableCosts - totalProductExpenses;

      const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

      return {
        productId: product._id,
        name: product.name,
        category: product.category,
        stockQuantity: product.stockQuantity,
        totalQuantitySold,
        revenue: Number(revenue.toFixed(2)),
        totalProductCost: Number(totalProductCost.toFixed(2)),
        totalVariableCosts: Number(totalVariableCosts.toFixed(2)),
        totalProductExpenses: Number(totalProductExpenses.toFixed(2)),
        netProfit: Number(netProfit.toFixed(2)),
        profitMargin: Number(profitMargin.toFixed(2)),
      };
    });

    // General expenses are not linked to any product.
    const generalExpenses = expenses.filter((expense) => !expense.productId);

    const totalRevenue = sales.reduce(
      (total, sale) => total + sale.totalRevenue,
      0,
    );

    const totalProductCost = sales.reduce(
      (total, sale) => total + sale.unitCostAtSale * sale.quantitySold,
      0,
    );

    const totalVariableCosts = sales.reduce(
      (total, sale) =>
        total +
        sale.packagingCost +
        sale.deliveryCost +
        sale.paymentFee +
        sale.otherVariableCosts,
      0,
    );

    const totalProductExpenses = expenses
      .filter((expense) => expense.productId)
      .reduce((total, expense) => total + expense.amount, 0);

    const totalGeneralExpenses = generalExpenses.reduce(
      (total, expense) => total + expense.amount,
      0,
    );

    const totalExpenses =
      totalProductCost +
      totalVariableCosts +
      totalProductExpenses +
      totalGeneralExpenses;

    const netProfit = totalRevenue - totalExpenses;

    const profitMargin =
      totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    res.status(200).json({
      success: true,
      data: {
        summary: {
          totalRevenue: Number(totalRevenue.toFixed(2)),
          totalProductCost: Number(totalProductCost.toFixed(2)),
          totalVariableCosts: Number(totalVariableCosts.toFixed(2)),
          totalProductExpenses: Number(totalProductExpenses.toFixed(2)),
          totalGeneralExpenses: Number(totalGeneralExpenses.toFixed(2)),
          totalExpenses: Number(totalExpenses.toFixed(2)),
          netProfit: Number(netProfit.toFixed(2)),
          profitMargin: Number(profitMargin.toFixed(2)),
          totalProducts: products.length,
          totalSales: sales.length,
          totalExpenseRecords: expenses.length,
        },
        products: productAnalytics,
      },
    });
  } catch (error: unknown) {
    console.error("Financial analytics error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to calculate financial analytics.",
    });
  }
};
