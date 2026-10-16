import { Schema, model, Document, Types } from "mongoose";

export interface IExpense extends Document {
  productId?: Types.ObjectId; // Jodi kono nirdisto product-er sathe jukto thake (optional)
  title: string;
  amount: number;
  category: string; // e.g., 'Transport', 'Utilities', 'Marketing'
  expenseDate: Date;
}

const expenseSchema = new Schema<IExpense>(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: false },
    title: { type: String, required: true },
    amount: { type: Number, required: true },
    category: { type: String, required: true, default: "General" },
    expenseDate: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export const Expense = model<IExpense>("Expense", expenseSchema);
