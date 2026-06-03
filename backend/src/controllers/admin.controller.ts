import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";

import { UserRole } from "../models/User";

import {
  User,
  Portfolio,
  Holding,
  Asset,
  Course,
  Enrollment,
  Competition,
  CompetitionParticipant,
} from "../models";

function getCurrentUser(req: Request): any {
  return (req as any).user;
}

function requireAdminUser(req: Request, res: Response) {
  const user = getCurrentUser(req);

  if (!user || user.role !== "ADMIN") {
    res.status(403).json({
      message: "Only ADMIN can access this resource.",
    });

    return null;
  }

  return user;
}

function getParamAsString(value: unknown) {
  if (Array.isArray(value)) {
    return String(value[0] || "");
  }

  return String(value || "");
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getAssetPrice(asset: any) {
  return toNumber(asset?.lastFetchedPrice ?? asset?.lastPrice, 0);
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
    isEmailVerified: Boolean(doc.isEmailVerified),
    virtualCash: toNumber(doc.virtualCash, 0),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function normalizeAsset(asset: any) {
  if (!asset) {
    return null;
  }

  const doc = typeof asset.toObject === "function" ? asset.toObject() : asset;

  return {
    id: String(doc._id || doc.id),
    symbol: doc.symbol,
    name: doc.name,
    exchange: doc.exchange,
    type: doc.type,
    currency: doc.currency || "USD",
    lastPrice: getAssetPrice(doc),
    lastFetchedPrice: getAssetPrice(doc),
    lastFetchedAt: doc.lastFetchedAt || null,
    isActive: doc.isActive ?? true,
  };
}

function normalizeCourse(course: any, extra: any = {}) {
  if (!course) {
    return null;
  }

  const doc = typeof course.toObject === "function" ? course.toObject() : course;

  return {
    id: String(doc._id || doc.id),
    title: doc.title,
    description: doc.description,
    level: doc.level,
    category: doc.category,
    tags: Array.isArray(doc.tags) ? doc.tags : [],
    instructor: normalizeUser(doc.instructor),
    approvalStatus: doc.approvalStatus || doc.status || "UNKNOWN",
    isPublished: Boolean(doc.isPublished),
    approvedBy: doc.approvedBy ? String(doc.approvedBy?._id || doc.approvedBy) : null,
    approvedAt: doc.approvedAt || null,
    rejectionReason: doc.rejectionReason || null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    ...extra,
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
    rankingMetric: doc.rankingMetric || "TOTAL_PORTFOLIO_ROI",
    targetAsset: doc.targetAsset ? String(doc.targetAsset?._id || doc.targetAsset) : null,
    createdBy: normalizeUser(doc.createdBy),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    ...extra,
  };
}

function normalizeEnrollment(enrollment: any) {
  const doc =
    typeof enrollment.toObject === "function" ? enrollment.toObject() : enrollment;

  return {
    id: String(doc._id || doc.id),
    course: normalizeCourse(doc.course),
    user: normalizeUser(doc.user),
    status: doc.status,
    progressPercent: toNumber(doc.progressPercent, 0),
    completedLessons: Array.isArray(doc.completedLessons)
      ? doc.completedLessons.map((lesson: any) => String(lesson?._id || lesson))
      : [],
    enrolledAt: doc.enrolledAt,
    completedAt: doc.completedAt || null,
  };
}

function normalizeParticipant(participant: any) {
  const doc =
    typeof participant.toObject === "function"
      ? participant.toObject()
      : participant;

  const startingPortfolioValue = toNumber(
    doc.startingPortfolioValue ?? doc.startingEquity,
    0
  );
  const currentPortfolioValue = toNumber(
    doc.currentPortfolioValue ?? doc.currentEquity,
    startingPortfolioValue
  );

  return {
    id: String(doc._id || doc.id),
    competition: String(doc.competition?._id || doc.competition),
    user: normalizeUser(doc.user),
    portfolio: doc.portfolio ? String(doc.portfolio?._id || doc.portfolio) : null,
    startingPortfolioValue,
    currentPortfolioValue,
    profit: toNumber(doc.profit, currentPortfolioValue - startingPortfolioValue),
    roi: toNumber(doc.roi, 0),
    rank: doc.rank || null,
    joinedAt: doc.joinedAt,
  };
}

async function buildPortfolioDetailForUser(userId: string) {
  const portfolio: any = await Portfolio.findOne({ user: userId }).lean();

  if (!portfolio) {
    return {
      portfolio: null,
      holdings: [],
    };
  }

  const holdings: any[] = await Holding.find({ portfolio: portfolio._id })
    .populate("asset")
    .sort({ createdAt: -1 })
    .lean();

  const normalizedHoldings = holdings.map((holding: any) => {
    const asset = normalizeAsset(holding.asset);
    const quantity = toNumber(holding.quantity, 0);
    const averagePrice = toNumber(holding.averageBuyPrice, 0);
    const currentPrice = getAssetPrice(holding.asset);
    const marketValue = quantity * currentPrice;
    const costBasis = quantity * averagePrice;
    const unrealizedPnl = marketValue - costBasis;
    const returnPercent =
      costBasis > 0 ? (unrealizedPnl / costBasis) * 100 : 0;

    return {
      id: String(holding._id),
      asset,
      quantity,
      averagePrice,
      currentPrice,
      marketValue,
      costBasis,
      unrealizedPnl,
      returnPercent,
      createdAt: holding.createdAt,
      updatedAt: holding.updatedAt,
    };
  });

  const cashBalance = toNumber(portfolio.cashBalance, 0);
  const totalAssetValue = normalizedHoldings.reduce(
    (sum, holding) => sum + holding.marketValue,
    0
  );
  const startingCash = toNumber(portfolio.startingCash, 100000);
  const totalEquity = cashBalance + totalAssetValue;
  const roi = startingCash > 0 ? ((totalEquity - startingCash) / startingCash) * 100 : 0;

  return {
    portfolio: {
      id: String(portfolio._id),
      cashBalance,
      startingCash,
      totalAssetValue,
      totalEquity,
      roi,
      createdAt: portfolio.createdAt,
      updatedAt: portfolio.updatedAt,
    },
    holdings: normalizedHoldings,
  };
}

export async function listAdminUsers(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!requireAdminUser(req, res)) {
      return;
    }

    const users: any[] = await User.find({})
      .sort({ role: 1, createdAt: -1 })
      .lean();

    const results = [];

    for (const user of users) {
      const portfolioDetail = await buildPortfolioDetailForUser(String(user._id));

      const [enrollmentCount, competitionCount] = await Promise.all([
        Enrollment.countDocuments({ user: user._id }),
        CompetitionParticipant.countDocuments({ user: user._id }),
      ]);

      results.push({
        user: normalizeUser(user),
        portfolio: portfolioDetail.portfolio,
        holdings: portfolioDetail.holdings,
        enrollmentCount,
        competitionCount,
      });
    }

    return res.json({
      users: results,
    });
  } catch (error) {
    next(error);
  }
}

