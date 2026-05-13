import mongoose, { Document, Model, Schema, Types } from "mongoose";

export enum AIAnalysisType {
  PORTFOLIO_REVIEW = "PORTFOLIO_REVIEW",
  ASSET_EXPLANATION = "ASSET_EXPLANATION",
  TRADE_FEEDBACK = "TRADE_FEEDBACK",
  COURSE_HELP = "COURSE_HELP",
}

export interface IAIAnalysis extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  portfolio?: Types.ObjectId;
  asset?: Types.ObjectId;
  type: AIAnalysisType;
  prompt: string;
  response: string;
  modelName?: string;
  createdAt: Date;
  updatedAt: Date;
}

const aiAnalysisSchema = new Schema<IAIAnalysis>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    portfolio: {
      type: Schema.Types.ObjectId,
      ref: "Portfolio",
    },
    asset: {
      type: Schema.Types.ObjectId,
      ref: "Asset",
    },
    type: {
      type: String,
      enum: Object.values(AIAnalysisType),
      required: true,
      index: true,
    },
    prompt: {
      type: String,
      required: true,
    },
    response: {
      type: String,
      required: true,
    },
    modelName: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

aiAnalysisSchema.index({ user: 1, createdAt: -1 });

export const AIAnalysis: Model<IAIAnalysis> =
  mongoose.models.AIAnalysis ||
  mongoose.model<IAIAnalysis>("AIAnalysis", aiAnalysisSchema);