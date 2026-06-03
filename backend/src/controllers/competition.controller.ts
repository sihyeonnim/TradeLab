import { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";

import {
  Competition,
  CompetitionParticipant,
  CompetitionRankingMetric,
  CompetitionStatus,
  Portfolio,
  User,
} from "../models";

function getCurrentUser(req: Request): any {
  return (req as any).user;
}

function getParamAsString(value: unknown) {
  if (Array.isArray(value)) {
    return String(value[0] || "");
  }

  return String(value || "");
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);

  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return parsed;
}

function calculateCompetitionStatus(startsAt: Date, endsAt: Date) {
  const now = new Date();

  if (now < startsAt) {
    return CompetitionStatus.UPCOMING;
  }

  if (now > endsAt) {
    return CompetitionStatus.ENDED;
  }

  return CompetitionStatus.ACTIVE;
}

function normalizeUser(user: any) {
  if (!user) {
    return null;
  }

  const doc = typeof user.toObject === "function" ? user.toObject() : user;

  return {
    id: String(doc._id || doc.id),
    name: doc.name,
    displayName: doc.displayName || doc.name,
    email: doc.email,
    role: doc.role,
  };
}

function normalizeCompetition(competition: any, extra: any = {}) {
  if (!competition) {
    return null;
  }

  const doc =
    typeof competition.toObject === "function"
      ? competition.toObject()
      : competition;

  const startsAt = doc.startsAt || doc.startDate;
  const endsAt = doc.endsAt || doc.endDate;

  return {
    id: String(doc._id || doc.id),
    title: doc.title || doc.name,
    name: doc.name || doc.title,
    description: doc.description || "",
    season: doc.season || "",
    startsAt,
    startDate: startsAt,
    endsAt,
    endDate: endsAt,
    status: doc.status,
    isDefault: Boolean(doc.isDefault),
    rankingMetric:
      doc.rankingMetric || CompetitionRankingMetric.TOTAL_PORTFOLIO_ROI,
    targetAsset: doc.targetAsset || null,
    createdBy: normalizeUser(doc.createdBy),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    ...extra,
  };
}

function normalizeParticipant(participant: any, extra: any = {}) {
  if (!participant) {
    return null;
  }

  const doc =
    typeof participant.toObject === "function"
      ? participant.toObject()
      : participant;

  const startingPortfolioValue = toNumber(
    doc.startingPortfolioValue ?? doc.startingEquity,
    100000
  );
  const currentPortfolioValue = toNumber(
    doc.currentPortfolioValue ?? doc.currentEquity,
    startingPortfolioValue
  );

  return {
    id: String(doc._id || doc.id),
    competition: String(doc.competition?._id || doc.competition),
    user: normalizeUser(doc.user),
    portfolio: String(doc.portfolio?._id || doc.portfolio),
    startingPortfolioValue,
    currentPortfolioValue,
    startingEquity: startingPortfolioValue,
    currentEquity: currentPortfolioValue,
    profit: toNumber(
      doc.profit,
      currentPortfolioValue - startingPortfolioValue
    ),
    roi: toNumber(doc.roi, 0),
    rank: doc.rank || null,
    joinedAt: doc.joinedAt,
    ...extra,
  };
}

async function getPortfolioForUser(userId: string) {
  return Portfolio.findOne({ user: userId });
}

function calculatePortfolioValue(portfolio: any) {
  if (!portfolio) {
    return 100000;
  }

  const totalEquity = toNumber(portfolio.totalEquity, NaN);

  if (!Number.isNaN(totalEquity) && totalEquity > 0) {
    return totalEquity;
  }

  const cashBalance = toNumber(portfolio.cashBalance, 0);
  const totalAssetValue = toNumber(portfolio.totalAssetValue, 0);

  const calculated = cashBalance + totalAssetValue;

  if (calculated > 0) {
    return calculated;
  }

  return cashBalance || 100000;
}

