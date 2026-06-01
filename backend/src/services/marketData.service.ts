import { Asset, IAsset, AssetPriceSnapshot } from "../models";
import { fetchLatestPrice, isFinnhubConfigured } from "./finnhub.service";

/**
 * Bridges the Finnhub client with the Asset collection: pulls real prices and
 * writes them back to `lastFetchedPrice` / `lastFetchedAt`, which the rest of
 * the app already treats as the source of truth for current market price.
 */

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface AssetPriceRefresh {
  symbol: string;
  ok: boolean;
  price?: number;
  source?: string;
  error?: string;
}

export interface RefreshSummary {
  configured: boolean;
  updated: number;
  failed: number;
  results: AssetPriceRefresh[];
}

/**
 * Refresh a single asset document in place (does not save unless `save` true).
 * Returns the new price, or throws if Finnhub has nothing usable.
 */
export async function refreshAssetPrice(
  asset: IAsset,
  options: { save?: boolean } = {}
): Promise<number> {
  const quote = await fetchLatestPrice(asset.symbol, asset.type);
  const price = roundMoney(quote.price);

  asset.lastFetchedPrice = price;
  asset.lastFetchedAt = quote.fetchedAt;

  if (options.save) {
    await asset.save();
  }

  return price;
}

/**
 * Refresh every active asset from Finnhub. Continues past individual failures
 * so a single bad symbol or rate-limit hit does not abort the whole batch.
 *
 * Finnhub's free tier allows ~60 requests/minute, so `delayMs` defaults to 0;
 * bump FINNHUB_REFRESH_DELAY_MS if you ever see 429 responses.
 */
export async function refreshAllAssetPrices(
  options: { delayMs?: number } = {}
): Promise<RefreshSummary> {
  if (!isFinnhubConfigured()) {
    return { configured: false, updated: 0, failed: 0, results: [] };
  }

  const delayMs =
    options.delayMs ?? Number(process.env.FINNHUB_REFRESH_DELAY_MS ?? 0);

  const assets = await Asset.find({ isActive: true }).sort({ symbol: 1 });

  const results: AssetPriceRefresh[] = [];
  let updated = 0;
  let failed = 0;

  for (let index = 0; index < assets.length; index += 1) {
    const asset = assets[index];

    try {
      const quote = await fetchLatestPrice(asset.symbol, asset.type);
      asset.lastFetchedPrice = roundMoney(quote.price);
      asset.lastFetchedAt = quote.fetchedAt;
      await asset.save();

      // Record a price-history point for the dashboard sparkline. Best-effort:
      // a snapshot failure must not fail the price refresh.
      try {
        await AssetPriceSnapshot.create({
          asset: asset._id,
          price: asset.lastFetchedPrice,
        });
      } catch (snapshotError) {
        console.warn(
          `Price snapshot skipped for ${asset.symbol}:`,
          (snapshotError as Error).message
        );
      }

      updated += 1;
      results.push({
        symbol: asset.symbol,
        ok: true,
        price: asset.lastFetchedPrice,
        source: quote.source,
      });
    } catch (error) {
      failed += 1;
      results.push({
        symbol: asset.symbol,
        ok: false,
        error: (error as Error).message,
      });
    }

    if (delayMs > 0 && index < assets.length - 1) {
      await delay(delayMs);
    }
  }

  return { configured: true, updated, failed, results };
}
