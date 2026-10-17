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
// CREATE SALE
// ==========================================
export const createSale = async (
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

    const validatedData = saleValidationSchema.parse(req.body);

    // Ensure that the product belongs to this business.
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

    const sale = await Sale.create({
      ...validatedData,
      businessId,
    });

    res.status(201).json({
      success: true,
      data: sale,
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

    console.error("Create sale error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create sale.",
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
