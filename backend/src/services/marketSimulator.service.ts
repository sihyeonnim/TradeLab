import mongoose from "mongoose";

import { Asset, Holding, Portfolio } from "../models";
import PriceSnapshotModel from "../models/PriceSnapshot";

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
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

async function updateAllPortfolioSummaries() {
  const portfolios: any[] = await Portfolio.find({});

  const updated = [];

  for (const portfolio of portfolios) {
    const holdings: any[] = await Holding.find({
      portfolio: portfolio._id,
    }).populate("asset");

    const totalAssetValue = roundMoney(
      holdings.reduce((sum, holding: any) => {
        const quantity = toNumber(holding.quantity, 0);
        const currentPrice = toNumber(holding.asset?.lastFetchedPrice, 0);
        return sum + quantity * currentPrice;
      }, 0)
    );

    const cashBalance = roundMoney(toNumber(portfolio.cashBalance, 0));
    const totalEquity = roundMoney(cashBalance + totalAssetValue);
    const startingCash = toNumber(portfolio.startingCash, 100000);
    const roi =
      startingCash > 0
        ? roundMoney(((totalEquity - startingCash) / startingCash) * 100)
        : 0;

    portfolio.cashBalance = cashBalance;
    portfolio.totalAssetValue = totalAssetValue;
    portfolio.totalEquity = totalEquity;
    portfolio.roi = roi;

    await portfolio.save();

    updated.push({
      portfolioId: String(portfolio._id),
      user: String(portfolio.user),
      cashBalance,
      totalAssetValue,
      totalEquity,
      roi,
    });
  }

  return updated;
}

function buildDailySimulatorPoints({
  asset,
  symbol,
  latestPrice,
  days,
}: {
  asset: any;
  symbol: string;
  latestPrice: number;
  days: number;
}) {
  const points = [];

  let simulatedPrice = Math.max(
    1,
    latestPrice * randomBetween(0.82, 1.18)
  );

  const now = new Date();

  for (let i = days - 1; i >= 0; i -= 1) {
    const timestamp = new Date(now);
    timestamp.setDate(now.getDate() - i);
    timestamp.setHours(0, 0, 0, 0);

    const progress = (days - i) / days;
    const targetWeight = progress * 0.08;
    const driftTowardLatest = (latestPrice - simulatedPrice) * targetWeight;
    const randomMove = simulatedPrice * randomBetween(-0.018, 0.018);

    simulatedPrice = Math.max(1, simulatedPrice + driftTowardLatest + randomMove);

    if (i === 0) {
      simulatedPrice = latestPrice;
    }

    const open = roundMoney(simulatedPrice * randomBetween(0.992, 1.008));
    const close = roundMoney(simulatedPrice);
    const high = roundMoney(Math.max(open, close) * randomBetween(1.001, 1.02));
    const low = roundMoney(Math.min(open, close) * randomBetween(0.98, 0.999));

    points.push({
      asset: asset._id,
      symbol,
      price: close,
      open,
      high,
      low,
      close,
      volume: Math.floor(randomBetween(800000, 8000000)),
      source: "LOCAL_SIMULATOR_DAILY",
      timestamp,
    });
  }

  return points;
}

function buildIntradaySimulatorPoints({
  asset,
  symbol,
  startPrice,
  latestPrice,
}: {
  asset: any;
  symbol: string;
  startPrice: number;
  latestPrice: number;
}) {
  const points = [];
  const now = new Date();

  let simulatedPrice = startPrice;

  for (let i = 77; i >= 0; i -= 1) {
    const timestamp = new Date(now);
    timestamp.setMinutes(now.getMinutes() - i * 5);
    timestamp.setSeconds(0, 0);

    const progress = (78 - i) / 78;
    const driftTowardLatest = (latestPrice - simulatedPrice) * progress * 0.12;
    const randomMove = simulatedPrice * randomBetween(-0.004, 0.004);

    simulatedPrice = Math.max(1, simulatedPrice + driftTowardLatest + randomMove);

    if (i === 0) {
      simulatedPrice = latestPrice;
    }

    const open = roundMoney(simulatedPrice * randomBetween(0.998, 1.002));
    const close = roundMoney(simulatedPrice);
    const high = roundMoney(Math.max(open, close) * randomBetween(1.0005, 1.006));
    const low = roundMoney(Math.min(open, close) * randomBetween(0.994, 0.9995));

    points.push({
      asset: asset._id,
      symbol,
      price: close,
      open,
      high,
      low,
      close,
      volume: Math.floor(randomBetween(20000, 250000)),
      source: "LOCAL_SIMULATOR_INTRADAY",
      timestamp,
    });
  }

  return points;
}

async function storeSimulatorSnapshots(points: any[]) {
  if (!points.length) {
    return 0;
  }

  const operations = points.map((point) => ({
    updateOne: {
      filter: {
        asset: point.asset,
        timestamp: point.timestamp,
        source: point.source,
      },
      update: {
        $set: point,
      },
      upsert: true,
    },
  }));

  await PriceSnapshotModel.bulkWrite(operations, { ordered: false });

  return operations.length;
}

