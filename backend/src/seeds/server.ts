import dotenv from "dotenv";
import express, { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";

import authRoutes from "./routes/auth.routes";
import courseRoutes from "./routes/course.routes";
import marketRoutes from "./routes/market.routes";
import competitionRoutes from "./routes/competition.routes";
import adminRoutes from "./routes/admin.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import { tickAllAssetPrices } from "./services/marketSimulator.service";
import { startAutoRealMarketRefresh } from "./services/marketAutoRefresh.service";

dotenv.config();

const app = express();

const PORT = process.env.PORT || 5000;
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/tradelab";
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

const AUTO_MARKET_SIMULATOR_ENABLED =
  process.env.AUTO_MARKET_SIMULATOR_ENABLED !== "false";

const AUTO_MARKET_TICK_SECONDS = Number(
  process.env.AUTO_MARKET_TICK_SECONDS || 10
);

let autoMarketInterval: NodeJS.Timeout | null = null;
let isMarketTickRunning = false;

app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

const uploadsPath = path.resolve(process.cwd(), "uploads");
app.use("/uploads", express.static(uploadsPath));

app.get("/api/health", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "TradeLab API",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api", courseRoutes);
app.use("/api/market", marketRoutes);
app.use("/api/competitions", competitionRoutes);
app.use("/api", dashboardRoutes);

app.use((req: Request, res: Response) => {
  res.status(404).json({
    message: "Route not found.",
  });
});

app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(error);

  res.status(500).json({
    message: "Internal server error.",
  });
});

function startAutoMarketSimulator() {
  if (!AUTO_MARKET_SIMULATOR_ENABLED) {
    console.log("Auto market simulator disabled.");
    return;
  }

  if (autoMarketInterval) {
    return;
  }

  const intervalMs = Math.max(AUTO_MARKET_TICK_SECONDS, 1) * 1000;

  console.log(
    `Auto market simulator enabled. Tick interval: ${intervalMs / 1000}s`
  );

  autoMarketInterval = setInterval(async () => {
    if (isMarketTickRunning) {
      return;
    }

    isMarketTickRunning = true;

    try {
      const results = await tickAllAssetPrices();
      const successCount = results.filter((result) => result.success).length;
      const failedCount = results.length - successCount;

      console.log(
        `[market simulator] tick completed. success=${successCount}, failed=${failedCount}`
      );
    } catch (error) {
      console.error("[market simulator] tick failed.");
      console.error(error);
    } finally {
      isMarketTickRunning = false;
    }
  }, intervalMs);
}

async function startServer() {
  try {
    await mongoose.connect(MONGODB_URI);

    console.log(`MongoDB connected: ${MONGODB_URI}`);
    console.log(`Serving uploads from: ${uploadsPath}`);
    console.log("Market routes mounted at /api/market");
    console.log("Competition routes mounted at /api/competitions");
    console.log("Admin routes mounted at /api/admin");

    app.listen(PORT, () => {
      console.log(`TradeLab API running on http://localhost:${PORT}`);
      startAutoMarketSimulator();
      startAutoRealMarketRefresh();
    });
  } catch (error) {
    console.error("Failed to start TradeLab API.");
    console.error(error);
    process.exit(1);
  }
}

startServer();