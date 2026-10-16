import { Schema, model, Document, Types } from "mongoose";

export interface IBusiness extends Document {
  name: string;
  ownerId: Types.ObjectId;

  settings: {
    lowMarginThreshold: number;
    slowMovingDays: number;
    minimumStockForSlowMoving: number;
    maximumSalesForSlowMoving: number;
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
    },
  },
  {
    timestamps: true,
  },
);

export const Business = model<IBusiness>("Business", businessSchema);
