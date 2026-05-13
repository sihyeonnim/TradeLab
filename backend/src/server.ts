import dotenv from "dotenv";
import express, { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import cors from "cors";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/auth.routes";
import dashboardRoutes from "./routes/dashboard.routes";

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
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();