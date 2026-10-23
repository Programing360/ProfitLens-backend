import { Router } from "express";

import { register, login, getUser } from "../controllers/auth.controller";
import { authenticate } from "../middlewares/authenticate";

const router = Router();
router.get("/test", (req, res) => {
  res.json({
    success: true,
    message: "Auth route is working",
  });
});
router.post("/register", register);
router.post("/login", login);
router.get("/me", authenticate, getUser);

const authRouters = router;

export default authRouters;
