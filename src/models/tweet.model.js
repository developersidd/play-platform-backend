import { Schema, Types, model } from "mongoose";

const tweetSchema = new Schema(
  {
    owner: {
      type: Types.ObjectId,
      ref: "User",
    },
    content: {
      type: String,
      required: [true, "Content is required"],
    },
  },
  { timestamps: true }
);
const Tweet = model("Tweet", tweetSchema);
export default Tweet;
