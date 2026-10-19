import { Router } from "express";

import { authenticate } from "../middlewares/authenticate";

import { authorizeBusiness } from "../middlewares/authorizeBusiness";
import { detectBusinessLeaks } from "../controllers/leakDetectionController";
import { getAIRecommendations } from "../controllers/aiController";
import { getDashboardOverview } from "../controllers/dashboard.controller";
import { updateAlertStatus } from "../controllers/alertStatusController";
import { getAlertHistory } from "../controllers/getAlertHistory";

const router = Router();

router.get("/leaks", authenticate, authorizeBusiness, detectBusinessLeaks);
router.get(
  "/ai-recommendations",
  authenticate,
  authorizeBusiness,
  getAIRecommendations,
);

router.get("/overview", authenticate, authorizeBusiness, getDashboardOverview);
router.patch(
  "/leaks/:alertId/status",
  authenticate,
  authorizeBusiness,
  updateAlertStatus,
);

router.get("/alerts", authenticate, authorizeBusiness, getAlertHistory);
const businessRoutes = router;

export default businessRoutes;
