import { AssetType } from "../models";

/**
 * Thin client for the Finnhub.io REST API.
 *
 * This module is intentionally free of any database/mongoose concerns so it can
 * be unit-tested and reused. It only knows how to turn an internal asset symbol
 * into a Finnhub symbol and pull a price for it.
 *
 * Docs: https://finnhub.io/docs/api
 * Auth: pass the key as the `token` query parameter.
 * Free tier: ~60 requests/minute.
 */

const FINNHUB_BASE_URL =
  process.env.FINNHUB_BASE_URL?.replace(/\/+$/, "") ||
  "https://finnhub.io/api/v1";

export function getFinnhubApiKey(): string | undefined {
  const key = process.env.FINNHUB_API_KEY?.trim();
  return key ? key : undefined;
}

export function isFinnhubConfigured(): boolean {
  return Boolean(getFinnhubApiKey());
}

/**
 * Map an internal (symbol, type) pair to a Finnhub symbol.
 *
 *   STOCK/ETF  ->  "AAPL", "SPY"            (used as-is)
 *   CRYPTO     ->  "BINANCE:BTCUSDT"        (exchange-prefixed pair vs USDT)
 *
 * If a crypto symbol already contains an exchange prefix (":"), it is used
 * verbatim so you can store e.g. "COINBASE:BTC-USD" directly.
 */
export function toFinnhubSymbol(symbol: string, type: AssetType): string {
  const clean = String(symbol || "").trim().toUpperCase();

  if (type === AssetType.CRYPTO) {
    if (clean.includes(":")) {
      return clean;
    }

    const pair = clean.endsWith("USDT")
      ? clean
      : clean.endsWith("USD")
        ? `${clean}T`
        : `${clean}USDT`;

    return `BINANCE:${pair}`;
  }

  return clean;
}

/**
 * Map an internal crypto symbol to a Binance spot trading pair (e.g. "BTC" ->
 * "BTCUSDT"). Binance's public ticker API is keyless and free, so we use it for
 * crypto prices instead of Finnhub's paid /crypto/candle endpoint.
 *
 * Accepts inputs that may already be a pair ("BTCUSDT") or carry a Finnhub-style
 * exchange prefix ("BINANCE:BTCUSDT"), which is stripped.
 */
export function toBinanceSymbol(symbol: string): string {
  let clean = String(symbol || "").trim().toUpperCase();

  if (clean.includes(":")) {
    clean = clean.slice(clean.indexOf(":") + 1);
  }

  if (clean.endsWith("USDT")) {
    return clean;
  }

  if (clean.endsWith("USD")) {
    return `${clean}T`;
  }

  return `${clean}USDT`;
}

export interface MarketQuote {
  symbol: string;
  providerSymbol: string;
  price: number;
  fetchedAt: Date;
  source: string;
}

async function finnhubGet(path: string): Promise<any> {
  const apiKey = getFinnhubApiKey();

  if (!apiKey) {
    throw new Error("FINNHUB_API_KEY is not configured.");
  }

  const separator = path.includes("?") ? "&" : "?";
  const url = `${FINNHUB_BASE_URL}${path}${separator}token=${encodeURIComponent(
    apiKey
  )}`;

  const response = await fetch(url);

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const detail = body ? `: ${body.slice(0, 200)}` : "";
    throw new Error(`Finnhub request failed (${response.status})${detail}`);
  }

  const data = await response.json();

  // Finnhub returns 200 with an { error } body for some failures.
  if (data && typeof data === "object" && data.error) {
    throw new Error(`Finnhub error: ${data.error}`);
  }

  return data;
}

function firstFinitePositive(...values: unknown[]): number | null {
  for (const value of values) {
    const numberValue = Number(value);
    if (Number.isFinite(numberValue) && numberValue > 0) {
      return numberValue;
    }
  }

  return null;
}

/**
 * Real-time quote for a stock or ETF via the /quote endpoint.
 * Response: { c: current, d, dp, h, l, o, pc: prevClose, t: unixSeconds }.
 * Falls back to previous close if the current price is momentarily 0.
 */
export async function fetchStockQuote(
  symbol: string,
  type: AssetType
): Promise<MarketQuote> {
  const providerSymbol = toFinnhubSymbol(symbol, type);
  const data = await finnhubGet(
    `/quote?symbol=${encodeURIComponent(providerSymbol)}`
  );

  const price = firstFinitePositive(data?.c, data?.pc);

  if (price === null) {
    throw new Error(`Finnhub returned no quote for ${providerSymbol}.`);
  }

  const fetchedAt =
    Number.isFinite(Number(data?.t)) && Number(data?.t) > 0
      ? new Date(Number(data.t) * 1000)
      : new Date();

  return {
    symbol: String(symbol).toUpperCase(),
    providerSymbol,
    price,
    fetchedAt,
    source: "finnhub:quote",
  };
}

const BINANCE_BASE_URL =
  process.env.BINANCE_BASE_URL?.replace(/\/+$/, "") ||
  "https://api.binance.com";

/**
 * Latest crypto price via Binance's free, keyless public ticker endpoint.
 *
 *   GET /api/v3/ticker/price?symbol=BTCUSDT  ->  { symbol, price }
 *
 * This replaces Finnhub's /crypto/candle endpoint, which requires a paid plan
 * on most accounts. No API key is needed; Binance allows generous anonymous
 * request rates for this endpoint.
 */
export async function fetchCryptoPrice(
  symbol: string,
  _type: AssetType
): Promise<MarketQuote> {
  const providerSymbol = toBinanceSymbol(symbol);
  const url = `${BINANCE_BASE_URL}/api/v3/ticker/price?symbol=${encodeURIComponent(
    providerSymbol
  )}`;

  const response = await fetch(url);

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const detail = body ? `: ${body.slice(0, 200)}` : "";
    throw new Error(`Binance request failed (${response.status})${detail}`);
  }

  const data = await response.json();
  const price = firstFinitePositive(data?.price);

  if (price === null) {
    throw new Error(`Binance returned no price for ${providerSymbol}.`);
  }

  return {
    symbol: String(symbol).toUpperCase(),
    providerSymbol,
    price,
    fetchedAt: new Date(),
    source: "binance:ticker",
  };
}

/**
 * Latest price for any supported asset type. Routes stocks/ETFs to the realtime
 * quote endpoint and crypto to the candle endpoint.
 */
export async function fetchLatestPrice(
  symbol: string,
  type: AssetType
): Promise<MarketQuote> {
  if (type === AssetType.CRYPTO) {
    return fetchCryptoPrice(symbol, type);
  }

  return fetchStockQuote(symbol, type);
}
