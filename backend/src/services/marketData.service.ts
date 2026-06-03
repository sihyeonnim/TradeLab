import https from "https";
import mongoose from "mongoose";

import * as AssetModule from "../models/Asset";
import PriceSnapshotModel from "../models/PriceSnapshot";

type AlphaVantagePricePoint = {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

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

function requestJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    https
      .get(url, (response) => {
        let rawData = "";

        response.on("data", (chunk) => {
          rawData += chunk;
        });

        response.on("end", () => {
          try {
            resolve(JSON.parse(rawData));
          } catch {
            reject(new Error("Failed to parse Alpha Vantage response."));
          }
        });
      })
      .on("error", reject);
  });
}

function getApiKey() {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;

  if (!apiKey) {
    throw new Error(
      "Alpha Vantage API key is missing. Set ALPHA_VANTAGE_API_KEY in backend/.env."
    );
  }

  return apiKey;
}

function parseNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
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

function assertAlphaVantageResponse(data: any) {
  if (data.Note) {
    throw new Error(
      "Alpha Vantage API limit was reached. Try again later or refresh fewer assets."
    );
  }

  if (data.Information) {
    throw new Error(String(data.Information));
  }

  if (data["Error Message"]) {
    throw new Error(String(data["Error Message"]));
  }
}

function parseDailyOrWeeklySeries(series: any): AlphaVantagePricePoint[] {
  return Object.keys(series)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
    .map((dateKey) => {
      const item = series[dateKey];

      return {
        timestamp: new Date(`${dateKey}T00:00:00.000Z`),
        open: parseNumber(item["1. open"]),
        high: parseNumber(item["2. high"]),
        low: parseNumber(item["3. low"]),
        close: parseNumber(item["4. close"]),
        volume: parseNumber(item["5. volume"]),
      };
    });
}

function parseIntradaySeries(series: any): AlphaVantagePricePoint[] {
  return Object.keys(series)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
    .map((dateTimeKey) => {
      const item = series[dateTimeKey];

      return {
        timestamp: new Date(`${dateTimeKey.replace(" ", "T")}:00.000Z`),
        open: parseNumber(item["1. open"]),
        high: parseNumber(item["2. high"]),
        low: parseNumber(item["3. low"]),
        close: parseNumber(item["4. close"]),
        volume: parseNumber(item["5. volume"]),
      };
    });
}

export async function fetchAlphaVantageIntradaySeries(
  symbol: string
): Promise<AlphaVantagePricePoint[]> {
  const apiKey = getApiKey();

  const url =
    "https://www.alphavantage.co/query" +
    "?function=TIME_SERIES_INTRADAY" +
    `&symbol=${encodeURIComponent(symbol)}` +
    "&interval=5min" +
    "&outputsize=compact" +
    `&apikey=${encodeURIComponent(apiKey)}`;

  const data = await requestJson(url);

  assertAlphaVantageResponse(data);

  const series = data["Time Series (5min)"];

  if (!series) {
    throw new Error("Alpha Vantage did not return intraday price data.");
  }

  return parseIntradaySeries(series);
}

export async function fetchAlphaVantageDailySeries(
  symbol: string
): Promise<AlphaVantagePricePoint[]> {
  const apiKey = getApiKey();

  const url =
    "https://www.alphavantage.co/query" +
    "?function=TIME_SERIES_DAILY" +
    `&symbol=${encodeURIComponent(symbol)}` +
    "&outputsize=compact" +
    `&apikey=${encodeURIComponent(apiKey)}`;

  const data = await requestJson(url);

  assertAlphaVantageResponse(data);

  const series = data["Time Series (Daily)"];

  if (!series) {
    throw new Error("Alpha Vantage did not return daily price data.");
  }

  return parseDailyOrWeeklySeries(series);
}

export async function fetchAlphaVantageWeeklySeries(
  symbol: string
): Promise<AlphaVantagePricePoint[]> {
  const apiKey = getApiKey();

  const url =
    "https://www.alphavantage.co/query" +
    "?function=TIME_SERIES_WEEKLY" +
    `&symbol=${encodeURIComponent(symbol)}` +
    `&apikey=${encodeURIComponent(apiKey)}`;

  const data = await requestJson(url);

  assertAlphaVantageResponse(data);

  const series = data["Weekly Time Series"];

  if (!series) {
    throw new Error("Alpha Vantage did not return weekly price data.");
  }

  return parseDailyOrWeeklySeries(series);
}

