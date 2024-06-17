import { isValidObjectId } from "mongoose";
import Comment from "../models/comment.model.js";
import Like from "../models/like.model.js";
import Tweet from "../models/tweet.model.js";
import Video from "../models/video.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

const toggleVideoLike = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video id");
  }
  // check if video exists
  if (!(await Video.exists({ _id: videoId }))) {
    throw new ApiError(404, "Video not found");
  }

  const existingLike = await Like.findOne({
    video: videoId,
    likedBy: req.user._id,
  });
  if (existingLike) {
    await Like.findByIdAndDelete(existingLike._id);
    return res.status(200).json(new ApiResponse(200, null, "Disliked"));
  }
  const videoLike = await Like.create({ video: videoId, likedBy: req.user._id });

  return res.status(200).json(new ApiResponse(200, videoLike, "Liked"));
});

const toggleCommentLike = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  if (!isValidObjectId(commentId)) {
    throw new ApiError(400, "Invalid comment id");
  }
  // check if comment exists
  if (!(await Comment.exists({ _id: commentId }))) {
    throw new ApiError(404, "Comment not found");
  }
  const existingLike = await Like.findOne({
    comment: commentId,
    likedBy: req.user._id,
  });
  if (existingLike) {
    await Like.findByIdAndDelete(existingLike._id);
    return res.status(200).json(new ApiResponse(200, null, "Disliked"));
  }
   const commentLike =await Like.create({ comment: commentId, likedBy: req.user._id });

  return res.status(200).json(new ApiResponse(200, commentLike, "Liked"));
});

const toggleTweetLike = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;
  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, "Invalid tweet id");
  }
  // check if tweet exists
  if (!(await Tweet.exists({ _id: tweetId }))) {
    throw new ApiError(404, "Tweet not found");
  }

  const existingLike = await Like.findOne({
    tweet: tweetId,
    likedBy: req.user._id,
  });
  if (existingLike) {
    await Like.findByIdAndDelete(existingLike._id);
    return res.status(200).json(new ApiResponse(200, null, "Disliked"));
  }
  const tweetLike = await Like.create({ tweet: tweetId, likedBy: req.user._id });
  return res.status(200).json(new ApiResponse(200, tweetLike, "Liked"));
});

const getLikedVideos = asyncHandler(async (req, res) => {
  // TODO: get all liked videos
  console.log("Hello");
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
