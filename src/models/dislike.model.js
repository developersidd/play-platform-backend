import { Schema, Types, model } from "mongoose";

const dislikeSchema = new Schema(
  {
    tweet: {
      type: Types.ObjectId,
      ref: "Video",
    },
    comment: {
      type: Types.ObjectId,
      ref: "Comment",
    },
    dislikedBy: {
      type: Types.ObjectId,
      ref: "User",
      required: [true, "User Id is required"],
    },
    video: {
      type: Types.ObjectId,
      ref: "Video",
    },
  },
  { timestamps: true }
);
const DisLike = model("DisLike", dislikeSchema);
export default DisLike;
