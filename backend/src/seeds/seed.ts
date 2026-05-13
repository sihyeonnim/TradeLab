import dotenv from "dotenv";
import { connectDB, disconnectDB } from "../config/db";

import {
  ActivityAction,
  ActivityLog,
  Asset,
  AssetType,
  Badge,
  BadgeType,
  Competition,
  CompetitionParticipant,
  CompetitionStatus,
  Course,
  CourseApprovalStatus,
  CourseLevel,
  Enrollment,
  Holding,
  Lesson,
  Order,
  OrderSide,
  OrderType,
  OrderStatus,
  Portfolio,
  User,
  UserRole,
} from "../models";

dotenv.config();

const seed = async (): Promise<void> => {
  try {
    await connectDB();

    console.log("Clearing existing data...");

    await Promise.all([
      ActivityLog.deleteMany({}),
      CompetitionParticipant.deleteMany({}),
      Competition.deleteMany({}),
      Enrollment.deleteMany({}),
      Lesson.deleteMany({}),
      Course.deleteMany({}),
      Order.deleteMany({}),
      Holding.deleteMany({}),
      Portfolio.deleteMany({}),
      Badge.deleteMany({}),
      Asset.deleteMany({}),
      User.deleteMany({}),
    ]);

    console.log("Creating users...");

    const admin = await User.create({
      name: "TradeLab Admin",
      email: "admin@tradelab.local",
      password: "password123",
      role: UserRole.ADMIN,
      isEmailVerified: true,
    });

    const instructor = await User.create({
      name: "Sample Instructor",
      email: "instructor@tradelab.local",
      password: "password123",
      role: UserRole.INSTRUCTOR,
      isEmailVerified: true,
    });

    const sampleUser = await User.create({
      name: "Sample User",
      email: "user@tradelab.local",
      password: "password123",
      role: UserRole.USER,
      isEmailVerified: true,
    });

    console.log("Creating portfolios...");

    const samplePortfolio = await Portfolio.create({
      user: sampleUser._id,
      cashBalance: 100000,
      startingCash: 100000,
      totalAssetValue: 0,
      totalEquity: 100000,
      roi: 0,
    });

    await Portfolio.create({
      user: instructor._id,
      cashBalance: 100000,
      startingCash: 100000,
      totalAssetValue: 0,
      totalEquity: 100000,
      roi: 0,
    });

    await Portfolio.create({
      user: admin._id,
      cashBalance: 100000,
      startingCash: 100000,
      totalAssetValue: 0,
      totalEquity: 100000,
      roi: 0,
    });

    console.log("Creating assets...");

    const assets = await Asset.insertMany([
      {
        symbol: "AAPL",
        name: "Apple Inc.",
        type: AssetType.STOCK,
        exchange: "NASDAQ",
        currency: "USD",
        lastFetchedPrice: 190.5,
        lastFetchedAt: new Date(),
      },
      {
        symbol: "MSFT",
        name: "Microsoft Corporation",
        type: AssetType.STOCK,
        exchange: "NASDAQ",
        currency: "USD",
        lastFetchedPrice: 420.25,
        lastFetchedAt: new Date(),
      },
      {
        symbol: "TSLA",
        name: "Tesla, Inc.",
        type: AssetType.STOCK,
        exchange: "NASDAQ",
        currency: "USD",
        lastFetchedPrice: 175.75,
        lastFetchedAt: new Date(),
      },
      {
        symbol: "SPY",
        name: "SPDR S&P 500 ETF Trust",
        type: AssetType.ETF,
        exchange: "NYSEARCA",
        currency: "USD",
        lastFetchedPrice: 520.1,
        lastFetchedAt: new Date(),
      },
      {
        symbol: "BTC",
        name: "Bitcoin",
        type: AssetType.CRYPTO,
        exchange: "CRYPTO",
        currency: "USD",
        lastFetchedPrice: 65000,
        lastFetchedAt: new Date(),
      },
    ]);

    console.log("Creating badges...");

    await Badge.insertMany([
      {
        name: "First Trade",
        description: "Awarded after placing the first trade.",
        type: BadgeType.TRADING,
        iconPath: "/badges/first-trade.png",
        criteria: "Place one executed market order.",
      },
      {
        name: "Course Starter",
        description: "Awarded after enrolling in the first course.",
        type: BadgeType.LEARNING,
        iconPath: "/badges/course-starter.png",
        criteria: "Enroll in one course.",
      },
      {
        name: "Competition Rookie",
        description: "Awarded after joining a competition.",
        type: BadgeType.COMPETITION,
        iconPath: "/badges/competition-rookie.png",
        criteria: "Join one seasonal competition.",
      },
    ]);

    console.log("Creating approved sample courses...");

    const courseOne = await Course.create({
      title: "Stock Market Basics",
      description:
        "Learn the basic concepts of stocks, exchanges, orders, and portfolio management.",
      instructor: instructor._id,
      level: CourseLevel.BEGINNER,
      tags: ["stocks", "beginner", "portfolio"],
      approvalStatus: CourseApprovalStatus.APPROVED,
      approvedBy: admin._id,
      approvedAt: new Date(),
      isPublished: true,
    });

    const courseTwo = await Course.create({
      title: "ETF Investing for Beginners",
      description:
        "Understand how ETFs work and why they are commonly used for diversified investing.",
      instructor: instructor._id,
      level: CourseLevel.BEGINNER,
      tags: ["etf", "diversification", "beginner"],
      approvalStatus: CourseApprovalStatus.APPROVED,
      approvedBy: admin._id,
      approvedAt: new Date(),
      isPublished: true,
    });

    await Lesson.insertMany([
      {
        course: courseOne._id,
        title: "What Is a Stock?",
        order: 1,
        summary: "Introduction to stock ownership and public companies.",
        video: {
          provider: "DUMMY",
          path: "/videos/dummy/stock-market-basics-lesson-1.mp4",
          durationSeconds: 420,
          thumbnailPath: "/thumbnails/stock-lesson-1.png",
        },
        contentMarkdown:
          "A stock represents partial ownership in a company. In TradeLab, you can practice buying and selling stocks using virtual cash.",
      },
      {
        course: courseOne._id,
        title: "Market Orders",
        order: 2,
        summary: "How MVP market orders execute immediately.",
        video: {
          provider: "DUMMY",
          path: "/videos/dummy/stock-market-basics-lesson-2.mp4",
          durationSeconds: 360,
          thumbnailPath: "/thumbnails/stock-lesson-2.png",
        },
        contentMarkdown:
          "A market order is executed immediately at the latest available market price.",
      },
      {
        course: courseTwo._id,
        title: "What Is an ETF?",
        order: 1,
        summary: "Introduction to exchange-traded funds.",
        video: {
          provider: "DUMMY",
          path: "/videos/dummy/etf-beginners-lesson-1.mp4",
          durationSeconds: 390,
          thumbnailPath: "/thumbnails/etf-lesson-1.png",
        },
        contentMarkdown:
          "An ETF is a fund that trades like a stock and often holds a diversified basket of assets.",
      },
    ]);

    console.log("Creating enrollment...");

    await Enrollment.create({
      user: sampleUser._id,
      course: courseOne._id,
      progressPercent: 0,
      completedLessons: [],
    });

    console.log("Creating one default seasonal competition...");

    const now = new Date();

    const seasonStart = new Date(now);
    seasonStart.setDate(1);
    seasonStart.setHours(0, 0, 0, 0);

    const seasonEnd = new Date(seasonStart);
    seasonEnd.setMonth(seasonEnd.getMonth() + 3);
    seasonEnd.setDate(0);
    seasonEnd.setHours(23, 59, 59, 999);

    const defaultCompetition = await Competition.create({
      title: "TradeLab Seasonal Challenge",
      description:
        "Default MVP competition. Participants are ranked only by portfolio ROI.",
      season: "2026 Season 1",
      startsAt: seasonStart,
      endsAt: seasonEnd,
      status: CompetitionStatus.ACTIVE,
      isDefault: true,
    });

    await CompetitionParticipant.create({
      competition: defaultCompetition._id,
      user: sampleUser._id,
      portfolio: samplePortfolio._id,
      startingEquity: 100000,
      currentEquity: 100000,
      roi: 0,
      rank: 1,
      joinedAt: new Date(),
    });

    console.log("Creating sample holding and executed order...");

    const apple = assets.find((asset) => asset.symbol === "AAPL");

    if (apple) {
      await Holding.create({
        portfolio: samplePortfolio._id,
        asset: apple._id,
        quantity: 5,
        averageBuyPrice: apple.lastFetchedPrice,
      });

      await Order.create({
        user: sampleUser._id,
        portfolio: samplePortfolio._id,
        asset: apple._id,
        side: OrderSide.BUY,
        type: OrderType.MARKET,
        status: OrderStatus.EXECUTED,
        quantity: 5,
        requestedPrice: apple.lastFetchedPrice,
        executedPrice: apple.lastFetchedPrice,
        executedAt: new Date(),
      });
    }

    console.log("Creating activity logs...");

    await ActivityLog.insertMany([
      {
        user: admin._id,
        action: ActivityAction.USER_REGISTERED,
        message: "Seed admin user created.",
      },
      {
        user: instructor._id,
        action: ActivityAction.COURSE_CREATED,
        message: "Sample instructor created seed courses.",
      },
      {
        user: admin._id,
        action: ActivityAction.COURSE_APPROVED,
        message: "Admin approved sample seed courses.",
      },
      {
        user: sampleUser._id,
        action: ActivityAction.COURSE_ENROLLED,
        message: "Sample user enrolled in Stock Market Basics.",
      },
    ]);

    console.log("Seed completed successfully.");
    console.log("");
    console.log("Demo accounts:");
    console.log("Admin:      admin@tradelab.local / password123");
    console.log("Instructor: instructor@tradelab.local / password123");
    console.log("User:       user@tradelab.local / password123");

    await disconnectDB();
    process.exit(0);
  } catch (error) {
    console.error("Seed failed:", error);
    await disconnectDB();
    process.exit(1);
  }
};

seed();