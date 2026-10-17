import { Router } from "express";

import { register, login } from "../controllers/auth.controller";

const router = Router();
router.get("/test", (req, res) => {
  res.json({
    success: true,
    message: "Auth route is working",
  });
});
router.post("/register", register);
router.post("/login", login);

const authRouters = router;

export default authRouters;
