import { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";

import {
  Competition,
  CompetitionParticipant,
  CompetitionRankingMetric,
  CompetitionStatus,
  Portfolio,
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

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return parsed;
}

function resolveCompetitionDates(competition: any) {
  const doc =
    typeof competition?.toObject === "function"
      ? competition.toObject()
      : competition;

  return {
    startsAt: new Date(doc?.startsAt || doc?.startDate || Date.now()),
    endsAt: new Date(doc?.endsAt || doc?.endDate || Date.now()),
  };
}

function calculateCompetitionStatus(startsAt: Date, endsAt: Date) {
  const now = new Date();

  if (now < startsAt) {
    return CompetitionStatus.UPCOMING;
  }

  if (now >= endsAt) {
    return CompetitionStatus.ENDED;
  }

  return CompetitionStatus.ACTIVE;
}

function getDynamicCompetitionStatus(competition: any) {
  const { startsAt, endsAt } = resolveCompetitionDates(competition);

  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return competition?.status || CompetitionStatus.UPCOMING;
  }

  return calculateCompetitionStatus(startsAt, endsAt);
}

async function syncCompetitionStatus(competition: any) {
  if (!competition) {
    return null;
  }

  const dynamicStatus = getDynamicCompetitionStatus(competition);
  const currentStatus = String(competition.status || "").toUpperCase();

  if (currentStatus !== dynamicStatus) {
    if (typeof competition.set === "function") {
      competition.set("status", dynamicStatus);
      await competition.save();
      return competition;
    }

    await Competition.findByIdAndUpdate(competition._id || competition.id, {
      $set: { status: dynamicStatus },
    });

    return {
      ...competition,
      status: dynamicStatus,
    };
  }

  return competition;
}

async function syncManyCompetitionStatuses(competitions: any[]) {
  return Promise.all(
    competitions.map((competition) => syncCompetitionStatus(competition))
  );
}

