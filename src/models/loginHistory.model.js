import { Schema, model } from "mongoose";

const loginHistorySchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
    },
    isActive: {
      type: Boolean,
    },
    token: {
      type: String,
      required: [true, "Token is required"],
      unique: true,
    },
    deviceInfo: {
      type: Object,
      required: [true, "Device info is required"],
    },
    userAgent: {
      type: String,
      required: [true, "User agent is required"],
    },
    ip: {
      type: String,
      required: [true, "IP is required"],
    },
  },
  { timestamps: true }
);
const LoginHistory = model("LoginHistory", loginHistorySchema);
export default LoginHistory;
