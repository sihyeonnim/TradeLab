import { Request, Response, NextFunction } from "express";

import {
  User,
  Portfolio,
  Holding,
  Order,
  Asset,
  Course,
  Competition,
  CompetitionParticipant,
} from "../models";

function getCurrentUserId(req: Request): string {
  return String((req as any).user._id);
}

function toNumber(value: unknown, fallback = 0): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
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
    isActive: Boolean(asset.isActive),
  };
}

export async function getAssets(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const assets = await Asset.find({ isActive: true })
      .sort({ symbol: 1 })
      .lean();

    return res.json({
      assets: assets.map(normalizeAsset),
    });
  } catch (error) {
    next(error);
  }
}

export async function getMyPortfolio(
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
          roi: 0,
        },
        holdings: [],
      });
    }

    const holdings: any[] = await Holding.find({ portfolio: portfolio._id })
      .populate("asset")
      .sort({ createdAt: -1 })
      .lean();

    const normalizedHoldings = holdings.map((holding: any) => {
      const asset = holding.asset;
      const quantity = toNumber(holding.quantity, 0);
      const averagePrice = toNumber(holding.averageBuyPrice, 0);
      const lastPrice = getAssetPrice(asset);

      const marketValue = quantity * lastPrice;
      const costBasis = quantity * averagePrice;
      const unrealizedPnl = marketValue - costBasis;

      return {
        id: String(holding._id),
        asset: normalizeAsset(asset),
        quantity,
        averagePrice,
        lastPrice,
        marketValue,
        costBasis,
        unrealizedPnl,
      };
    });

    const cashBalance = toNumber(portfolio.cashBalance, 0);
    const initialCash = toNumber(portfolio.startingCash, 100000);

    const holdingsValue = normalizedHoldings.reduce(
      (sum, holding) => sum + holding.marketValue,
      0
    );

    const totalValue = cashBalance + holdingsValue;
    const roi =
      initialCash > 0 ? ((totalValue - initialCash) / initialCash) * 100 : 0;

    return res.json({
      portfolio: {
        id: String(portfolio._id),
        cashBalance,
        startingCash: initialCash,
        totalAssetValue: holdingsValue,
        totalEquity: totalValue,
        roi,
      },
      summary: {
        cashBalance,
        holdingsValue,
        totalValue,
        initialCash,
        roi,
      },
      holdings: normalizedHoldings,
    });
  } catch (error) {
    next(error);
  }
}

export async function getMyOrders(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = getCurrentUserId(req);

    const orders: any[] = await Order.find({ user: userId })
      .populate("asset")
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const normalizedOrders = orders.map((order: any) => ({
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
    }));

    return res.json({
      orders: normalizedOrders,
    });
  } catch (error) {
    next(error);
  }
}

export async function getCourses(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const courses: any[] = await Course.find({})
      .sort({ createdAt: -1 })
      .lean();

    const approvedCourses = courses.filter((course: any) => {
      if (typeof course.isApproved === "boolean") {
        return course.isApproved;
      }

      if (typeof course.approved === "boolean") {
        return course.approved;
      }

      if (typeof course.status === "string") {
        return course.status.toUpperCase() === "APPROVED";
      }

      return true;
    });

    const instructorIds = Array.from(
      new Set(
        approvedCourses
          .map((course: any) =>
            String(course.instructor ?? course.instructorId ?? course.createdBy ?? "")
          )
          .filter(Boolean)
      )
    );

    const instructors: any[] = await User.find({
      _id: {
        $in: instructorIds,
      },
    })
      .select("name email role")
      .lean();

    const instructorMap = new Map(
      instructors.map((instructor: any) => [
        String(instructor._id),
        {
          id: String(instructor._id),
          name: instructor.name,
          email: instructor.email,
          role: instructor.role,
        },
      ])
    );

    const normalizedCourses = approvedCourses.map((course: any) => {
      const instructorId = String(
        course.instructor ?? course.instructorId ?? course.createdBy ?? ""
      );

      return {
        id: String(course._id),
        title: course.title,
        description: course.description,
        level: course.level,
        category: course.category,
        status: course.status ?? (course.isApproved ? "APPROVED" : "UNKNOWN"),
        instructor: instructorMap.get(instructorId) ?? null,
        createdAt: course.createdAt,
      };
    });

    return res.json({
      courses: normalizedCourses,
    });
  } catch (error) {
    next(error);
  }
}

export async function getCurrentCompetition(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const now = new Date();

    const competitionFilter: any = {
      $or: [
        { status: "ACTIVE" },
        { status: "ONGOING" },
        {
          startDate: { $lte: now },
          endDate: { $gte: now },
        },
      ],
    };

    let competition: any = await (Competition as any)
      .findOne(competitionFilter)
      .sort({ startDate: -1, createdAt: -1 })
      .lean();

    if (!competition) {
      competition = await (Competition as any)
        .findOne({})
        .sort({ startDate: -1, createdAt: -1 })
        .lean();
    }

    if (!competition) {
      return res.json({
        competition: null,
        leaderboard: [],
      });
    }

    const participantFilter: any = {
      $or: [
        { competition: competition._id },
        { competitionId: competition._id },
      ],
    };

    const participants: any[] = await (CompetitionParticipant as any)
      .find(participantFilter)
      .sort({ roi: -1, returnRate: -1, totalValue: -1 })
      .limit(10)
      .lean();

    const userIds = Array.from(
      new Set(
        participants
          .map((participant: any) =>
            String(participant.user ?? participant.userId ?? "")
          )
          .filter(Boolean)
      )
    );

    const users: any[] = await (User as any)
      .find({
        _id: {
          $in: userIds,
        },
      })
      .select("name email role")
      .lean();

    const userMap = new Map(
      users.map((user: any) => [
        String(user._id),
        {
          id: String(user._id),
          name: user.name,
          email: user.email,
          role: user.role,
        },
      ])
    );

    const leaderboard = participants
      .map((participant: any) => {
        const initialValue = toNumber(participant.initialValue, 100000);
        const totalValue = toNumber(
          participant.totalValue ??
            participant.currentValue ??
            participant.portfolioValue,
          initialValue
        );

        const roi =
          participant.roi !== undefined
            ? toNumber(participant.roi, 0)
            : participant.returnRate !== undefined
              ? toNumber(participant.returnRate, 0)
              : initialValue > 0
                ? ((totalValue - initialValue) / initialValue) * 100
                : 0;

        const userId = String(participant.user ?? participant.userId ?? "");

        return {
          id: String(participant._id),
          user: userMap.get(userId) ?? null,
          totalValue,
          roi,
        };
      })
      .sort((a, b) => b.roi - a.roi)
      .map((participant, index) => ({
        rank: index + 1,
        ...participant,
      }));

    return res.json({
      competition: {
        id: String(competition._id),
        title: competition.title ?? competition.name,
        name: competition.name ?? competition.title,
        description: competition.description,
        status: competition.status,
        startDate: competition.startDate,
        endDate: competition.endDate,
      },
      leaderboard,
    });
  } catch (error) {
    next(error);
  }
}