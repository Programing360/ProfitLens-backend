import { Schema, model, Types } from "mongoose";

export interface IUser {
  name: string;
  email: string;
  passwordHash: string;
  businessId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    passwordHash: {
      type: String,
      required: true,
      select: false,
    },

    businessId: {
      type: Schema.Types.ObjectId,
      ref: "Business",
      default: undefined,
    },
  },
  {
    timestamps: true,
  },
);

export const User = model<IUser>("User", userSchema);
