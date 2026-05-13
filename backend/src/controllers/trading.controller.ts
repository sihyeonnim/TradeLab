import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";

import {
  Portfolio,
  Holding,
  Order,
  OrderSide,
  OrderType,
  OrderStatus,
  Asset,
  ActivityLog,
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

function normalizeSide(side: unknown): OrderSide | null {
  const normalized = String(side || "").trim().toUpperCase();

  if (normalized === OrderSide.BUY) {
    return OrderSide.BUY;
  }

  if (normalized === OrderSide.SELL) {
    return OrderSide.SELL;
  }

  return null;
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
    lastPrice: toNumber(asset.lastFetchedPrice, 0),
    lastFetchedAt: asset.lastFetchedAt ?? null,
    isActive: Boolean(asset.isActive),
  };
}

function normalizeHolding(holding: any) {
  if (!holding) {
    return null;
  }

  return {
    id: String(holding._id),
    portfolio: String(holding.portfolio),
    asset: normalizeAsset(holding.asset),
    quantity: toNumber(holding.quantity, 0),
    averageBuyPrice: toNumber(holding.averageBuyPrice, 0),
  };
}

function normalizeOrder(order: any) {
  return {
    id: String(order._id),
    asset: normalizeAsset(order.asset),
    side: order.side,
    orderType: order.type,
    quantity: toNumber(order.quantity, 0),
    requestedPrice: toNumber(order.requestedPrice, 0),
    price: toNumber(order.executedPrice ?? order.requestedPrice, 0),
    executedPrice: toNumber(order.executedPrice, 0),
    status: order.status,
    failureReason: order.failureReason ?? null,
    createdAt: order.createdAt,
    executedAt: order.executedAt ?? null,
  };
}

async function calculatePortfolioAssetValue(portfolioId: mongoose.Types.ObjectId) {
  const holdings: any[] = await Holding.find({ portfolio: portfolioId })
    .populate("asset")
    .lean();

  return holdings.reduce((sum, holding: any) => {
    const quantity = toNumber(holding.quantity, 0);
    const lastPrice = toNumber(holding.asset?.lastFetchedPrice, 0);
    return sum + quantity * lastPrice;
  }, 0);
}

