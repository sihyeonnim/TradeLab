import mongoose, { Document, Model, Schema, Types } from "mongoose";

export enum CourseLevel {
  BEGINNER = "BEGINNER",
  INTERMEDIATE = "INTERMEDIATE",
  ADVANCED = "ADVANCED",
}

export enum CourseApprovalStatus {
  DRAFT = "DRAFT",
  PENDING_APPROVAL = "PENDING_APPROVAL",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}

export interface ICourse extends Document {
  _id: Types.ObjectId;
  title: string;
  description: string;
  instructor: Types.ObjectId;
  level: CourseLevel;
  tags: string[];
  approvalStatus: CourseApprovalStatus;
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  rejectionReason?: string;
  isPublished: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const courseSchema = new Schema<ICourse>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 140,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },

    // Rule: Course content must be created by instructors.
    instructor: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    level: {
      type: String,
      enum: Object.values(CourseLevel),
      default: CourseLevel.BEGINNER,
    },

    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],

    // Rule: Course content must be approved by admins.
    approvalStatus: {
      type: String,
      enum: Object.values(CourseApprovalStatus),
      default: CourseApprovalStatus.DRAFT,
      index: true,
    },

    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    approvedAt: {
      type: Date,
    },

    rejectionReason: {
      type: String,
      trim: true,
    },

    isPublished: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

courseSchema.index({ approvalStatus: 1, isPublished: 1 });

export const Course: Model<ICourse> =
  mongoose.models.Course || mongoose.model<ICourse>("Course", courseSchema);