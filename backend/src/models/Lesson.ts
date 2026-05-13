import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IVideoMetadata {
  provider: "LOCAL" | "YOUTUBE" | "VIMEO" | "DUMMY";
  path: string;
  durationSeconds?: number;
  thumbnailPath?: string;
}

export interface ILesson extends Document {
  _id: Types.ObjectId;
  course: Types.ObjectId;
  title: string;
  order: number;
  summary?: string;
  video: IVideoMetadata;
  contentMarkdown?: string;
  createdAt: Date;
  updatedAt: Date;
}

const videoMetadataSchema = new Schema<IVideoMetadata>(
  {
    provider: {
      type: String,
      enum: ["LOCAL", "YOUTUBE", "VIMEO", "DUMMY"],
      default: "DUMMY",
      required: true,
    },

    // Rule: Course videos can be represented by dummy metadata/path for MVP.
    path: {
      type: String,
      required: true,
      trim: true,
    },

    durationSeconds: {
      type: Number,
      min: 0,
    },

    thumbnailPath: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

const lessonSchema = new Schema<ILesson>(
  {
    course: {
      type: Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    order: {
      type: Number,
      required: true,
      min: 1,
    },
    summary: {
      type: String,
      trim: true,
    },
    video: {
      type: videoMetadataSchema,
      required: true,
    },
    contentMarkdown: {
      type: String,
    },
  },
  { timestamps: true }
);

lessonSchema.index({ course: 1, order: 1 }, { unique: true });

export const Lesson: Model<ILesson> =
  mongoose.models.Lesson || mongoose.model<ILesson>("Lesson", lessonSchema);