async function updatePortfolioSummary(portfolio: any) {
  const totalAssetValue = roundMoney(
    await calculatePortfolioAssetValue(portfolio._id)
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

  return {
    cashBalance,
    holdingsValue: totalAssetValue,
    totalAssetValue,
    totalValue: totalEquity,
    totalEquity,
    initialCash: startingCash,
    startingCash,
    roi,
  };
}

async function safeCreateActivityLog({
  userId,
  action,
  message,
  metadata,
}: {
  userId: string;
  action: string;
  message: string;
  metadata: Record<string, unknown>;
}) {
  try {
    if (!ActivityLog) {
      return;
    }

    await (ActivityLog as any).create({
      user: userId,
      action,
      message,
      metadata,
    });
  } catch (error) {
    console.warn("ActivityLog skipped:", (error as Error).message);
  }
}

export async function createMarketOrder(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = getCurrentUserId(req);
    const { assetId } = req.body;
    const side = normalizeSide(req.body.side);
    const quantity = toNumber(req.body.quantity, 0);

    if (!assetId || !mongoose.Types.ObjectId.isValid(assetId)) {
      return res.status(400).json({
        message: "Valid assetId is required.",
      });
    }

    if (!side) {
      return res.status(400).json({
        message: "side must be BUY or SELL.",
      });
    }

    if (quantity <= 0) {
      return res.status(400).json({
        message: "quantity must be greater than 0.",
      });
    }

    const portfolio: any = await Portfolio.findOne({ user: userId });

    if (!portfolio) {
      return res.status(404).json({
        message: "Portfolio not found for current user.",
      });
    }

    const asset: any = await Asset.findOne({
      _id: assetId,
      isActive: true,
    });

    if (!asset) {
      return res.status(404).json({
        message: "Asset not found or inactive.",
      });
    }

    const executionPrice = roundMoney(toNumber(asset.lastFetchedPrice, 0));

    if (executionPrice <= 0) {
      return res.status(400).json({
        message: "Asset does not have a valid last fetched price.",
      });
    }

    const grossAmount = roundMoney(quantity * executionPrice);
    const now = new Date();

    let holding: any = await Holding.findOne({
      portfolio: portfolio._id,
      asset: asset._id,
    });

    let updatedHolding: any = null;

    if (side === OrderSide.BUY) {
      const cashBalance = toNumber(portfolio.cashBalance, 0);

      if (cashBalance < grossAmount) {
        await Order.create({
          user: userId,
          portfolio: portfolio._id,
          asset: asset._id,
          side,
          type: OrderType.MARKET,
          status: OrderStatus.FAILED,
          quantity,
          requestedPrice: executionPrice,
          failureReason: "Insufficient cash balance.",
        });

        return res.status(400).json({
          message: "Insufficient cash balance.",
        });
      }

      portfolio.cashBalance = roundMoney(cashBalance - grossAmount);

      if (holding) {
        const oldQuantity = toNumber(holding.quantity, 0);
        const oldAverageBuyPrice = toNumber(holding.averageBuyPrice, 0);
        const newQuantity = oldQuantity + quantity;

        const newAverageBuyPrice =
          newQuantity > 0
            ? roundMoney(
                (oldQuantity * oldAverageBuyPrice + quantity * executionPrice) /
                  newQuantity
              )
            : executionPrice;

        holding.quantity = newQuantity;
        holding.averageBuyPrice = newAverageBuyPrice;
        updatedHolding = await holding.save();
      } else {
        updatedHolding = await Holding.create({
          portfolio: portfolio._id,
          asset: asset._id,
          quantity,
          averageBuyPrice: executionPrice,
        });
      }
    }

    if (side === OrderSide.SELL) {
      if (!holding || toNumber(holding.quantity, 0) < quantity) {
        await Order.create({
          user: userId,
          portfolio: portfolio._id,
          asset: asset._id,
          side,
          type: OrderType.MARKET,
          status: OrderStatus.FAILED,
          quantity,
          requestedPrice: executionPrice,
          failureReason: "Insufficient holding quantity.",
        });

        return res.status(400).json({
          message: "Insufficient holding quantity.",
        });
      }

      portfolio.cashBalance = roundMoney(
        toNumber(portfolio.cashBalance, 0) + grossAmount
      );

      const remainingQuantity = roundMoney(toNumber(holding.quantity, 0) - quantity);

      if (remainingQuantity <= 0) {
        await Holding.deleteOne({ _id: holding._id });
        updatedHolding = null;
      } else {
        holding.quantity = remainingQuantity;
        updatedHolding = await holding.save();
      }
    }

    const order: any = await Order.create({
      user: userId,
      portfolio: portfolio._id,
      asset: asset._id,
      side,
      type: OrderType.MARKET,
      status: OrderStatus.EXECUTED,
      quantity,
      requestedPrice: executionPrice,
      executedPrice: executionPrice,
      executedAt: now,
    });

    const summary = await updatePortfolioSummary(portfolio);

    await safeCreateActivityLog({
      userId,
      action: "MARKET_ORDER_EXECUTED",
      message: `${side} ${quantity} ${asset.symbol} at $${executionPrice}`,
      metadata: {
        orderId: String(order._id),
        assetId: String(asset._id),
        symbol: asset.symbol,
        side,
        quantity,
        executionPrice,
        grossAmount,
      },
    });

    const populatedOrder = await Order.findById(order._id)
      .populate("asset")
      .lean();

    const populatedHolding =
      updatedHolding && updatedHolding._id
        ? await Holding.findById(updatedHolding._id).populate("asset").lean()
        : null;

    return res.status(201).json({
      message: `Market ${side.toLowerCase()} order executed successfully.`,
      order: normalizeOrder(populatedOrder),
      summary,
      holding: normalizeHolding(populatedHolding),
    });
  } catch (error) {
    next(error);
  }
}