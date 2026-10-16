import { Schema, model, Document, Types } from "mongoose";

export interface ILeakAlert extends Document {
  productId: Types.ObjectId;
  productName: string;
  issueType:
    | "LOW_MARGIN"
    | "SLOW_MOVING_INVENTORY"
    | "HIGH_COST"
    | "EXPENSE_SPIKE"
    | "SALES_DECLINE";
  severity: "HIGH" | "MEDIUM" | "LOW";
  message: string;
  evidence: {
    metric: string;
    actualValue: number;
    threshold: number;
    unit: string;
  };
  suggestedAction: string;
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
  detectedAt: Date;
}

const alertSchema = new Schema<ILeakAlert>({
  productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
  productName: { type: String, required: true },
  issueType: {
    type: String,
    enum: [
      "LOW_MARGIN",
      "SLOW_MOVING_INVENTORY",
      "HIGH_COST",
      "EXPENSE_SPIKE",
      "SALES_DECLINE",
    ],
    required: true,
  },
  severity: { type: String, enum: ["HIGH", "MEDIUM", "LOW"], required: true },
  message: { type: String, required: true },
  evidence: {
    metric: { type: String, required: true },
    actualValue: { type: Number, required: true },
    threshold: { type: Number, required: true },
    unit: { type: String, required: true },
  },
  suggestedAction: { type: String, required: true },
  status: {
    type: String,
    enum: ["OPEN", "ACKNOWLEDGED", "RESOLVED"],
    default: "OPEN",
  },
  detectedAt: { type: Date, default: Date.now },
});

export const Alert = model<ILeakAlert>("Alert", alertSchema);