export async function getAdminUserDetail(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!requireAdminUser(req, res)) {
      return;
    }

    const userId = getParamAsString(req.params.userId);

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        message: "Valid userId is required.",
      });
    }

    const user: any = await User.findById(userId).lean();

    if (!user) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    const portfolioDetail = await buildPortfolioDetailForUser(userId);

    const enrollments: any[] = await Enrollment.find({ user: userId })
      .populate({
        path: "course",
        populate: {
          path: "instructor",
          select: "name email role",
        },
      })
      .sort({ enrolledAt: -1 })
      .lean();

    const participations: any[] = await CompetitionParticipant.find({
      user: userId,
    })
      .populate({
        path: "competition",
        populate: {
          path: "createdBy",
          select: "name email role",
        },
      })
      .sort({ joinedAt: -1 })
      .lean();

    return res.json({
      user: normalizeUser(user),
      portfolio: portfolioDetail.portfolio,
      holdings: portfolioDetail.holdings,
      enrollments: enrollments.map(normalizeEnrollment),
      competitions: participations.map((participation: any) => ({
        participation: normalizeParticipant(participation),
        competition: normalizeCompetition(participation.competition),
      })),
    });
  } catch (error) {
    next(error);
  }
}

export async function getAdminCoursesOverview(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!requireAdminUser(req, res)) {
      return;
    }

    const courses: any[] = await Course.find({})
      .populate("instructor", "name email role")
      .populate("approvedBy", "name email role")
      .sort({ createdAt: -1 })
      .lean();

    const enrollmentCounts = await Enrollment.aggregate([
      {
        $group: {
          _id: "$course",
          enrollmentCount: { $sum: 1 },
        },
      },
    ]);

    const enrollmentCountMap = new Map(
      enrollmentCounts.map((item: any) => [String(item._id), item.enrollmentCount])
    );

    const instructors: any[] = await User.find({ role: UserRole.INSTRUCTOR })
      .select("name email role isEmailVerified createdAt")
      .sort({ createdAt: -1 })
      .lean();

    const instructorCourseCounts = await Course.aggregate([
      {
        $group: {
          _id: "$instructor",
          courseCount: { $sum: 1 },
        },
      },
    ]);

    const instructorCourseCountMap = new Map(
      instructorCourseCounts.map((item: any) => [String(item._id), item.courseCount])
    );

    return res.json({
      courses: courses.map((course: any) =>
        normalizeCourse(course, {
          enrollmentCount: enrollmentCountMap.get(String(course._id)) || 0,
        })
      ),
      instructors: instructors.map((instructor: any) => ({
        ...normalizeUser(instructor),
        courseCount: instructorCourseCountMap.get(String(instructor._id)) || 0,
      })),
    });
  } catch (error) {
    next(error);
  }
}