export async function simulateOneAssetPrice(assetId: string) {
  if (!mongoose.Types.ObjectId.isValid(assetId)) {
    throw new Error("Valid assetId is required.");
  }

  const asset: any = await Asset.findById(assetId);

  if (!asset) {
    throw new Error("Asset not found.");
  }

  const symbol = String(asset.symbol || "").toUpperCase();
  const currentPrice = toNumber(asset.lastFetchedPrice, 100);

  const percentChange = randomBetween(-2.5, 2.5);
  const latestPrice = roundMoney(
    Math.max(1, currentPrice * (1 + percentChange / 100))
  );

  const dailyPoints = buildDailySimulatorPoints({
    asset,
    symbol,
    latestPrice,
    days: 260,
  });

  const intradayPoints = buildIntradaySimulatorPoints({
    asset,
    symbol,
    startPrice: currentPrice,
    latestPrice,
  });

  const storedCount = await storeSimulatorSnapshots([
    ...dailyPoints,
    ...intradayPoints,
  ]);

  asset.lastFetchedPrice = latestPrice;
  asset.lastFetchedAt = new Date();
  await asset.save();

  const updatedPortfolios = await updateAllPortfolioSummaries();

  return {
    asset: normalizeAsset(asset),
    oldPrice: roundMoney(currentPrice),
    newPrice: latestPrice,
    percentChange: roundMoney(percentChange),
    storedCount,
    updatedPortfolioCount: updatedPortfolios.length,
  };
}

export async function simulateAllAssetPrices() {
  const assets: any[] = await Asset.find({
    $or: [{ isActive: true }, { isActive: { $exists: false } }],
  }).sort({ symbol: 1 });

  const results = [];

  for (const asset of assets) {
    try {
      const result = await simulateOneAssetPrice(String(asset._id));

      results.push({
        success: true,
        assetId: String(asset._id),
        symbol: asset.symbol,
        ...result,
      });
    } catch (error: any) {
      results.push({
        success: false,
        assetId: String(asset._id),
        symbol: asset.symbol,
        message: error.message || "Simulation failed.",
      });
    }
  }

  return results;
}

export async function tickOneAssetPrice(assetId: string) {
  if (!mongoose.Types.ObjectId.isValid(assetId)) {
    throw new Error("Valid assetId is required.");
  }

  const asset: any = await Asset.findById(assetId);

  if (!asset) {
    throw new Error("Asset not found.");
  }

  const symbol = String(asset.symbol || "").toUpperCase();
  const currentPrice = toNumber(asset.lastFetchedPrice ?? asset.lastPrice, 100);

  const percentChange = randomBetween(-0.8, 0.8);
  const latestPrice = roundMoney(
    Math.max(1, currentPrice * (1 + percentChange / 100))
  );

  const timestamp = new Date();
  timestamp.setSeconds(0, 0);

  await PriceSnapshotModel.findOneAndUpdate(
    {
      asset: asset._id,
      timestamp,
      source: "LOCAL_SIMULATOR_LIVE",
    },
    {
      $set: {
        asset: asset._id,
        symbol,
        price: latestPrice,
        open: currentPrice,
        high: roundMoney(Math.max(currentPrice, latestPrice) * 1.003),
        low: roundMoney(Math.min(currentPrice, latestPrice) * 0.997),
        close: latestPrice,
        volume: Math.floor(randomBetween(10000, 300000)),
        source: "LOCAL_SIMULATOR_LIVE",
        timestamp,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );

  if (typeof asset.set === "function") {
    asset.set("lastFetchedPrice", latestPrice);
    asset.set("lastPrice", latestPrice);
    asset.set("lastFetchedAt", new Date());
  } else {
    asset.lastFetchedPrice = latestPrice;
    asset.lastPrice = latestPrice;
    asset.lastFetchedAt = new Date();
  }

  await asset.save();

  const updatedPortfolios = await updateAllPortfolioSummaries();

  return {
    asset: normalizeAsset(asset),
    oldPrice: roundMoney(currentPrice),
    newPrice: latestPrice,
    percentChange: roundMoney(percentChange),
    updatedPortfolioCount: updatedPortfolios.length,
  };
}

export async function tickAllAssetPrices() {
  const assets: any[] = await Asset.find({
    $or: [{ isActive: true }, { isActive: { $exists: false } }],
  }).sort({ symbol: 1 });

  const results = [];

  for (const asset of assets) {
    try {
      const result = await tickOneAssetPrice(String(asset._id));

      results.push({
        success: true,
        assetId: String(asset._id),
        symbol: asset.symbol,
        ...result,
      });
    } catch (error: any) {
      results.push({
        success: false,
        assetId: String(asset._id),
        symbol: asset.symbol,
        message: error.message || "Market tick failed.",
      });
    }
  }

  return results;
}