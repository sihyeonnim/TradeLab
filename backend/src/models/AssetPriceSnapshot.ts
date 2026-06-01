import mongoose, { Document, Model, Schema, Types } from "mongoose";

/**
 * A point-in-time price for an asset, recorded every time prices are refreshed.
 * These accumulate into a short price-history series the dashboard renders as a
 * per-asset sparkline so users can see recent price movement.
 */
export interface IAssetPriceSnapshot extends Document {
  _id: Types.ObjectId;
  asset: Types.ObjectId;
  price: number;
  createdAt: Date;
  updatedAt: Date;
}

const assetPriceSnapshotSchema = new Schema<IAssetPriceSnapshot>(
  {
    asset: {
      type: Schema.Types.ObjectId,
      ref: "Asset",
      required: true,
      index: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { timestamps: true }
);

assetPriceSnapshotSchema.index({ asset: 1, createdAt: 1 });

// Auto-expire snapshots after 7 days so the history collection stays bounded
// despite frequent auto-refresh writes. Override with PRICE_SNAPSHOT_TTL_DAYS.
const ttlDays = Number(process.env.PRICE_SNAPSHOT_TTL_DAYS) || 7;
assetPriceSnapshotSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: ttlDays * 24 * 60 * 60 }
);

export const AssetPriceSnapshot: Model<IAssetPriceSnapshot> =
  mongoose.models.AssetPriceSnapshot ||
  mongoose.model<IAssetPriceSnapshot>(
    "AssetPriceSnapshot",
    assetPriceSnapshotSchema
  );