export async function getAdminCourseEnrollments(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!requireAdminUser(req, res)) {
      return;
    }

    const courseId = getParamAsString(req.params.courseId);

    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({
        message: "Valid courseId is required.",
      });
    }

    const course = await Course.findById(courseId)
      .populate("instructor", "name email role")
      .lean();

    if (!course) {
      return res.status(404).json({
        message: "Course not found.",
      });
    }

    const enrollments: any[] = await Enrollment.find({ course: courseId })
      .populate("user", "name email role isEmailVerified createdAt")
      .sort({ enrolledAt: -1 })
      .lean();

    return res.json({
      course: normalizeCourse(course),
      enrollments: enrollments.map(normalizeEnrollment),
    });
  } catch (error) {
    next(error);
  }
}

export async function approveAdminCourse(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const adminUser = requireAdminUser(req, res);

    if (!adminUser) {
      return;
    }

    const courseId = getParamAsString(req.params.courseId);

    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({
        message: "Valid courseId is required.",
      });
    }

    const course: any = await Course.findByIdAndUpdate(
      courseId,
      {
        $set: {
          approvalStatus: "APPROVED",
          isPublished: true,
          approvedBy: adminUser._id,
          approvedAt: new Date(),
          rejectionReason: null,
        },
      },
      { new: true }
    ).populate("instructor", "name email role");

    if (!course) {
      return res.status(404).json({
        message: "Course not found.",
      });
    }

    return res.json({
      message: "Course approved.",
      course: normalizeCourse(course),
    });
  } catch (error) {
    next(error);
  }
}

export async function rejectAdminCourse(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!requireAdminUser(req, res)) {
      return;
    }

    const courseId = getParamAsString(req.params.courseId);
    const rejectionReason = String(req.body?.rejectionReason || "");

    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({
        message: "Valid courseId is required.",
      });
    }

    const course: any = await Course.findByIdAndUpdate(
      courseId,
      {
        $set: {
          approvalStatus: "REJECTED",
          isPublished: false,
          rejectionReason,
        },
      },
      { new: true }
    ).populate("instructor", "name email role");

    if (!course) {
      return res.status(404).json({
        message: "Course not found.",
      });
    }

    return res.json({
      message: "Course rejected.",
      course: normalizeCourse(course),
    });
  } catch (error) {
    next(error);
  }
}

export async function getAdminCompetitionsOverview(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!requireAdminUser(req, res)) {
      return;
    }

    const competitions: any[] = await Competition.find({})
      .populate("createdBy", "name email role")
      .sort({ createdAt: -1 })
      .lean();

    const participantCounts = await CompetitionParticipant.aggregate([
      {
        $group: {
          _id: "$competition",
          participantCount: { $sum: 1 },
        },
      },
    ]);

    const participantCountMap = new Map(
      participantCounts.map((item: any) => [
        String(item._id),
        item.participantCount,
      ])
    );

    return res.json({
      competitions: competitions.map((competition: any) =>
        normalizeCompetition(competition, {
          participantCount: participantCountMap.get(String(competition._id)) || 0,
        })
      ),
    });
  } catch (error) {
    next(error);
  }
}

export async function getAdminCompetitionParticipants(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (!requireAdminUser(req, res)) {
      return;
    }

    const competitionId = getParamAsString(req.params.competitionId);

    if (!mongoose.Types.ObjectId.isValid(competitionId)) {
      return res.status(400).json({
        message: "Valid competitionId is required.",
      });
    }

    const competition = await Competition.findById(competitionId)
      .populate("createdBy", "name email role")
      .lean();

    if (!competition) {
      return res.status(404).json({
        message: "Competition not found.",
      });
    }

    const participants: any[] = await CompetitionParticipant.find({
      competition: competitionId,
    })
      .populate("user", "name email role isEmailVerified createdAt")
      .sort({ rank: 1, roi: -1, joinedAt: 1 })
      .lean();

    return res.json({
      competition: normalizeCompetition(competition),
      participants: participants.map(normalizeParticipant),
    });
  } catch (error) {
    next(error);
  }
}
