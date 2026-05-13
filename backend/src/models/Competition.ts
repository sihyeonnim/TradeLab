import mongoose, { Document, Model, Schema, Types } from "mongoose";

export enum CompetitionStatus {
  UPCOMING = "UPCOMING",
  ACTIVE = "ACTIVE",
  ENDED = "ENDED",
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

    // Rule: One default seasonal competition should exist from seed data.
    isDefault: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

competitionSchema.index({ season: 1, isDefault: 1 });

export const Competition: Model<ICompetition> =
  mongoose.models.Competition ||
  mongoose.model<ICompetition>("Competition", competitionSchema);