async function recalculateLeaderboard(competitionId: string) {
  const participants: any[] = await CompetitionParticipant.find({
    competition: competitionId,
  })
    .populate("user", "name email role")
    .sort({ joinedAt: 1 });

  const recalculated = [];

  for (const participant of participants) {
    const portfolio =
      (await Portfolio.findById(participant.portfolio)) ||
      (await Portfolio.findOne({ user: participant.user?._id || participant.user }));

    const currentPortfolioValue = calculatePortfolioValue(portfolio);

    const startingPortfolioValue = toNumber(
      participant.startingPortfolioValue ?? participant.startingEquity,
      currentPortfolioValue
    );

    const profit = currentPortfolioValue - startingPortfolioValue;
    const roi =
      startingPortfolioValue > 0
        ? (profit / startingPortfolioValue) * 100
        : 0;

    participant.currentPortfolioValue = currentPortfolioValue;
    participant.currentEquity = currentPortfolioValue;
    participant.startingPortfolioValue = startingPortfolioValue;
    participant.startingEquity = startingPortfolioValue;
    participant.profit = profit;
    participant.roi = roi;

    recalculated.push(participant);
  }

  recalculated.sort((a, b) => {
    const roiDiff = toNumber(b.roi, 0) - toNumber(a.roi, 0);

    if (roiDiff !== 0) {
      return roiDiff;
    }

    return toNumber(b.profit, 0) - toNumber(a.profit, 0);
  });

  for (let index = 0; index < recalculated.length; index += 1) {
    recalculated[index].rank = index + 1;
    await recalculated[index].save();
  }

  return recalculated.map((participant) => normalizeParticipant(participant));
}

export async function listCompetitions(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const now = new Date();

    const competitions = await Competition.find({
      $or: [
        { status: CompetitionStatus.ACTIVE },
        { status: CompetitionStatus.UPCOMING },
        { endsAt: { $gte: now } },
      ],
    })
      .populate("createdBy", "name email role")
      .sort({ startsAt: 1, createdAt: -1 });

    return res.json({
      competitions: competitions.map((competition) =>
        normalizeCompetition(competition)
      ),
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

    let competition: any = await Competition.findOne({
      $or: [
        { status: CompetitionStatus.ACTIVE },
        {
          startsAt: { $lte: now },
          endsAt: { $gte: now },
        },
      ],
    })
      .populate("createdBy", "name email role")
      .sort({ isDefault: -1, startsAt: -1, createdAt: -1 });

    if (!competition) {
      competition = await Competition.findOne({})
        .populate("createdBy", "name email role")
        .sort({ isDefault: -1, startsAt: -1, createdAt: -1 });
    }

    if (!competition) {
      return res.json({
        competition: null,
        leaderboard: [],
      });
    }

    const leaderboard = await recalculateLeaderboard(String(competition._id));

    return res.json({
      competition: normalizeCompetition(competition),
      leaderboard: leaderboard.slice(0, 10),
    });
  } catch (error) {
    next(error);
  }
}

export async function listMyCompetitions(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = getCurrentUser(req);

    const participants = await CompetitionParticipant.find({
      user: user._id,
    })
      .populate({
        path: "competition",
        populate: {
          path: "createdBy",
          select: "name email role",
        },
      })
      .sort({ joinedAt: -1 });

    return res.json({
      competitions: participants.map((participant: any) => ({
        participation: normalizeParticipant(participant),
        competition: normalizeCompetition(participant.competition),
      })),
    });
  } catch (error) {
    next(error);
  }
}

export async function getCompetitionDetail(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const competitionId = getParamAsString(req.params.competitionId);

    if (!mongoose.Types.ObjectId.isValid(competitionId)) {
      return res.status(400).json({
        message: "Valid competitionId is required.",
      });
    }

    const competition = await Competition.findById(competitionId).populate(
      "createdBy",
      "name email role"
    );

    if (!competition) {
      return res.status(404).json({
        message: "Competition not found.",
      });
    }

    const participantCount = await CompetitionParticipant.countDocuments({
      competition: competitionId,
    });

    return res.json({
      competition: normalizeCompetition(competition, {
        participantCount,
      }),
    });
  } catch (error) {
    next(error);
  }
}

