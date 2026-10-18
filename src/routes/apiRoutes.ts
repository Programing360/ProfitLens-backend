import { Router } from "express";

import {
  createProduct,
  getProducts,
  createSale,
  createExpense,
  deleteProduct,
  updateProduct,
  getSales,
} from "../controllers/businessController";

import { getFinancialAnalytics } from "../controllers/analyticsController";
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
router.post("/expense", createExpense);

// Analytics
router.get("/analytics", getFinancialAnalytics);

// Leak Detection
router.get("/leaks", detectBusinessLeaks);

export default router;