function normalizeUser(user: any) {
  if (!user) {
    return null;
  }

  const doc = typeof user.toObject === "function" ? user.toObject() : user;

  return {
    id: String(doc._id || doc.id),
    name: doc.name || doc.displayName || doc.email,
    displayName: doc.displayName || doc.name || doc.email,
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
  const dynamicStatus = getDynamicCompetitionStatus(doc);

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
    status: dynamicStatus,
    storedStatus: doc.status,
    isUpcoming: dynamicStatus === CompetitionStatus.UPCOMING,
    isActive: dynamicStatus === CompetitionStatus.ACTIVE,
    isEnded: dynamicStatus === CompetitionStatus.ENDED,
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

async function recalculateLeaderboard(
  competitionId: string,
  forcedStatus?: CompetitionStatus | string
) {
  const competition = await Competition.findById(competitionId);

  if (!competition) {
    return [];
  }

  const previousStatus = String(competition.status || "").toUpperCase();
  const competitionStatus = String(
    forcedStatus || getDynamicCompetitionStatus(competition)
  ).toUpperCase();

  const participants: any[] = await CompetitionParticipant.find({
    competition: competitionId,
  })
    .populate("user", "name displayName email role")
    .sort({ joinedAt: 1 });

  const hasExistingFinalRanks =
    participants.length > 0 &&
    participants.every((participant) => {
      const rank = Number(participant.rank);
      return Number.isFinite(rank) && rank > 0;
    });

  const shouldFreezeEndedScores =
    competitionStatus === CompetitionStatus.ENDED &&
    previousStatus === CompetitionStatus.ENDED &&
    hasExistingFinalRanks;

  const recalculated = [];

  for (const participant of participants) {
    const startingPortfolioValue = toNumber(
      participant.startingPortfolioValue ?? participant.startingEquity,
      100000
    );

    if (competitionStatus === CompetitionStatus.UPCOMING) {
      participant.currentPortfolioValue = startingPortfolioValue;
      participant.currentEquity = startingPortfolioValue;
      participant.startingPortfolioValue = startingPortfolioValue;
      participant.startingEquity = startingPortfolioValue;
      participant.profit = 0;
      participant.roi = 0;
      participant.rank = undefined;
      await participant.save();
      recalculated.push(participant);
      continue;
    }

    if (shouldFreezeEndedScores) {
      recalculated.push(participant);
      continue;
    }

    const portfolio =
      (await Portfolio.findById(participant.portfolio)) ||
      (await Portfolio.findOne({ user: participant.user?._id || participant.user }));

    const currentPortfolioValue = calculatePortfolioValue(portfolio);
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

  if (competitionStatus !== CompetitionStatus.UPCOMING) {
    recalculated.sort((a, b) => {
      const rankA = Number(a.rank);
      const rankB = Number(b.rank);

      if (shouldFreezeEndedScores && Number.isFinite(rankA) && Number.isFinite(rankB)) {
        return rankA - rankB;
      }

      const roiDiff = toNumber(b.roi, 0) - toNumber(a.roi, 0);

      if (roiDiff !== 0) {
        return roiDiff;
      }

      return toNumber(b.profit, 0) - toNumber(a.profit, 0);
    });

    if (!shouldFreezeEndedScores) {
      for (let index = 0; index < recalculated.length; index += 1) {
        recalculated[index].rank = index + 1;
        await recalculated[index].save();
      }
    }
  }

  if (previousStatus !== competitionStatus) {
    competition.status = competitionStatus as CompetitionStatus;
    await competition.save();
  }

  return recalculated.map((participant) =>
    normalizeParticipant(participant, {
      competitionStatus,
      scorePending: competitionStatus === CompetitionStatus.UPCOMING,
      scoreFinal: competitionStatus === CompetitionStatus.ENDED,
    })
  );
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
        { endsAt: { $gte: now } },
        { endDate: { $gte: now } },
        { status: CompetitionStatus.ACTIVE },
        { status: CompetitionStatus.UPCOMING },
      ],
    })
      .populate("createdBy", "name displayName email role")
      .sort({ startsAt: 1, createdAt: -1 });

    const syncedCompetitions = await syncManyCompetitionStatuses(competitions);

    return res.json({
      competitions: syncedCompetitions.map((competition) =>
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
        {
          startsAt: { $lte: now },
          endsAt: { $gt: now },
        },
        {
          startDate: { $lte: now },
          endDate: { $gt: now },
        },
        { status: CompetitionStatus.ACTIVE },
      ],
    })
      .populate("createdBy", "name displayName email role")
      .sort({ isDefault: -1, startsAt: -1, createdAt: -1 });

    if (!competition) {
      competition = await Competition.findOne({})
        .populate("createdBy", "name displayName email role")
        .sort({ isDefault: -1, startsAt: -1, createdAt: -1 });
    }

    if (!competition) {
      return res.json({
        competition: null,
        leaderboard: [],
      });
    }

    competition = await syncCompetitionStatus(competition);
    const competitionStatus = getDynamicCompetitionStatus(competition);
    const leaderboard = await recalculateLeaderboard(
      String(competition._id),
      competitionStatus
    );

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
          select: "name displayName email role",
        },
      })
      .sort({ joinedAt: -1 });

    const rows = [];

    for (const participant of participants as any[]) {
      if (!participant.competition) {
        continue;
      }

      const competition: any = await syncCompetitionStatus(participant.competition);
      const competitionStatus = getDynamicCompetitionStatus(competition);
      const leaderboard = await recalculateLeaderboard(
        String(competition._id || competition.id),
        competitionStatus
      );
      const normalizedParticipant =
        leaderboard.find((entry: any) => entry.id === String(participant._id)) ||
        normalizeParticipant(participant, {
          competitionStatus,
          scorePending: competitionStatus === CompetitionStatus.UPCOMING,
        });

      rows.push({
        participation: normalizedParticipant,
        competition: normalizeCompetition(competition),
      });
    }

    return res.json({
      competitions: rows,
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

    let competition: any = await Competition.findById(competitionId).populate(
      "createdBy",
      "name displayName email role"
    );

    if (!competition) {
      return res.status(404).json({
        message: "Competition not found.",
      });
    }

    competition = await syncCompetitionStatus(competition);

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

    let competition: any = await Competition.findById(competitionId);

    if (!competition) {
      return res.status(404).json({
        message: "Competition not found.",
      });
    }

    competition = await syncCompetitionStatus(competition);
    const status = getDynamicCompetitionStatus(competition);

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
        await participant.populate("user", "name displayName email role"),
        {
          competitionStatus: status,
          scorePending: status === CompetitionStatus.UPCOMING,
        }
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

export async function leaveCompetition(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = getCurrentUser(req);
    const competitionId = getParamAsString(req.params.competitionId);

    if (user.role !== "USER") {
      return res.status(403).json({
        message: "Only USER accounts can leave competitions.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(competitionId)) {
      return res.status(400).json({
        message: "Valid competitionId is required.",
      });
    }

    let competition: any = await Competition.findById(competitionId);

    if (!competition) {
      return res.status(404).json({
        message: "Competition not found.",
      });
    }

    competition = await syncCompetitionStatus(competition);
    const status = getDynamicCompetitionStatus(competition);

    if (status === CompetitionStatus.ENDED) {
      return res.status(400).json({
        message: "Ended competitions cannot be left.",
      });
    }

    const participant = await CompetitionParticipant.findOne({
      competition: competitionId,
      user: user._id,
    });

    if (!participant) {
      return res.status(404).json({
        message: "Competition participation not found.",
      });
    }

    await CompetitionParticipant.deleteOne({ _id: participant._id });

    return res.json({
      message: "Left competition successfully.",
      competitionId,
    });
  } catch (error) {
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

    let competition: any = await Competition.findById(competitionId).populate(
      "createdBy",
      "name displayName email role"
    );

    if (!competition) {
      return res.status(404).json({
        message: "Competition not found.",
      });
    }

    competition = await syncCompetitionStatus(competition);
    const competitionStatus = getDynamicCompetitionStatus(competition);
    const leaderboard = await recalculateLeaderboard(
      competitionId,
      competitionStatus
    );

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
    const now = new Date();

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

    if (resolvedEndsAt <= now) {
      return res.status(400).json({
        message: "endDate must be in the future.",
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
      "name displayName email role"
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
      .populate("createdBy", "name displayName email role")
      .sort({ startsAt: -1, createdAt: -1 });

    const syncedCompetitions = await syncManyCompetitionStatuses(competitions);

    return res.json({
      competitions: syncedCompetitions.map((competition) =>
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
      .populate("createdBy", "name displayName email role")
      .sort({ startsAt: -1, createdAt: -1 });

    const syncedCompetitions = await syncManyCompetitionStatuses(competitions);

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
      competitions: syncedCompetitions.map((competition: any) =>
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

    let competition: any = await Competition.findById(competitionId).populate(
      "createdBy",
      "name displayName email role"
    );

    if (!competition) {
      return res.status(404).json({
        message: "Competition not found.",
      });
    }

    competition = await syncCompetitionStatus(competition);
    const competitionStatus = getDynamicCompetitionStatus(competition);
    const participants = await recalculateLeaderboard(
      competitionId,
      competitionStatus
    );

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

    let competition: any = await Competition.findById(competitionId).populate(
      "createdBy",
      "name displayName email role"
    );

    if (!competition) {
      return res.status(404).json({
        message: "Competition not found.",
      });
    }

    competition = await syncCompetitionStatus(competition);

    const createdById = String(
      competition.createdBy?._id || competition.createdBy || ""
    );

    if (user.role === "INSTRUCTOR" && createdById !== String(user._id)) {
      return res.status(403).json({
        message: "You can view participants only for competitions you created.",
      });
    }

    const competitionStatus = getDynamicCompetitionStatus(competition);
    const participants = await recalculateLeaderboard(
      competitionId,
      competitionStatus
    );

    return res.json({
      competition: normalizeCompetition(competition),
      participants,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteInstructorCompetition(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const user = getCurrentUser(req);
    const competitionId = getParamAsString(req.params.competitionId);

    if (!["INSTRUCTOR", "ADMIN"].includes(user.role)) {
      return res.status(403).json({
        message: "Only INSTRUCTOR or ADMIN can delete competitions.",
      });
    }

    if (!mongoose.Types.ObjectId.isValid(competitionId)) {
      return res.status(400).json({
        message: "Valid competitionId is required.",
      });
    }

    const competition: any = await Competition.findById(competitionId);

    if (!competition) {
      return res.status(404).json({
        message: "Competition not found.",
      });
    }

    const createdById = String(competition.createdBy || "");

    if (user.role === "INSTRUCTOR" && createdById !== String(user._id)) {
      return res.status(403).json({
        message: "You can delete only competitions you created.",
      });
    }

    if (competition.isDefault && user.role !== "ADMIN") {
      return res.status(403).json({
        message: "Default platform competitions can be deleted only by ADMIN.",
      });
    }

    await CompetitionParticipant.deleteMany({ competition: competition._id });
    await Competition.deleteOne({ _id: competition._id });

    return res.json({
      message: "Competition deleted successfully.",
      competitionId,
    });
  } catch (error) {
    next(error);
  }
}