export async function joinCompetition(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = getCurrentUser(req);
    const competitionId = getParamAsString(req.params.competitionId);

    if (user.role !== "USER") {
      return res.status(403).json({
        message: "Only USER accounts can join competitions.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(competitionId)) {
      return res.status(400).json({
        message: "Valid competitionId is required.",
      });
    }

    const competition = await Competition.findById(competitionId);

    if (!competition) {
      return res.status(404).json({
        message: "Competition not found.",
      });
    }

    const status = calculateCompetitionStatus(
      new Date(competition.startsAt),
      new Date(competition.endsAt)
    );

    if (status === CompetitionStatus.ENDED) {
      return res.status(400).json({
        message: "This competition has already ended.",
      });
    }

    const portfolio = await getPortfolioForUser(String(user._id));

    if (!portfolio) {
      return res.status(404).json({
        message: "Portfolio not found for current user.",
      });
    }

    const startingPortfolioValue = calculatePortfolioValue(portfolio);

    const participant = await CompetitionParticipant.create({
      competition: competition._id,
      user: user._id,
      portfolio: portfolio._id,
      startingEquity: startingPortfolioValue,
      currentEquity: startingPortfolioValue,
      startingPortfolioValue,
      currentPortfolioValue: startingPortfolioValue,
      profit: 0,
      roi: 0,
      joinedAt: new Date(),
    });

    return res.status(201).json({
      message: "Competition joined successfully.",
      participant: normalizeParticipant(
        await participant.populate("user", "name email role")
      ),
    });
  } catch (error: any) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "You have already joined this competition.",
      });
    }

    next(error);
  }
}

export async function getCompetitionLeaderboard(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const competitionId = getParamAsString(req.params.competitionId);

    if (!mongoose.Types.ObjectId.isValid(competitionId)) {
      return res.status(400).json({
        message: "Valid competitionId is required.",
      });
    }

    const competition = await Competition.findById(competitionId).populate(
      "createdBy",
      "name email role"
    );

    if (!competition) {
      return res.status(404).json({
        message: "Competition not found.",
      });
    }

    const leaderboard = await recalculateLeaderboard(competitionId);

    return res.json({
      competition: normalizeCompetition(competition),
      leaderboard,
    });
  } catch (error) {
    next(error);
  }
}

export async function createInstructorCompetition(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = getCurrentUser(req);

    if (!["INSTRUCTOR", "ADMIN"].includes(user.role)) {
      return res.status(403).json({
        message: "Only INSTRUCTOR or ADMIN can create competitions.",
      });
    }

    const {
      title,
      description,
      startDate,
      endDate,
      startsAt,
      endsAt,
      rankingMetric,
      targetAsset,
    } = req.body;

    if (!title) {
      return res.status(400).json({
        message: "Competition title is required.",
      });
    }

    const resolvedStartsAt = new Date(startsAt || startDate || Date.now());
    const resolvedEndsAt = new Date(
      endsAt || endDate || Date.now() + 1000 * 60 * 60 * 24 * 7
    );

    if (Number.isNaN(resolvedStartsAt.getTime())) {
      return res.status(400).json({
        message: "Valid startDate is required.",
      });
    }

    if (Number.isNaN(resolvedEndsAt.getTime())) {
      return res.status(400).json({
        message: "Valid endDate is required.",
      });
    }

    if (resolvedEndsAt <= resolvedStartsAt) {
      return res.status(400).json({
        message: "endDate must be after startDate.",
      });
    }

    const competition = await Competition.create({
      title,
      description,
      season: `${resolvedStartsAt.getFullYear()}`,
      startsAt: resolvedStartsAt,
      endsAt: resolvedEndsAt,
      status: calculateCompetitionStatus(resolvedStartsAt, resolvedEndsAt),
      isDefault: false,
      createdBy: user._id,
      rankingMetric:
        rankingMetric || CompetitionRankingMetric.TOTAL_PORTFOLIO_ROI,
      targetAsset: targetAsset || null,
    });

    const populated = await competition.populate(
      "createdBy",
      "name email role"
    );

    return res.status(201).json({
      message: "Competition created.",
      competition: normalizeCompetition(populated),
    });
  } catch (error) {
    next(error);
  }
}