async function storeSnapshots({
  asset,
  symbol,
  points,
  source,
}: {
  asset: any;
  symbol: string;
  points: AlphaVantagePricePoint[];
  source: string;
}) {
  const operations = points.map((point) => ({
    updateOne: {
      filter: {
        asset: asset._id,
        timestamp: point.timestamp,
        source,
      },
      update: {
        $set: {
          asset: asset._id,
          symbol,
          price: point.close,
          open: point.open,
          high: point.high,
          low: point.low,
          close: point.close,
          volume: point.volume,
          source,
          timestamp: point.timestamp,
        },
      },
      upsert: true,
    },
  }));

  if (operations.length) {
    await PriceSnapshotModel.bulkWrite(operations, { ordered: false });
  }

  return operations.length;
}

export async function fetchAndStoreLatestPrice(assetId: string) {
  if (!mongoose.Types.ObjectId.isValid(assetId)) {
    throw new Error("Valid assetId is required.");
  }

  const asset: any = await AssetModel.findById(assetId);

  if (!asset) {
    throw new Error("Asset not found.");
  }

  const symbol = String(asset.symbol || "").toUpperCase();

  if (!symbol) {
    throw new Error("Asset symbol is missing.");
  }

  let intradayStoredCount = 0;
  let dailyStoredCount = 0;
  let weeklyStoredCount = 0;

  let latestPricePoint: AlphaVantagePricePoint | null = null;

  try {
    const intradaySeries = await fetchAlphaVantageIntradaySeries(symbol);
    const intradayPoints = intradaySeries.slice(0, 100);

    intradayStoredCount = await storeSnapshots({
      asset,
      symbol,
      points: intradayPoints,
      source: "ALPHA_VANTAGE_INTRADAY_5MIN",
    });

    if (intradayPoints.length) {
      latestPricePoint = intradayPoints[0];
    }
  } catch {
    intradayStoredCount = 0;
  }

  const dailySeries = await fetchAlphaVantageDailySeries(symbol);

  if (!dailySeries.length) {
    throw new Error("No daily price data found for this asset.");
  }

  const dailyPoints = dailySeries.slice(0, 100);

  dailyStoredCount = await storeSnapshots({
    asset,
    symbol,
    points: dailyPoints,
    source: "ALPHA_VANTAGE_DAILY",
  });

  if (!latestPricePoint && dailyPoints.length) {
    latestPricePoint = dailyPoints[0];
  }

  try {
    const weeklySeries = await fetchAlphaVantageWeeklySeries(symbol);
    const weeklyPoints = weeklySeries.slice(0, 60);

    weeklyStoredCount = await storeSnapshots({
      asset,
      symbol,
      points: weeklyPoints,
      source: "ALPHA_VANTAGE_WEEKLY",
    });
  } catch {
    weeklyStoredCount = 0;
  }

  const latest = latestPricePoint || dailySeries[0];

  if (typeof asset.set === "function") {
    asset.set("lastFetchedPrice", latest.close);
    asset.set("lastPrice", latest.close);
    asset.set("lastFetchedAt", new Date());
  } else {
    asset.lastFetchedPrice = latest.close;
    asset.lastPrice = latest.close;
    asset.lastFetchedAt = new Date();
  }

  await asset.save();

  const latestSnapshot = await PriceSnapshotModel.findOne({
    asset: asset._id,
    timestamp: latest.timestamp,
  }).sort({ createdAt: -1 });

  return {
    asset: normalizeAsset(asset),
    snapshot: latestSnapshot,
    storedCount: intradayStoredCount + dailyStoredCount + weeklyStoredCount,
    intradayStoredCount,
    dailyStoredCount,
    weeklyStoredCount,
  };
}

export async function fetchAndStoreAllAssetPrices() {
  const assets: any[] = await AssetModel.find({
    $or: [{ isActive: true }, { isActive: { $exists: false } }],
  }).sort({ symbol: 1 });

  const results = [];

  for (const asset of assets) {
    try {
      const result = await fetchAndStoreLatestPrice(String(asset._id));

      results.push({
        assetId: String(asset._id),
        symbol: asset.symbol,
        success: true,
        asset: result.asset,
        storedCount: result.storedCount,
        intradayStoredCount: result.intradayStoredCount,
        dailyStoredCount: result.dailyStoredCount,
        weeklyStoredCount: result.weeklyStoredCount,
      });
    } catch (error: any) {
      results.push({
        assetId: String(asset._id),
        symbol: asset.symbol,
        success: false,
        message: error.message || "Failed to refresh asset.",
      });
    }
  }

  return results;
}