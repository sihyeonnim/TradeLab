import mongoose, { Document, Model, Schema, Types } from "mongoose";

export enum CompetitionStatus {
  UPCOMING = "UPCOMING",
  ACTIVE = "ACTIVE",
  ENDED = "ENDED",
}

export enum CompetitionRankingMetric {
  TOTAL_PORTFOLIO_ROI = "TOTAL_PORTFOLIO_ROI",
  TOTAL_PORTFOLIO_PROFIT = "TOTAL_PORTFOLIO_PROFIT",
  TARGET_ASSET_ROI = "TARGET_ASSET_ROI",
  TARGET_ASSET_PROFIT = "TARGET_ASSET_PROFIT",
}

export interface ICompetition extends Document {
  _id: Types.ObjectId;
  title: string;
  description?: string;
  season: string;
  startsAt: Date;
  endsAt: Date;
  status: CompetitionStatus;
  isDefault: boolean;

  createdBy?: Types.ObjectId;
  rankingMetric: CompetitionRankingMetric;
  targetAsset?: Types.ObjectId | null;

  createdAt: Date;
  updatedAt: Date;
}

const competitionSchema = new Schema<ICompetition>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    season: {
      type: String,
      required: true,
      trim: true,
      index: true,
      default: () => `${new Date().getFullYear()}`,
    },
    startsAt: {
      type: Date,
      required: true,
    },
    endsAt: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(CompetitionStatus),
      default: CompetitionStatus.UPCOMING,
      index: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    rankingMetric: {
      type: String,
      enum: Object.values(CompetitionRankingMetric),
      default: CompetitionRankingMetric.TOTAL_PORTFOLIO_ROI,
      index: true,
    },
    targetAsset: {
      type: Schema.Types.ObjectId,
      ref: "Asset",
      default: null,
    },
  },
  { timestamps: true }
);

competitionSchema.index({ season: 1, isDefault: 1 });
competitionSchema.index({ status: 1, startsAt: 1, endsAt: 1 });
competitionSchema.index({ createdBy: 1, createdAt: -1 });

export const Competition: Model<ICompetition> =
  mongoose.models.Competition ||
  mongoose.model<ICompetition>("Competition", competitionSchema);