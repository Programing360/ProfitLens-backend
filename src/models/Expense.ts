import { Schema, model, Document, Types } from "mongoose";

export interface IExpense extends Document {
  businessId: Types.ObjectId;
  productId?: Types.ObjectId;
  title: string;
  amount: number;
  category: string;
  expenseDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

const expenseSchema = new Schema<IExpense>(
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
      required: false,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    category: {
      type: String,
      required: true,
      default: "General",
    },

    expenseDate: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

export const Expense = model<IExpense>("Expense", expenseSchema);
