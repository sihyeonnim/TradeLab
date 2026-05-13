import mongoose, { Document, Model, Schema, Types } from "mongoose";

export enum OrderSide {
  BUY = "BUY",
  SELL = "SELL",
}

export enum OrderType {
  MARKET = "MARKET",
}

export enum OrderStatus {
  PENDING = "PENDING",
  EXECUTED = "EXECUTED",
  CANCELLED = "CANCELLED",
  FAILED = "FAILED",
}

export interface IOrder extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  portfolio: Types.ObjectId;
  asset: Types.ObjectId;
  side: OrderSide;
  type: OrderType;
  status: OrderStatus;
  quantity: number;
  requestedPrice?: number;
  executedPrice?: number;
  executedAt?: Date;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const orderSchema = new Schema<IOrder>(
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
      required: true,
      index: true,
    },
    asset: {
      type: Schema.Types.ObjectId,
      ref: "Asset",
      required: true,
      index: true,
    },

    side: {
      type: String,
      enum: Object.values(OrderSide),
      required: true,
    },

    // MVP rule: only market orders are required.
    type: {
      type: String,
      enum: Object.values(OrderType),
      default: OrderType.MARKET,
      required: true,
    },

    status: {
      type: String,
      enum: Object.values(OrderStatus),
      default: OrderStatus.PENDING,
      required: true,
      index: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 0.000001,
    },

    requestedPrice: {
      type: Number,
      min: 0,
    },

    // MVP rule: market orders execute immediately at the last fetched price.
    executedPrice: {
      type: Number,
      min: 0,
    },

    executedAt: {
      type: Date,
    },

    failureReason: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

export const Order: Model<IOrder> =
  mongoose.models.Order || mongoose.model<IOrder>("Order", orderSchema);