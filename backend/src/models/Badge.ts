import mongoose, { Document, Model, Schema, Types } from "mongoose";

export enum BadgeType {
  TRADING = "TRADING",
  LEARNING = "LEARNING",
  COMPETITION = "COMPETITION",
  SYSTEM = "SYSTEM",
}

export interface IBadge extends Document {
  _id: Types.ObjectId;
  name: string;
  description: string;
  type: BadgeType;
  iconPath?: string;
  criteria: string;
  createdAt: Date;
  updatedAt: Date;
}

const badgeSchema = new Schema<IBadge>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: Object.values(BadgeType),
      required: true,
      index: true,
    },
    iconPath: {
      type: String,
      trim: true,
    },
    criteria: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

export const Badge: Model<IBadge> =
  mongoose.models.Badge || mongoose.model<IBadge>("Badge", badgeSchema);