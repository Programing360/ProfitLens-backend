import { Router } from "express";
import {
  createProduct,
  getProducts,
  createSale,
  createExpense,
} from "../controllers/businessController.js";
import { getFinancialAnalytics } from "../controllers/analyticsController.js";
import { detectBusinessLeaks } from "../controllers/leakDetectionController.js";

const router = Router();

// Products Router
router.post("/products", createProduct);
router.get("/products", getProducts);

// Sales Router
router.post("/sales", createSale);

// Expense Router
router.post("/expense", createExpense);

// Analytics Route
router.get("/analytics", getFinancialAnalytics);

// Leak Detection Route
router.get("/leaks", detectBusinessLeaks);

export default router;
