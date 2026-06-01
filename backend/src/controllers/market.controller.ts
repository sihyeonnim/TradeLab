import { Request, Response, NextFunction } from "express";

import { isFinnhubConfigured } from "../services/finnhub.service";
import { refreshAllAssetPrices } from "../services/marketData.service";
import { AssetPriceSnapshot } from "../models";

/**
 * POST /api/assets/refresh
 * Pull live prices from Finnhub for every active asset and persist them.
 */
export async function refreshPrices(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!isFinnhubConfigured()) {
      return res.status(503).json({
        message:
          "Market data provider is not configured. Set FINNHUB_API_KEY in the backend .env.",
      });
    }

    const summary = await refreshAllAssetPrices();

    return res.json({
      message: `Refreshed ${summary.updated} asset price(s)${
        summary.failed ? `, ${summary.failed} failed` : ""
      }.`,
      ...summary,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/assets/prices/history
 * Recent recorded price points per asset (default: last 24h, capped per asset),
 * grouped by asset id. Powers the per-asset price sparklines on the dashboard.
 */
export async function getAssetPriceHistory(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const hours = Math.min(
      Math.max(Number(req.query.hours) || 24, 1),
      24 * 7
    );
    const maxPointsPerAsset = 120;

    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const snapshots: any[] = await AssetPriceSnapshot.find({
      createdAt: { $gte: since },
    })
      .sort({ createdAt: 1 })
      .lean();

    const history: Record<string, { t: Date; price: number }[]> = {};

    for (const snapshot of snapshots) {
      const assetId = String(snapshot.asset);
      if (!history[assetId]) {
        history[assetId] = [];
      }
      history[assetId].push({
        t: snapshot.createdAt,
        price: Number(snapshot.price),
      });
    }

    // Keep only the most recent N points per asset to bound payload size.
    for (const assetId of Object.keys(history)) {
      const points = history[assetId];
      if (points.length > maxPointsPerAsset) {
        history[assetId] = points.slice(points.length - maxPointsPerAsset);
      }
    }

    return res.json({ history });
  } catch (error) {
    next(error);
  }
}
