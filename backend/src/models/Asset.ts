import mongoose, { Document, Model, Schema, Types } from "mongoose";

export enum AssetType {
  STOCK = "STOCK",
  ETF = "ETF",
  CRYPTO = "CRYPTO",
}

export interface IAsset extends Document {
  _id: Types.ObjectId;
  symbol: string;
  name: string;
  type: AssetType;
  exchange?: string;
  currency: string;
  lastFetchedPrice: number;
  lastFetchedAt?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const assetSchema = new Schema<IAsset>(
  {
    symbol: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: Object.values(AssetType),
      required: true,
    },
    exchange: {
      type: String,
      trim: true,
    },
    currency: {
      type: String,
      default: "USD",
      uppercase: true,
      trim: true,
    },

    // Used by MVP market order execution.
    lastFetchedPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    lastFetchedAt: {
      type: Date,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

export const Asset: Model<IAsset> =
  mongoose.models.Asset || mongoose.model<IAsset>("Asset", assetSchema);