import { type Request, type Response } from "express";
import { Product } from "../models/Product.js";
import { Sale } from "../models/Sales.js";
import { Expense } from "../models/Expense.js";
import {
  productValidationSchema,
  saleValidationSchema,
  expenseValidationSchema,
} from "../schemas/validation.js";

export const createProduct = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const validatedData = productValidationSchema.parse(req.body);
    const product = new Product(validatedData);
    await product.save();
    res.status(201).json({ success: true, data: product });
  } catch (error: any) {
    res
      .status(400)
      .json({ success: false, message: error.error || error.message });
  }
};

export const getProducts = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const products = await Product.find({});
    res.status(200).json({ success: true, data: products });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// --- SALE CONTROLLERS ---
export const createSale = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const validatedData = saleValidationSchema.parse(req.body);
    const sale = new Sale(validatedData);
    await sale.save();
    res.status(201).json({ success: true, data: sale });
  } catch (error: any) {
    res
      .status(400)
      .json({ success: false, message: error.errors || error.message });
  }
};

// --- EXPENSE CONTROLLERS ---
export const createExpense = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const validatedData = expenseValidationSchema.parse(req.body);
    const expense = new Expense(validatedData);
    await expense.save();
    res.status(201).json({ success: true, data: expense });
  } catch (error: any) {
    res
      .status(400)
      .json({ success: false, message: error.errors || error.message });
  }
};
