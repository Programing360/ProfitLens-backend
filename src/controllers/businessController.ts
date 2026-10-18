import { type Response } from "express";
import mongoose from "mongoose";

import type { AuthenticatedRequest } from "../middlewares/authenticate";

import { Product } from "../models/Product";
import { Sale } from "../models/Sales";
import { Expense } from "../models/Expense";

import {
  productValidationSchema,
  saleValidationSchema,
  expenseValidationSchema,
} from "../schemas/validation";

// ==========================================
// CREATE PRODUCT
// ==========================================
export const createProduct = async (
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

    const validatedData = productValidationSchema.parse(req.body);

    const product = await Product.create({
      ...validatedData,
      businessId,
    });

    res.status(201).json({
      success: true,
      data: product,
    });
  } catch (error: unknown) {
    if (error instanceof mongoose.Error.ValidationError) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
      return;
    }

    if (error instanceof Error && error.name === "ZodError") {
      res.status(400).json({
        success: false,
        message: error.message,
      });
      return;
    }

    console.error("Create product error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create product.",
    });
  }
};

// ==========================================
// GET PRODUCTS
// ==========================================
export const getProducts = async (
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

    const products = await Product.find({
      businessId,
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch (error: unknown) {
    console.error("Get products error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch products.",
    });
  }
};

// ==========================================
// UPDATE PRODUCT
// ==========================================
export const updateProduct = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const businessId = req.user?.businessId;
    const { productId } = req.params;

    if (!businessId) {
      res.status(403).json({
        success: false,
        message: "No business is associated with this account.",
      });
      return;
    }

    if (!mongoose.isValidObjectId(productId)) {
      res.status(400).json({
        success: false,
        message: "Invalid product ID.",
      });
      return;
    }

    // Only allow fields that can be updated.
    const updateSchema = productValidationSchema.partial();
    const validatedData = updateSchema.parse(req.body);

    if (Object.keys(validatedData).length === 0) {
      res.status(400).json({
        success: false,
        message: "Provide at least one field to update.",
      });
      return;
    }

    const product = await Product.findOneAndUpdate(
      {
        _id: productId,
        businessId,
      },
      { $set: validatedData },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!product) {
      res.status(404).json({
        success: false,
        message: "Product not found.",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Product updated successfully.",
      data: product,
    });
  } catch (error: unknown) {
    if (
      error instanceof mongoose.Error.ValidationError ||
      (error instanceof Error && error.name === "ZodError")
    ) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
      return;
    }

    console.error("Update product error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update product.",
    });
  }
};

// ==========================================
// DELETE PRODUCT
// ==========================================
export const deleteProduct = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const businessId = req.user?.businessId;
    const { productId } = req.params;

    if (!businessId) {
      res.status(403).json({
        success: false,
        message: "No business is associated with this account.",
      });
      return;
    }

    if (!mongoose.isValidObjectId(productId)) {
      res.status(400).json({
        success: false,
        message: "Invalid product ID.",
      });
      return;
    }

    // Do not delete a product that has sales records.
    const existingSale = await Sale.exists({
      productId,
      businessId,
    });

    if (existingSale) {
      res.status(409).json({
        success: false,
        message:
          "This product has sales records and cannot be deleted. Consider archiving it instead.",
      });
      return;
    }

    const product = await Product.findOneAndDelete({
      _id: productId,
      businessId,
    });

    if (!product) {
      res.status(404).json({
        success: false,
        message: "Product not found.",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Product deleted successfully.",
      data: product,
    });
  } catch (error: unknown) {
    console.error("Delete product error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete product.",
    });
  }
};

// ==========================================
// CREATE SALE
// ==========================================

export const createSale = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  let stockUpdated = false;
  let updatedProductId: string | null = null;
  let previousStock = 0;

  try {
    const businessId = req.user?.businessId;

    if (!businessId) {
      res.status(403).json({
        success: false,
        message: "No business is associated with this account.",
      });
      return;
    }

    const validatedData = saleValidationSchema.parse(req.body);

    // 1. Validate product ID
    if (!mongoose.isValidObjectId(validatedData.productId)) {
      res.status(400).json({
        success: false,
        message: "Invalid product ID.",
      });
      return;
    }

    // 2. Find a product belonging to this business
    const product = await Product.findOne({
      _id: validatedData.productId,
      businessId,
    });

    if (!product) {
      res.status(404).json({
        success: false,
        message: "Product not found in your business.",
      });
      return;
    }

    const quantitySold = validatedData.quantitySold;

    // 3. Check stock
    if (product.stockQuantity < quantitySold) {
      res.status(400).json({
        success: false,
        message: `Insufficient stock. Available: ${product.stockQuantity}. Requested: ${quantitySold}.`,
      });
      return;
    }

    // 4. Calculate values on the server
    const totalRevenue = product.sellingPrice * quantitySold;

    const unitCostAtSale = product.productCost + product.otherCosts;

    // 5. Decrease stock only if enough stock still exists.
    // This conditional update helps prevent overselling in concurrent requests.
    const stockResult = await Product.updateOne(
      {
        _id: product._id,
        businessId,
        stockQuantity: { $gte: quantitySold },
      },
      {
        $inc: {
          stockQuantity: -quantitySold,
        },
      },
    );

    if (stockResult.modifiedCount !== 1) {
      res.status(409).json({
        success: false,
        message: "Stock changed during this request. Please try again.",
      });
      return;
    }

    stockUpdated = true;
    updatedProductId = product._id.toString();
    previousStock = product.stockQuantity;

    // 6. Create sale record
    const sale = await Sale.create({
      businessId,
      productId: product._id,
      quantitySold,
      totalRevenue,
      unitCostAtSale,
      packagingCost: validatedData.packagingCost,
      deliveryCost: validatedData.deliveryCost,
      paymentFee: validatedData.paymentFee,
      otherVariableCosts: validatedData.otherVariableCosts,
      ...(validatedData.saleDate ? { saleDate: validatedData.saleDate } : {}),
    });

    res.status(201).json({
      success: true,
      message: "Sale created successfully.",
      data: sale,
    });
  } catch (error: unknown) {
    // If sale creation fails after stock was reduced,
    // attempt to restore the stock.
    if (stockUpdated && updatedProductId) {
      try {
        await Product.updateOne(
          {
            _id: updatedProductId,
            businessId: req.user?.businessId,
            stockQuantity: { $gte: 0 },
          },
          {
            $inc: {
              stockQuantity: req.body.quantitySold,
            },
          },
        );
      } catch (rollbackError) {
        console.error("Stock rollback error:", rollbackError);
      }
    }

    if (
      error instanceof mongoose.Error.ValidationError ||
      (error instanceof Error && error.name === "ZodError")
    ) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
      return;
    }

    console.error("Create sale error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create sale.",
    });
  }
};

