import mongoose, { Document, Model, Schema, Types } from "mongoose";

/**
 * A point-in-time snapshot of a portfolio's value. Snapshots are recorded after
 * every executed order (and can be backfilled by a scheduled job) so the
 * frontend can render a performance time-series chart (REQ-PORT-07/08).
 */
export interface IPortfolioSnapshot extends Document {
  _id: Types.ObjectId;
  portfolio: Types.ObjectId;
  user: Types.ObjectId;
  cashBalance: number;
  holdingsValue: number;
  totalEquity: number;
  roi: number;
  createdAt: Date;
  updatedAt: Date;
}

const portfolioSnapshotSchema = new Schema<IPortfolioSnapshot>(
  {
    portfolio: {
      type: Schema.Types.ObjectId,
      ref: "Portfolio",
      required: true,
      index: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    cashBalance: {
      type: Number,
      required: true,
    },
    holdingsValue: {
      type: Number,
      required: true,
    },
    totalEquity: {
      type: Number,
      required: true,
    },
    roi: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);

portfolioSnapshotSchema.index({ portfolio: 1, createdAt: 1 });

export const PortfolioSnapshot: Model<IPortfolioSnapshot> =
  mongoose.models.PortfolioSnapshot ||
  mongoose.model<IPortfolioSnapshot>(
    "PortfolioSnapshot",
    portfolioSnapshotSchema
  );
