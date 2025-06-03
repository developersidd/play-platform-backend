import { Schema, model } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const videoSchema = new Schema(
  {
    video: {
      type: {
        url: {
          type: String,
          required: [true, "Video URL is required"],
        },
        public_id: {
          type: String,
          required: [true, "Video public ID is required"],
        },
      },
      required: [true, "Video is required"],
    },
    thumbnail: {
      type: {
        url: {
          type: String,
          required: [true, "Thumbnail URL is required"],
        },
        public_id: {
          type: String,
          required: [true, "Thumbnail public ID is required"],
        },
      },
      required: true,
    },

    title: {
      type: String,
      required: [true, "Title is required"],
    },

    description: {
      type: String,
      required: [true, "Description is required"],
    },
    duration: {
      type: String,
      required: [true, "Duration is required"],
    },
    views: {
      type: Number,
      default: 0,
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    tags: {
      type: [String],
      required: [true, "Tags are required"],
    },
  },
  { timestamps: true }
);

videoSchema.plugin(mongooseAggregatePaginate);

const Video = model("Video", videoSchema);
export default Video;
