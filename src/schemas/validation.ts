import { z } from "zod";

export const productValidationSchema = z.object({
  name: z.string().min(1, "product name is required"),
  category: z.string().min(1, "Category is required"),
  productCost: z.number().positive("Product cost must be positive"),
  sellingPrice: z.number().positive("Selling price must be positive"),
  stockQuantity: z.number().nonnegative("Stock quantity cannot be negative"),
  otherCosts: z.number().nonnegative("Other costs cannot be negative"),
});

export const saleValidationSchema = z.object({
  productId: z.string().min(1, "Product ID is required"),
  quantitySold: z.number().positive("Quantity sold must be positive"),
  totalRevenue: z.number().positive("Total revenue must be positive"),
});

export const expenseValidationSchema = z.object({
  productId: z.string().optional(),
  title: z.string().min(1, "Expense title is required"),
  amount: z.number().positive("Amount must be positive"),
  category: z.string().min(1, "Category is required"),
});
