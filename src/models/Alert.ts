import { Schema, model, Document, Types } from "mongoose";

export type LeakIssueType =
  | "LOW_MARGIN"
  | "SLOW_MOVING_INVENTORY"
  | "HIGH_COST"
  | "EXPENSE_SPIKE"
  | "SALES_DECLINE";

export type LeakSeverity = "HIGH" | "MEDIUM" | "LOW";

export type LeakAlertStatus = "OPEN" | "ACKNOWLEDGED" | "RESOLVED";

export interface ILeakAlert extends Document {
  businessId: Types.ObjectId;
  productId: Types.ObjectId;
  productName: string;

  issueType: LeakIssueType;
  severity: LeakSeverity;

  message: string;

  evidence: {
    metric: string;
    actualValue: number;
    threshold: number;
    unit: string;
  };

  suggestedAction: string;

  status: LeakAlertStatus;
  detectedAt: Date;
}

const alertSchema = new Schema<ILeakAlert>(
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

    productName: {
      type: String,
      required: true,
      trim: true,
    },

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

    severity: {
      type: String,
      enum: ["HIGH", "MEDIUM", "LOW"],
      required: true,
    },

    message: {
      type: String,
      required: true,
    },

    evidence: {
      metric: {
        type: String,
        required: true,
      },

      actualValue: {
        type: Number,
        required: true,
      },

      threshold: {
        type: Number,
        required: true,
      },

      unit: {
        type: String,
        required: true,
      },
    },

    suggestedAction: {
      type: String,
      required: true,
    },

    status: {
      type: String,
      enum: ["OPEN", "ACKNOWLEDGED", "RESOLVED"],
      default: "OPEN",
    },

    detectedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

// Business-scoped query দ্রুত করার জন্য index
alertSchema.index({
  businessId: 1,
  status: 1,
  detectedAt: -1,
});

export const Alert = model<ILeakAlert>("Alert", alertSchema);
