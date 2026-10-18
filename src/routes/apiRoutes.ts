import { Router } from "express";

import {
  createProduct,
  getProducts,
  createSale,
  createExpense,
  deleteProduct,
  updateProduct,
  getSales,
  getExpenses,
  updateExpense,
  deleteExpense,
} from "../controllers/businessController";

import {
  getFinancialAnalytics,
  getMonthlyAnalytics,
} from "../controllers/analyticsController";
import { detectBusinessLeaks } from "../controllers/leakDetectionController";

import { authenticate } from "../middlewares/authenticate";
import { authorizeBusiness } from "../middlewares/authorizeBusiness";

const router = Router();

// Protect all routes defined below.
router.use(authenticate, authorizeBusiness);

// Products
router.post("/products", createProduct);
router.get("/products", getProducts);
router.patch("/products/:productId", updateProduct);

router.delete("/products/:productId", deleteProduct);

// Sales
router.post("/sales", createSale);
router.get("/sales", getSales);

// Expenses
router.post("/expenses", createExpense);

router.get("/expenses", getExpenses);

router.patch("/expenses/:expenseId", updateExpense);

router.delete("/expenses/:expenseId", deleteExpense);

// Analytics
router.get("/analytics", getFinancialAnalytics);
router.get("/analytics/monthly", getMonthlyAnalytics);

// Leak Detection
router.get("/leaks", detectBusinessLeaks);

export default router;
