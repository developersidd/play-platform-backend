import { Schema, Types, model } from "mongoose";

const likeSchema = new Schema(
  {
    comment: {
      type: Types.ObjectId,
      ref: "Comment",
    },
    likedBy: {
      type: Types.ObjectId,
      ref: "User",
      required: [true, "User Id is required"],
      index: true,
    },

    video: {
      type: Types.ObjectId,
      ref: "Video",
    },
    tweet: {
      type: Types.ObjectId,
      ref: "Video",
    },
  },
  { timestamps: true }
);
const Like = model("Like", likeSchema);
export default Like;
