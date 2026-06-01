import dotenv from "dotenv";
import express, { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import cors from "cors";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/auth.routes";
import dashboardRoutes from "./routes/dashboard.routes";
import courseRoutes from "./routes/course.routes";

import { isFinnhubConfigured } from "./services/finnhub.service";
import { refreshAllAssetPrices } from "./services/marketData.service";

dotenv.config();

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

app.get("/api/health", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "TradeLab API",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api", dashboardRoutes);
app.use("/api", courseRoutes);

app.use((req: Request, res: Response) => {
  res.status(404).json({
    message: "Route not found.",
  });
});

app.use(
  (error: Error, req: Request, res: Response, next: NextFunction) => {
    console.error(error);

    res.status(500).json({
      message: error.message || "Internal server error.",
    });
  }
);

const PORT = process.env.PORT || 5000;

/**
 * Optionally keep asset prices fresh in the background.
 * Enabled only when FINNHUB_API_KEY is set and FINNHUB_REFRESH_INTERVAL_MS > 0.
 * Finnhub's free tier allows ~60 req/min, so short intervals are fine.
 */
function startPriceRefreshLoop() {
  const intervalMs = Number(process.env.FINNHUB_REFRESH_INTERVAL_MS ?? 0);

  if (!isFinnhubConfigured() || !Number.isFinite(intervalMs) || intervalMs <= 0) {
    return;
  }

  const tick = async () => {
    try {
      const summary = await refreshAllAssetPrices();
      console.log(
        `Price refresh: ${summary.updated} updated, ${summary.failed} failed.`
      );
    } catch (error) {
      console.warn("Price refresh loop error:", (error as Error).message);
    }
  };

  console.log(`Finnhub price refresh enabled (every ${intervalMs}ms).`);
  void tick();
  const timer = setInterval(tick, intervalMs);
  timer.unref?.();
}

async function startServer() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is missing in .env");
    }

    await mongoose.connect(process.env.MONGODB_URI);

    console.log("MongoDB connected:", process.env.MONGODB_URI);

    app.listen(PORT, () => {
      console.log(`TradeLab API running on http://localhost:${PORT}`);
    });

    startPriceRefreshLoop();
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();