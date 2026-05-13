import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IPortfolio extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  cashBalance: number;
  startingCash: number;
  totalAssetValue: number;
  totalEquity: number;
  roi: number;
  createdAt: Date;
  updatedAt: Date;
}

const portfolioSchema = new Schema<IPortfolio>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    // New portfolio starts with $100,000.
    cashBalance: {
      type: Number,
      default: 100000,
      min: 0,
    },
    startingCash: {
      type: Number,
      default: 100000,
      min: 0,
    },

    totalAssetValue: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalEquity: {
      type: Number,
      default: 100000,
      min: 0,
    },

    // Leaderboard ranking is based only on ROI.
    roi: {
      type: Number,
      default: 0,
      index: true,
    },
  },
  { timestamps: true }
);

export const Portfolio: Model<IPortfolio> =
  mongoose.models.Portfolio ||
  mongoose.model<IPortfolio>("Portfolio", portfolioSchema);