import { Schema, model, Document, Types } from "mongoose";

export interface ISale extends Document {
  businessId: Types.ObjectId;
  productId: Types.ObjectId;
  quantitySold: number;
  totalRevenue: number;

  // Cost snapshot at transaction time
  unitCostAtSale: number;
  packagingCost: number;
  deliveryCost: number;
  paymentFee: number;
  otherVariableCosts: number;

  saleDate: Date;
}

const salesSchema = new Schema<ISale>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    quantitySold: {
      type: Number,
      required: true,
      min: 1,
    },

    totalRevenue: {
      type: Number,
      required: true,
      min: 0,
    },

    unitCostAtSale: {
      type: Number,
      required: true,
      min: 0,
    },

    packagingCost: {
      type: Number,
      default: 0,
      min: 0,
    },

    deliveryCost: {
      type: Number,
      default: 0,
      min: 0,
    },

    paymentFee: {
      type: Number,
      default: 0,
      min: 0,
    },

    otherVariableCosts: {
      type: Number,
      default: 0,
      min: 0,
    },

    saleDate: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

export const Sale = model<ISale>("Sale", salesSchema);
