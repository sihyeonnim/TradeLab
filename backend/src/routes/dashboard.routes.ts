import express from "express";

import {
  getAssets,
  getMyPortfolio,
  getMyOrders,
  getCourses,
  getCurrentCompetition,
} from "../controllers/dashboard.controller";

import { createMarketOrder } from "../controllers/trading.controller";
import {
  refreshPrices,
  getAssetPriceHistory,
} from "../controllers/market.controller";

import {
  getPortfolioOverview,
  getPortfolioHistory,
  getTradeHistory,
  getHoldingDetail,
} from "../controllers/portfolio.controller";

import { requireAuth } from "../middleware/auth.middleware";

const router = express.Router();

router.get("/assets", getAssets);
router.post("/assets/refresh", requireAuth, refreshPrices);
router.get("/assets/prices/history", requireAuth, getAssetPriceHistory);

router.get("/portfolio/me", requireAuth, getMyPortfolio);
router.get("/portfolio/me/overview", requireAuth, getPortfolioOverview);
router.get("/portfolio/me/history", requireAuth, getPortfolioHistory);
router.get("/portfolio/me/trades", requireAuth, getTradeHistory);
router.get("/portfolio/me/holdings/:assetId", requireAuth, getHoldingDetail);
router.get("/orders/me", requireAuth, getMyOrders);
router.post("/orders/market", requireAuth, createMarketOrder);
router.get("/courses", requireAuth, getCourses);
router.get("/competitions/current", requireAuth, getCurrentCompetition);

export default router;