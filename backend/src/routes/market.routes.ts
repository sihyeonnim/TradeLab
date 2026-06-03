import { Router } from "express";

import { requireAuth } from "../middleware/auth.middleware";
import {
  listAssetPrices,
  listMarketAssets,
  refreshAllAssetPrices,
  refreshOneAssetPrice,
  simulateAllMarketAssets,
  simulateOneMarketAsset,
  tickAllMarketAssets,
  tickOneMarketAsset,
} from "../controllers/market.controller";

const router = Router();

router.get("/ping", requireAuth, (req, res) => {
  res.json({
    message: "Market routes are connected.",
  });
});

router.get("/assets", requireAuth, listMarketAssets);

router.post("/assets/tick", requireAuth, tickAllMarketAssets);
router.post("/assets/:assetId/tick", requireAuth, tickOneMarketAsset);

router.post("/assets/simulate", requireAuth, simulateAllMarketAssets);
router.post("/assets/:assetId/simulate", requireAuth, simulateOneMarketAsset);

router.post("/assets/refresh", requireAuth, refreshAllAssetPrices);
router.post("/assets/:assetId/refresh", requireAuth, refreshOneAssetPrice);

router.get("/assets/:assetId/prices", requireAuth, listAssetPrices);

export default router;