export async function listInstructorCompetitions(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = getCurrentUser(req);

    if (!["INSTRUCTOR", "ADMIN"].includes(user.role)) {
      return res.status(403).json({
        message: "Only INSTRUCTOR or ADMIN can view instructor competitions.",
      });
    }

    const filter =
      user.role === "ADMIN"
        ? {}
        : {
            createdBy: user._id,
          };

    const competitions = await Competition.find(filter)
      .populate("createdBy", "name email role")
      .sort({ createdAt: -1 });

    return res.json({
      competitions: competitions.map((competition) =>
        normalizeCompetition(competition)
      ),
    });
  } catch (error) {
    next(error);
  }
}

export async function listAdminCompetitions(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = getCurrentUser(req);

    if (user.role !== "ADMIN") {
      return res.status(403).json({
        message: "Only ADMIN can view all competitions.",
      });
    }

    const competitions: any[] = await Competition.find({})
      .populate("createdBy", "name email role")
      .sort({ createdAt: -1 });

    const counts = await CompetitionParticipant.aggregate([
      {
        $group: {
          _id: "$competition",
          participantCount: { $sum: 1 },
        },
      },
    ]);

    const countMap = new Map(
      counts.map((item: any) => [String(item._id), item.participantCount])
    );

    return res.json({
      competitions: competitions.map((competition) =>
        normalizeCompetition(competition, {
          participantCount: countMap.get(String(competition._id)) || 0,
        })
      ),
    });
  } catch (error) {
    next(error);
  }
}

export async function listAdminCompetitionParticipants(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = getCurrentUser(req);

    if (user.role !== "ADMIN") {
      return res.status(403).json({
        message: "Only ADMIN can view competition participants.",
      });
    }

    const competitionId = getParamAsString(req.params.competitionId);

    if (!mongoose.Types.ObjectId.isValid(competitionId)) {
      return res.status(400).json({
        message: "Valid competitionId is required.",
      });
    }

    const competition = await Competition.findById(competitionId).populate(
      "createdBy",
      "name email role"
    );

    if (!competition) {
      return res.status(404).json({
        message: "Competition not found.",
      });
    }

    const participants = await recalculateLeaderboard(competitionId);

    return res.json({
      competition: normalizeCompetition(competition),
      participants,
    });
  } catch (error) {
    next(error);
  }
}


export async function listInstructorCompetitionParticipants(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = getCurrentUser(req);
    const competitionId = getParamAsString(req.params.competitionId);

    if (!["INSTRUCTOR", "ADMIN"].includes(user.role)) {
      return res.status(403).json({
        message: "Only INSTRUCTOR or ADMIN can view competition participants.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(competitionId)) {
      return res.status(400).json({
        message: "Valid competitionId is required.",
      });
    }

    const competition: any = await Competition.findById(competitionId).populate(
      "createdBy",
      "name displayName email role"
    );

    if (!competition) {
      return res.status(404).json({
        message: "Competition not found.",
      });
    }

    const createdById = String(
      competition.createdBy?._id || competition.createdBy || ""
    );

    if (user.role === "INSTRUCTOR" && createdById !== String(user._id)) {
      return res.status(403).json({
        message: "You can view participants only for competitions you created.",
      });
    }

    const participants = await recalculateLeaderboard(competitionId);

    return res.json({
      competition: normalizeCompetition(competition),
      participants,
    });
  } catch (error) {
    next(error);
  }
}