// ==========================================
// GET SALES
// ==========================================
export const getSales = async (
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

    const sales = await Sale.find({ businessId })
      .populate("productId", "name category sellingPrice")
      .sort({ saleDate: -1 });

    const totalRevenue = sales.reduce(
      (total, sale) => total + sale.totalRevenue,
      0,
    );

    const totalQuantitySold = sales.reduce(
      (total, sale) => total + sale.quantitySold,
      0,
    );

    res.status(200).json({
      success: true,
      count: sales.length,
      summary: {
        totalRevenue,
        totalQuantitySold,
        totalSales: sales.length,
      },
      data: sales,
    });
  } catch (error: unknown) {
    console.error("Get sales error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch sales.",
    });
  }
};

// ==========================================
// CREATE EXPENSE
// ==========================================
export const createExpense = async (
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

    const validatedData = expenseValidationSchema.parse(req.body);

    // If an expense references a product, verify ownership.
    if (validatedData.productId) {
      const product = await Product.findOne({
        _id: validatedData.productId,
        businessId,
      });

      if (!product) {
        res.status(404).json({
          success: false,
          message: "Product not found in your business.",
        });
        return;
      }
    }

    const expense = await Expense.create({
      ...validatedData,
      businessId,
    });

    res.status(201).json({
      success: true,
      data: expense,
    });
  } catch (error: unknown) {
    if (
      error instanceof mongoose.Error.ValidationError ||
      (error instanceof Error && error.name === "ZodError")
    ) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
      return;
    }

    console.error("Create expense error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create expense.",
    });
  }
};

// ==========================================
// GET EXPENSES
// ==========================================
export const getExpenses = async (
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

    const expenses = await Expense.find({ businessId })
      .populate("productId", "name category")
      .sort({ expenseDate: -1 });

    const totalExpenses = expenses.reduce(
      (total, expense) => total + expense.amount,
      0,
    );

    res.status(200).json({
      success: true,
      count: expenses.length,
      totalExpenses,
      data: expenses,
    });
  } catch (error: unknown) {
    console.error("Get expenses error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch expenses.",
    });
  }
};

// ==========================================
// UPDATE EXPENSE
// ==========================================
export const updateExpense = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const businessId = req.user?.businessId;
    const { expenseId } = req.params;

    if (!businessId) {
      res.status(403).json({
        success: false,
        message: "No business is associated with this account.",
      });
      return;
    }

    if (!mongoose.isValidObjectId(expenseId)) {
      res.status(400).json({
        success: false,
        message: "Invalid expense ID.",
      });
      return;
    }

    const updateSchema = expenseValidationSchema.partial();
    const validatedData = updateSchema.parse(req.body);

    if (Object.keys(validatedData).length === 0) {
      res.status(400).json({
        success: false,
        message: "Provide at least one field to update.",
      });
      return;
    }

    // Verify product ownership if a product is supplied.
    if (validatedData.productId) {
      if (!mongoose.isValidObjectId(validatedData.productId)) {
        res.status(400).json({
          success: false,
          message: "Invalid product ID.",
        });
        return;
      }

      const product = await Product.findOne({
        _id: validatedData.productId,
        businessId,
      });

      if (!product) {
        res.status(404).json({
          success: false,
          message: "Product not found in your business.",
        });
        return;
      }
    }

    const expense = await Expense.findOneAndUpdate(
      { _id: expenseId, businessId },
      { $set: validatedData },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!expense) {
      res.status(404).json({
        success: false,
        message: "Expense not found.",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Expense updated successfully.",
      data: expense,
    });
  } catch (error: unknown) {
    if (
      error instanceof mongoose.Error.ValidationError ||
      (error instanceof Error && error.name === "ZodError")
    ) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
      return;
    }

    console.error("Update expense error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update expense.",
    });
  }
};
// ==========================================
// DELETE EXPENSE
// ==========================================
export const deleteExpense = async (
  req: AuthenticatedRequest,
  res: Response,
): Promise<void> => {
  try {
    const businessId = req.user?.businessId;
    const { expenseId } = req.params;

    if (!businessId) {
      res.status(403).json({
        success: false,
        message: "No business is associated with this account.",
      });
      return;
    }

    if (!mongoose.isValidObjectId(expenseId)) {
      res.status(400).json({
        success: false,
        message: "Invalid expense ID.",
      });
      return;
    }

    const expense = await Expense.findOneAndDelete({
      _id: expenseId,
      businessId,
    });

    if (!expense) {
      res.status(404).json({
        success: false,
        message: "Expense not found.",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Expense deleted successfully.",
      data: expense,
    });
  } catch (error: unknown) {
    console.error("Delete expense error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete expense.",
    });
  }
};
