import { Router } from "express";

import { authenticate } from "../middlewares/authenticate";

import { authorizeBusiness } from "../middlewares/authorizeBusiness";
import { detectBusinessLeaks } from "../controllers/leakDetectionController";
import { getAIRecommendations } from "../controllers/aiController";

const router = Router();

router.get("/leaks", authenticate, authorizeBusiness, detectBusinessLeaks);
router.get(
  "/ai-recommendations",
  authenticate,
  authorizeBusiness,
  getAIRecommendations,
);
const businessRoutes = router;

export default businessRoutes;
