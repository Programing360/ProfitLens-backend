import { type Request, type Response } from "express";
import { Product } from "../models/Product.js";
import { Sale } from "../models/Sales.js";
import { Expense } from "../models/Expense.js";

export const getFinancialAnalytics = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const products = await Product.find({});
    const sales = await Sale.find({});
    const expenses = await Expense.find({});

    const productAnalytics = await Promise.all(
      products.map(async (product) => {
        const productSales = sales.filter((sale) => {
          sale.productId.toString() === product._id.toString();
        });
        const totalQuantitySold = productSales.reduce(
          (acc, curr) => acc + curr.quantitySold,
          0,
        );

        const revenue = productSales.reduce(
          (acc, curr) => acc + curr.totalRevenue,
          0,
        );

        // Calculate total product cost for sold items
        const totalProductCost = product.productCost * totalQuantitySold;

        // Allocate other costs (product specific or distributed)
        const totalOtherCosts = product.otherCosts * totalQuantitySold;

        const netProfit = revenue - totalProductCost - totalOtherCosts;

        const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

        return {
          productId: product._id,
          name: product.name,
          category: product.category,
          stockQuantity: product.stockQuantity,
          totalQuantitySold,
          revenue,
          totalProductCost,
          totalOtherCosts,
          netProfit: Number(netProfit.toFixed(2)),
          profitMargin: Number(profitMargin.toFixed(2)),
        };
      }),
    );

    res.status(200).json({
      success: true,
      data: productAnalytics,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
