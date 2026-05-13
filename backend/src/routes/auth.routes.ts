import express from "express";

import {
  register,
  verifyEmail,
  login,
  logout,
  getCurrentUser,
  resendVerificationEmail,
} from "../controllers/auth.controller";

import { requireAuth } from "../middleware/auth.middleware";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", logout);

router.get("/verify-email", verifyEmail);
router.post("/verify-email", verifyEmail);

router.post("/resend-verification", resendVerificationEmail);

router.get("/me", requireAuth, getCurrentUser);

export default router;