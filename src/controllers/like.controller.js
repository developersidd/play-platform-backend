import { isValidObjectId } from "mongoose";
import Like from "../models/like.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

const toggleVideoLike = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video id");
  }
  const existingLike = await Like.findOne({
    video: videoId,
    likedBy: req.user._id,
  });
  if (existingLike) {
    await Like.findByIdAndDelete(existingLike._id);
  } else {
    await Like.create({ video: videoId, likedBy: req.user._id });
  }
  return res.status(200).json(new ApiResponse(200, "Success", null));
});

const toggleCommentLike = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  if (!isValidObjectId(commentId)) {
    throw new ApiError(400, "Invalid comment id");
  }
  const existingLike = await Like.findOne({
    comment: commentId,
    likedBy: req.user._id,
  });
  if (existingLike) {
    await Like.findByIdAndDelete(existingLike._id);
  } else {
    await Like.create({ comment: commentId, likedBy: req.user._id });
  }
  return res.status(200).json(new ApiResponse(200, "Success", null));
});

const toggleTweetLike = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;
  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, "Invalid tweet id");
  }
  const existingLike = await Like.findOne({
    tweet: tweetId,
    likedBy: req.user._id,
  });
  if (existingLike) {
    await Like.findByIdAndDelete(existingLike._id);
  } else {
    await Like.create({ tweet: tweetId, likedBy: req.user._id });
  }
  return res.status(200).json(new ApiResponse(200, "Success", null));
});

const getLikedVideos = asyncHandler(async (req, res) => {
  // TODO: get all liked videos
  console.log("Hello")
  const videos = await Like.aggregate([
    {
      $match: {
        likedBy: req.user._id,
        video: { $exists: true },
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "video",
        foreignField: "_id",
        as: "video",
      },
    },
    // { $unwind: "$video" },
  ]);
  console.log(videos);
  return res.status(200).json(new ApiResponse(200, "Success", videos));
});

export { getLikedVideos, toggleCommentLike, toggleTweetLike, toggleVideoLike };
