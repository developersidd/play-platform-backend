import { Schema, Types, model } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const commentSchema = new Schema(
  {
    content: {
      type: String,
      required: [true, "Content is required"],
    },
    owner: {
      type: Types.ObjectId,
      ref: "User",
      required: [true, "Owner Id is required"],
    },

    video: {
      type: Types.ObjectId,
      ref: "Video",
      required: [true, "Video Id is required"],
    },
  },
  { timestamps: true }
);
const Comment = model("Comment", commentSchema);
commentSchema.plugin(mongooseAggregatePaginate);
export default Comment;
