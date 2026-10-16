import { Schema, model, Document, Types } from "mongoose";

export interface IProduct extends Document {
  businessId: Types.ObjectId;
  name: string;
  category: string;
  productCost: number;
  sellingPrice: number;
  stockQuantity: number;
  otherCosts: number;
  createdAt: Date;
}

const productSchema = new Schema<IProduct>(
  {
    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      required: true,
      index: true,
    },
    name: { type: String, required: true },
    category: { type: String, required: true },
    productCost: { type: Number, required: true },
    sellingPrice: { type: Number, required: true },
    stockQuantity: { type: Number, required: true, default: 0 },
    otherCosts: { type: Number, required: true, default: 0 },
  },
  { timestamps: true },
);

export const Product = model<IProduct>("Product", productSchema);
