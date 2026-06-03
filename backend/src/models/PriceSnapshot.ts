import mongoose, { Document, Schema, Types } from "mongoose";

export interface IPriceSnapshot extends Document {
  asset: Types.ObjectId;
  symbol: string;
  price: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  source: string;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PriceSnapshotSchema = new Schema<IPriceSnapshot>(
  {
    asset: {
      type: Schema.Types.ObjectId,
      ref: "Asset",
      required: true,
      index: true,
    },
    symbol: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    open: {
      type: Number,
      min: 0,
    },
    high: {
      type: Number,
      min: 0,
    },
    low: {
      type: Number,
      min: 0,
    },
    close: {
      type: Number,
      min: 0,
    },
    volume: {
      type: Number,
      min: 0,
    },
    source: {
      type: String,
      default: "ALPHA_VANTAGE",
      trim: true,
    },
    timestamp: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

PriceSnapshotSchema.index({ asset: 1, timestamp: -1 });
PriceSnapshotSchema.index({ symbol: 1, timestamp: -1 });
PriceSnapshotSchema.index(
  { asset: 1, timestamp: 1, source: 1 },
  { unique: true }
);

const PriceSnapshotModel =
  mongoose.models.PriceSnapshot ||
  mongoose.model<IPriceSnapshot>("PriceSnapshot", PriceSnapshotSchema);

export default PriceSnapshotModel;