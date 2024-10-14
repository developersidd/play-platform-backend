import { isValidObjectId } from "mongoose";
import Comment from "../models/comment.model.js";
import Like from "../models/like.model.js";
import Tweet from "../models/tweet.model.js";
import Video from "../models/video.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { generateCacheKey, revalidateRelatedCaches } from "../utils/redis.util.js";

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
    return res.status(200).json(new ApiResponse(200, {}, "Disliked"));
  }
  const videoLike = await Like.create({
    video: videoId,
    likedBy: req.user._id,
  });

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
    return res.status(200).json(new ApiResponse(200, {}, "Disliked"));
  }
  const commentLike = await Like.create({
    comment: commentId,
    likedBy: req.user._id,
  });

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
  // delete user tweets cache
  await revalidateRelatedCaches(req, "user-tweets");
  if (existingLike) {
    await Like.findByIdAndDelete(existingLike._id);
    return res.status(200).json(new ApiResponse(200, {}, "Liked removed"));
  }
  const tweetLike = await Like.create({
    tweet: tweetId,
    likedBy: req.user._id,
  });
  return res.status(200).json(new ApiResponse(200, tweetLike, "Liked"));
});

const getLikedVideos = asyncHandler(async (req, res) => {
  // TODO: get all liked videos
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
    {
      $addFields: {
        video: { $first: "$video" },
      },
    },
  ]);
  const response = new ApiResponse(200, videos, "Liked videos found");
  // cache the response
  const { redisClient } = req.app.locals || {};
  redisClient.setEx(req.originalUrl, 3600, JSON.stringify(response));
  return res.status(200).json();
});

const getVideoLikes = asyncHandler(async (req, res) => {
  const { videoId } = req.params || {};
  const { userId } = req.query || {};

  const { redisClient } = req.app.locals || {};
  const cachedData = await redisClient.get("video-likes");

  if (cachedData) {
    console.log("from cache");
    return res.status(200).json(JSON.parse(cachedData));
  }
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video id");
  }
  // check if video exists
  if (!(await Video.exists({ _id: videoId }))) {
    throw new ApiError(404, "Video not found");
  }

  const likes = await Like.countDocuments({ video: videoId });

  const isLiked =
    userId &&
    (await Like.exists({
      video: videoId,
      likedBy: userId,
    }));
  const response = new ApiResponse(
    200,
    {
      likes,
      isLiked: !!isLiked?._id,
    },
    "video likes count"
  );

  await redisClient.setEx("video-likes", 3600, JSON.stringify(response));
  return res.status(200).json(response);
});

export {
  getLikedVideos,
  getVideoLikes,
  toggleCommentLike,
  toggleTweetLike,
  toggleVideoLike,
};
