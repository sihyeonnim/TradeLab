import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface ICompetitionParticipant extends Document {
  _id: Types.ObjectId;
  competition: Types.ObjectId;
  user: Types.ObjectId;
  portfolio: Types.ObjectId;
  startingEquity: number;
  currentEquity: number;
  roi: number;
  rank?: number;
  joinedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const competitionParticipantSchema = new Schema<ICompetitionParticipant>(
  {
    competition: {
      type: Schema.Types.ObjectId,
      ref: "Competition",
      required: true,
      index: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    portfolio: {
      type: Schema.Types.ObjectId,
      ref: "Portfolio",
      required: true,
    },
    startingEquity: {
      type: Number,
      default: 100000,
      min: 0,
    },
    currentEquity: {
      type: Number,
      default: 100000,
      min: 0,
    },

    // Rule: Leaderboard ranking is based only on ROI.
    roi: {
      type: Number,
      default: 0,
      index: true,
    },

    rank: {
      type: Number,
      min: 1,
    },

    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

competitionParticipantSchema.index(
  { competition: 1, user: 1 },
  { unique: true }
);

competitionParticipantSchema.index({ competition: 1, roi: -1 });

export const CompetitionParticipant: Model<ICompetitionParticipant> =
  mongoose.models.CompetitionParticipant ||
  mongoose.model<ICompetitionParticipant>(
    "CompetitionParticipant",
    competitionParticipantSchema
  );