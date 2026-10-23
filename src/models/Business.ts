import { Schema, model, Document, Types } from "mongoose";

export interface IBusiness extends Document {
  name: string;
  ownerId: Types.ObjectId;

  settings: {
    lowMarginThreshold: number;
    slowMovingDays: number;
    minimumStockForSlowMoving: number;
    maximumSalesForSlowMoving: number;
    lowStockThreshold: number;
    currency: string;
  };

  createdAt: Date;
  updatedAt: Date;
}

const businessSchema = new Schema<IBusiness>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    settings: {
      lowMarginThreshold: {
        type: Number,
        default: 15,
        min: 0,
        max: 100,
      },

      slowMovingDays: {
        type: Number,
        default: 30,
        min: 1,
        max: 365,
      },

      minimumStockForSlowMoving: {
        type: Number,
        default: 30,
        min: 0,
      },

      maximumSalesForSlowMoving: {
        type: Number,
        default: 5,
        min: 0,
      },

      lowStockThreshold: {
        type: Number,
        default: 10,
        min: 0,
      },

      currency: {
        type: String,
        enum: ["BDT", "USD", "EUR", "GBP", "INR"],
        default: "BDT",
      },
    },
  },
  {
    timestamps: true,
  },
);

export const Business = model<IBusiness>("Business", businessSchema);
