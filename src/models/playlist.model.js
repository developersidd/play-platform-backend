import { Schema, Types, model } from "mongoose";

const playlistSchema = new Schema(
  {
    name: {
      type: String,
      trim: true,
      unique: true,
      required: [true, "Name is Required"],
    },
    description: {
      type: String,
      required: [true, "Description is Required"],
    },
    owner: {
      type: Types.ObjectId,
      ref: "User",
    },

    videos: [
      {
        type: Types.ObjectId,
        ref: "Video",
      },
    ],
  },
  { timestamps: true }
);
const Playlist = model("Playlist", playlistSchema);
export default Playlist;
