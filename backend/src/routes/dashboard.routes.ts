import express from "express";

import {
  getAssets,
  getMyPortfolio,
  getMyOrders,
  getCurrentCompetition,
} from "../controllers/dashboard.controller";

import { createMarketOrder } from "../controllers/trading.controller";

import { requireAuth } from "../middleware/auth.middleware";

const router = express.Router();

router.get("/assets", getAssets);

router.get("/portfolio/me", requireAuth, getMyPortfolio);
router.get("/orders/me", requireAuth, getMyOrders);
router.post("/orders/market", requireAuth, createMarketOrder);
router.get("/competitions/current", requireAuth, getCurrentCompetition);

export default router;