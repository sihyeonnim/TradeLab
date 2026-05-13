import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IHolding extends Document {
  _id: Types.ObjectId;
  portfolio: Types.ObjectId;
  asset: Types.ObjectId;
  quantity: number;
  averageBuyPrice: number;
  createdAt: Date;
  updatedAt: Date;
}

const holdingSchema = new Schema<IHolding>(
  {
    portfolio: {
      type: Schema.Types.ObjectId,
      ref: "Portfolio",
      required: true,
      index: true,
    },
    asset: {
      type: Schema.Types.ObjectId,
      ref: "Asset",
      required: true,
      index: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },
    averageBuyPrice: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { timestamps: true }
);

holdingSchema.index({ portfolio: 1, asset: 1 }, { unique: true });

export const Holding: Model<IHolding> =
  mongoose.models.Holding ||
  mongoose.model<IHolding>("Holding", holdingSchema);