import { Router } from "express";

import {
  getBusinessSettings,
  updateBusinessSettings,
} from "../controllers/businessSettingsController";

import { authenticate } from "../middlewares/authenticate";

const router = Router();

router.get("/", authenticate, getBusinessSettings);

router.patch("/", authenticate, updateBusinessSettings);
const businessSettingsRoutes = router;
export default businessSettingsRoutes;
