import { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";

import * as AssetModule from "../models/Asset";
import PriceSnapshotModel from "../models/PriceSnapshot";
import {
  fetchAndStoreAllCurrentQuotePrices,
  fetchAndStoreCurrentQuotePrice,
} from "../services/marketData.service";
import {
  simulateAllAssetPrices,
  simulateOneAssetPrice,
  tickAllAssetPrices,
  tickOneAssetPrice,
} from "../services/marketSimulator.service";

function getAssetModel(): any {
  return (
    (AssetModule as any).default ||
    (AssetModule as any).AssetModel ||
    (AssetModule as any).Asset ||
    (AssetModule as any).defaultAssetModel ||
    mongoose.models.Asset
  );
}

const AssetModel = getAssetModel();

if (!AssetModel) {
  throw new Error(
    "Asset model could not be resolved. Check backend/src/models/Asset.ts exports."
  );
}

function getParamAsString(value: unknown) {
  if (Array.isArray(value)) {
    return String(value[0] || "");
  }

  return String(value || "");
}

function normalizeAsset(asset: any) {
  const doc = typeof asset.toObject === "function" ? asset.toObject() : asset;

  return {
    id: String(doc._id || doc.id),
    symbol: doc.symbol,
    name: doc.name,
    exchange: doc.exchange,
    type: doc.type,
    currency: doc.currency || "USD",
    lastPrice: Number(doc.lastFetchedPrice ?? doc.lastPrice ?? 0),
    lastFetchedPrice: Number(doc.lastFetchedPrice ?? doc.lastPrice ?? 0),
    lastFetchedAt: doc.lastFetchedAt || null,
    isActive: doc.isActive ?? true,
  };
}

function normalizeSnapshot(snapshot: any) {
  const doc =
    typeof snapshot.toObject === "function" ? snapshot.toObject() : snapshot;

  return {
    id: String(doc._id || doc.id),
    asset: String(doc.asset),
    symbol: doc.symbol,
    price: Number(doc.price || 0),
    open: doc.open ?? null,
    high: doc.high ?? null,
    low: doc.low ?? null,
    close: doc.close ?? null,
    volume: doc.volume ?? null,
    source: doc.source,
    timestamp: doc.timestamp,
  };
}

function getRangeConfig(range: string) {
  const normalized = String(range || "1M").toUpperCase();

  if (normalized === "1D") {
    return {
      range: "1D",
      limit: 100,
      since: new Date(Date.now() - 1000 * 60 * 60 * 24),
    };
  }

  if (normalized === "1W") {
    return {
      range: "1W",
      limit: 80,
      since: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7),
    };
  }

  if (normalized === "3M") {
    return {
      range: "3M",
      limit: 120,
      since: new Date(Date.now() - 1000 * 60 * 60 * 24 * 92),
    };
  }

  if (normalized === "1Y") {
    return {
      range: "1Y",
      limit: 280,
      since: new Date(Date.now() - 1000 * 60 * 60 * 24 * 365),
    };
  }

  return {
    range: "1M",
    limit: 80,
    since: new Date(Date.now() - 1000 * 60 * 60 * 24 * 31),
  };
}

export async function listMarketAssets(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const assets = await AssetModel.find({
      $or: [{ isActive: true }, { isActive: { $exists: false } }],
    }).sort({ symbol: 1 });

    return res.json({
      assets: assets.map(normalizeAsset),
    });
  } catch (error) {
    next(error);
  }
}

export async function listAssetPrices(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const assetId = getParamAsString(req.params.assetId);

    if (!mongoose.Types.ObjectId.isValid(assetId)) {
      return res.status(400).json({
        message: "Valid assetId is required.",
      });
    }

    const config = getRangeConfig(String(req.query.range || "1M"));

    let snapshots = await PriceSnapshotModel.find({
      asset: assetId,
      timestamp: { $gte: config.since },
    })
      .sort({ timestamp: -1 })
      .limit(config.limit);

    if (snapshots.length === 0) {
      snapshots = await PriceSnapshotModel.find({ asset: assetId })
        .sort({ timestamp: -1 })
        .limit(config.limit);
    }

    const ordered = snapshots.reverse();

    return res.json({
      range: config.range,
      count: ordered.length,
      prices: ordered.map(normalizeSnapshot),
    });
  } catch (error) {
    next(error);
  }
}


