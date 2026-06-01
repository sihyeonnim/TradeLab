import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";

import {
  Portfolio,
  PortfolioSnapshot,
  Holding,
  Order,
  Asset,
} from "../models";

function getCurrentUserId(req: Request): string {
  return String((req as any).user._id);
}

function toNumber(value: unknown, fallback = 0): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function getAssetPrice(asset: any): number {
  return toNumber(asset?.lastFetchedPrice, 0);
}

function normalizeAsset(asset: any) {
  if (!asset) {
    return null;
  }

  return {
    id: String(asset._id),
    symbol: asset.symbol,
    name: asset.name,
    exchange: asset.exchange,
    type: asset.type,
    currency: asset.currency,
    lastPrice: getAssetPrice(asset),
    lastFetchedAt: asset.lastFetchedAt ?? null,
  };
}

/**
 * Full portfolio overview for the dedicated portfolio page:
 * current holdings with market value and allocation %, realized and unrealized
 * P/L, and summary figures (REQ-PORT-01, 02, 03, 04).
 */
export async function getPortfolioOverview(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = getCurrentUserId(req);

    const portfolio: any = await Portfolio.findOne({ user: userId }).lean();

    if (!portfolio) {
      return res.json({
        portfolio: null,
        summary: {
          cashBalance: 0,
          holdingsValue: 0,
          totalValue: 0,
          initialCash: 100000,
          realizedPnl: 0,
          unrealizedPnl: 0,
          totalPnl: 0,
          roi: 0,
        },
        holdings: [],
      });
    }

    const holdings: any[] = await Holding.find({ portfolio: portfolio._id })
      .populate("asset")
      .sort({ createdAt: -1 })
      .lean();

    const enrichedHoldings = holdings.map((holding: any) => {
      const asset = holding.asset;
      const quantity = toNumber(holding.quantity, 0);
      const averagePrice = toNumber(holding.averageBuyPrice, 0);
      const lastPrice = getAssetPrice(asset);

      const marketValue = roundMoney(quantity * lastPrice);
      const costBasis = roundMoney(quantity * averagePrice);
      const unrealizedPnl = roundMoney(marketValue - costBasis);
      const unrealizedPnlPercent =
        costBasis > 0 ? roundMoney((unrealizedPnl / costBasis) * 100) : 0;

      return {
        id: String(holding._id),
        asset: normalizeAsset(asset),
        quantity,
        averagePrice,
        lastPrice,
        marketValue,
        costBasis,
        unrealizedPnl,
        unrealizedPnlPercent,
      };
    });

    const cashBalance = roundMoney(toNumber(portfolio.cashBalance, 0));
    const initialCash = toNumber(portfolio.startingCash, 100000);

    const holdingsValue = roundMoney(
      enrichedHoldings.reduce((sum, holding) => sum + holding.marketValue, 0)
    );

    const unrealizedPnl = roundMoney(
      enrichedHoldings.reduce((sum, holding) => sum + holding.unrealizedPnl, 0)
    );

    const realizedPnl = roundMoney(toNumber(portfolio.realizedPnl, 0));
    const totalValue = roundMoney(cashBalance + holdingsValue);
    const totalPnl = roundMoney(realizedPnl + unrealizedPnl);
    const roi =
      initialCash > 0
        ? roundMoney(((totalValue - initialCash) / initialCash) * 100)
        : 0;

    // Allocation %: each holding's share of invested (holdings) value, plus a
    // synthetic "Cash" slice so the pie chart sums to total portfolio value.
    const allocationDenominator = totalValue > 0 ? totalValue : 1;

    const holdingsWithAllocation = enrichedHoldings.map((holding) => ({
      ...holding,
      allocationPercent: roundMoney(
        (holding.marketValue / allocationDenominator) * 100
      ),
    }));

    const allocation = [
      ...holdingsWithAllocation.map((holding) => ({
        label: holding.asset?.symbol || "—",
        value: holding.marketValue,
        percent: holding.allocationPercent,
      })),
      {
        label: "Cash",
        value: cashBalance,
        percent: roundMoney((cashBalance / allocationDenominator) * 100),
      },
    ].filter((slice) => slice.value > 0);

    return res.json({
      portfolio: {
        id: String(portfolio._id),
        cashBalance,
        startingCash: initialCash,
        totalAssetValue: holdingsValue,
        totalEquity: totalValue,
        realizedPnl,
        roi,
      },
      summary: {
        cashBalance,
        holdingsValue,
        totalValue,
        initialCash,
        realizedPnl,
        unrealizedPnl,
        totalPnl,
        roi,
      },
      allocation,
      holdings: holdingsWithAllocation,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Portfolio value time-series for the performance chart (REQ-PORT-07/08).
 * Always includes a synthetic baseline point at the portfolio's starting cash
 * so the chart renders even before the first trade.
 */
export async function getPortfolioHistory(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = getCurrentUserId(req);

    const portfolio: any = await Portfolio.findOne({ user: userId }).lean();

    if (!portfolio) {
      return res.json({ points: [] });
    }

    const initialCash = toNumber(portfolio.startingCash, 100000);

    const snapshots: any[] = await PortfolioSnapshot.find({
      portfolio: portfolio._id,
    })
      .sort({ createdAt: 1 })
      .lean();

    const baseline = {
      timestamp: portfolio.createdAt ?? new Date(),
      totalEquity: roundMoney(initialCash),
      roi: 0,
    };

    const points = [
      baseline,
      ...snapshots.map((snapshot: any) => ({
        timestamp: snapshot.createdAt,
        totalEquity: roundMoney(toNumber(snapshot.totalEquity, initialCash)),
        roi: roundMoney(toNumber(snapshot.roi, 0)),
      })),
    ];

    return res.json({
      initialCash: roundMoney(initialCash),
      points,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Detail for a single asset: the asset itself, the user's current position in
 * it (if any), available buying power, and that asset's trade history. Powers
 * the holding detail page where a user can buy/sell the specific asset.
 */
export async function getHoldingDetail(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = getCurrentUserId(req);
    const assetId = String(req.params.assetId || "");

    if (!assetId || !mongoose.Types.ObjectId.isValid(assetId)) {
      return res.status(400).json({ message: "Valid assetId is required." });
    }

    const asset: any = await Asset.findById(assetId).lean();

    if (!asset) {
      return res.status(404).json({ message: "Asset not found." });
    }

    const portfolio: any = await Portfolio.findOne({ user: userId }).lean();
    const cashBalance = roundMoney(toNumber(portfolio?.cashBalance, 0));

    const lastPrice = getAssetPrice(asset);

    let position: any = null;

    if (portfolio) {
      const holding: any = await Holding.findOne({
        portfolio: portfolio._id,
        asset: asset._id,
      }).lean();

      if (holding) {
        const quantity = toNumber(holding.quantity, 0);
        const averagePrice = toNumber(holding.averageBuyPrice, 0);
        const marketValue = roundMoney(quantity * lastPrice);
        const costBasis = roundMoney(quantity * averagePrice);
        const unrealizedPnl = roundMoney(marketValue - costBasis);
        const unrealizedPnlPercent =
          costBasis > 0 ? roundMoney((unrealizedPnl / costBasis) * 100) : 0;

        position = {
          id: String(holding._id),
          quantity,
          averagePrice,
          marketValue,
          costBasis,
          unrealizedPnl,
          unrealizedPnlPercent,
        };
      }
    }

    const orders: any[] = await Order.find({
      user: userId,
      asset: asset._id,
    })
      .sort({ createdAt: -1 })
      .lean();

    const trades = orders.map((order: any) => {
      const quantity = toNumber(order.quantity, 0);
      const price = toNumber(order.executedPrice ?? order.requestedPrice, 0);

      return {
        id: String(order._id),
        side: order.side,
        orderType: order.type,
        quantity,
        price,
        amount: roundMoney(quantity * price),
        status: order.status,
        failureReason: order.failureReason ?? null,
        createdAt: order.createdAt,
        executedAt: order.executedAt ?? null,
      };
    });

    return res.json({
      asset: normalizeAsset(asset),
      position,
      cashBalance,
      trades,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Complete trade history in reverse-chronological order (REQ-PORT-05).
 * Unlike the dashboard's recent-orders widget, this is not capped at 10.
 */
export async function getTradeHistory(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = getCurrentUserId(req);

    const orders: any[] = await Order.find({ user: userId })
      .populate("asset")
      .sort({ createdAt: -1 })
      .lean();

    const trades = orders.map((order: any) => {
      const quantity = toNumber(order.quantity, 0);
      const price = toNumber(order.executedPrice ?? order.requestedPrice, 0);

      return {
        id: String(order._id),
        asset: normalizeAsset(order.asset),
        side: order.side,
        orderType: order.type,
        quantity,
        price,
        amount: roundMoney(quantity * price),
        status: order.status,
        failureReason: order.failureReason ?? null,
        createdAt: order.createdAt,
        executedAt: order.executedAt ?? null,
      };
    });

    return res.json({ trades });
  } catch (error) {
    next(error);
  }
}
