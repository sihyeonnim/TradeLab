import mongoose, { Document, Model, Schema, Types } from "mongoose";

export enum ActivityAction {
  USER_REGISTERED = "USER_REGISTERED",
  USER_LOGIN = "USER_LOGIN",
  ORDER_PLACED = "ORDER_PLACED",
  ORDER_EXECUTED = "ORDER_EXECUTED",
  COURSE_CREATED = "COURSE_CREATED",
  COURSE_APPROVED = "COURSE_APPROVED",
  COURSE_ENROLLED = "COURSE_ENROLLED",
  LESSON_COMPLETED = "LESSON_COMPLETED",
  BADGE_EARNED = "BADGE_EARNED",
  AI_ANALYSIS_REQUESTED = "AI_ANALYSIS_REQUESTED",
}

export interface IActivityLog extends Document {
  _id: Types.ObjectId;
  user?: Types.ObjectId;
  action: ActivityAction;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const activityLogSchema = new Schema<IActivityLog>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    action: {
      type: String,
      enum: Object.values(ActivityAction),
      required: true,
      index: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  { timestamps: true }
);

activityLogSchema.index({ user: 1, createdAt: -1 });

export const ActivityLog: Model<IActivityLog> =
  mongoose.models.ActivityLog ||
  mongoose.model<IActivityLog>("ActivityLog", activityLogSchema);