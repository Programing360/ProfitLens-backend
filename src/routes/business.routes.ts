import { Router } from "express";

import { authenticate } from "../middlewares/authenticate";

import { authorizeBusiness } from "../middlewares/authorizeBusiness";
import { detectBusinessLeaks } from "../controllers/leakDetectionController";
import { getAIRecommendations } from "../controllers/aiController";
import { getDashboardOverview } from "../controllers/dashboard.controller";
import { updateAlertStatus } from "../controllers/alertStatusController";

const router = Router();

router.get("/leaks", authenticate, authorizeBusiness, detectBusinessLeaks);
router.get(
  "/ai-recommendations",
  authenticate,
  authorizeBusiness,
  getAIRecommendations,
);

router.get("/overview", authenticate, authorizeBusiness, getDashboardOverview);
router.patch("/leaks/:alertId/status", updateAlertStatus);
const businessRoutes = router;

export default businessRoutes;