function requireAdminForRealRefresh(req: Request, res: Response) {
  const user = (req as any).user;

  if (!user || user.role !== "ADMIN") {
    res.status(403).json({
      message:
        "Manual Alpha Vantage refresh is restricted to ADMIN accounts. Real prices refresh automatically on the backend schedule.",
    });
    return false;
  }

  return true;
}

export async function refreshOneAssetPrice(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const assetId = getParamAsString(req.params.assetId);

    if (!mongoose.Types.ObjectId.isValid(assetId)) {
      return res.status(400).json({
        message: "Valid assetId is required.",
      });
    }

    if (!requireAdminForRealRefresh(req, res)) {
      return;
    }

    const result = await fetchAndStoreCurrentQuotePrice(assetId);

    return res.json({
      message: "Real asset quote refreshed from Alpha Vantage.",
      asset: result.asset,
      snapshot: normalizeSnapshot(result.snapshot),
    });
  } catch (error: any) {
    return res.status(400).json({
      message: error.message || "Failed to refresh asset price.",
    });
  }
}

export async function refreshAllAssetPrices(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!requireAdminForRealRefresh(req, res)) {
      return;
    }

    const results = await fetchAndStoreAllCurrentQuotePrices();

    const successCount = results.filter((result) => result.success).length;
    const failedCount = results.length - successCount;

    return res.json({
      message: `Real quote refresh completed. Success: ${successCount}, Failed: ${failedCount}.`,
      results,
    });
  } catch (error: any) {
    return res.status(400).json({
      message: error.message || "Failed to refresh asset prices.",
    });
  }
}

export async function simulateOneMarketAsset(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const assetId = getParamAsString(req.params.assetId);

    if (!mongoose.Types.ObjectId.isValid(assetId)) {
      return res.status(400).json({
        message: "Valid assetId is required.",
      });
    }

    const result = await simulateOneAssetPrice(assetId);

    return res.json({
      message: `${result.asset.symbol} simulated: ${result.oldPrice} → ${result.newPrice} (${result.percentChange}%).`,
      ...result,
    });
  } catch (error: any) {
    return res.status(400).json({
      message: error.message || "Failed to simulate asset price.",
    });
  }
}

export async function simulateAllMarketAssets(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const results = await simulateAllAssetPrices();

    const successCount = results.filter((result) => result.success).length;
    const failedCount = results.length - successCount;

    return res.json({
      message: `Market simulation completed. Success: ${successCount}, Failed: ${failedCount}.`,
      results,
    });
  } catch (error: any) {
    return res.status(400).json({
      message: error.message || "Failed to simulate market prices.",
    });
  }
}
export async function tickOneMarketAsset(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const assetId = getParamAsString(req.params.assetId);

    if (!mongoose.Types.ObjectId.isValid(assetId)) {
      return res.status(400).json({
        message: "Valid assetId is required.",
      });
    }

    const result = await tickOneAssetPrice(assetId);

    return res.json({
      message: `${result.asset.symbol} live tick: ${result.oldPrice} → ${result.newPrice} (${result.percentChange}%).`,
      ...result,
    });
  } catch (error: any) {
    return res.status(400).json({
      message: error.message || "Failed to run market tick.",
    });
  }
}

export async function tickAllMarketAssets(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const results = await tickAllAssetPrices();

    const successCount = results.filter((result) => result.success).length;
    const failedCount = results.length - successCount;

    return res.json({
      message: `Live market tick completed. Success: ${successCount}, Failed: ${failedCount}.`,
      results,
    });
  } catch (error: any) {
    return res.status(400).json({
      message: error.message || "Failed to run live market tick.",
    });
  }
}