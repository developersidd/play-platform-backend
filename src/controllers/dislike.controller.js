import { isValidObjectId } from "mongoose";
import Comment from "../models/comment.model.js";
import DisLike from "../models/dislike.model.js";
import Tweet from "../models/tweet.model.js";
import Video from "../models/video.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { checkCache, generateCacheKey, revalidateCache, setCache } from "../utils/redis.util.js";

const toggleVideoDisLike = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  console.log("videoId:", videoId);
  const videoCacheKey = generateCacheKey("video", videoId);
  await revalidateCache(req, videoCacheKey);

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video id");
  }
  // check if video exists
  if (!(await Video.exists({ _id: videoId }))) {
    throw new ApiError(404, "Video not found");
  }

  const existingDisLike = await DisLike.findOne({
    video: videoId,
    dislikedBy: req.user._id,
  });
  if (existingDisLike) {
    await DisLike.findByIdAndDelete(existingDisLike._id);
    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Disdisliked removed"));
  }
  const videodisLike = await DisLike.create({
    video: videoId,
    dislikedBy: req.user._id,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, videodisLike, "DisLiked video "));
});

const toggleCommentDisLike = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  if (!isValidObjectId(commentId)) {
    throw new ApiError(400, "Invalid comment id");
  }
  // check if comment exists
  if (!(await Comment.exists({ _id: commentId }))) {
    throw new ApiError(404, "Comment not found");
  }
  const existingDisLike = await DisLike.findOne({
    comment: commentId,
    dislikedBy: req.user._id,
  });
  if (existingDisLike) {
    await DisLike.findByIdAndDelete(existingDisLike._id);
    return res.status(200).json(new ApiResponse(200, {}, "Disdisliked"));
  }
  const commentDisLike = await DisLike.create({
    comment: commentId,
    dislikedBy: req.user._id,
  });

  return res.status(200).json(new ApiResponse(200, commentDisLike, "disLiked"));
});

const toggleTweetDisLike = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;
  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, "Invalid tweet id");
  }
  // check if tweet exists
  if (!(await Tweet.exists({ _id: tweetId }))) {
    throw new ApiError(404, "Tweet not found");
  }

  const existingDisLike = await DisLike.findOne({
    tweet: tweetId,
    dislikedBy: req.user._id,
  });
  if (existingDisLike) {
    await DisLike.findByIdAndDelete(existingDisLike._id);
    return res.status(200).json(new ApiResponse(200, {}, "Disdisliked"));
  }
  const tweetDisLike = await DisLike.create({
    tweet: tweetId,
    dislikedBy: req.user._id,
  });
  return res.status(200).json(new ApiResponse(200, tweetDisLike, "disLiked"));
});

const getDisLikedVideos = asyncHandler(async (req, res) => {
  // TODO: get all disliked videos
  const videos = await DisLike.aggregate([
    {
      $match: {
        dislikedBy: req.user._id,
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
  const response = new ApiResponse(200, videos, "disLiked videos found");
  // cache the response
  const { redisClient } = req.app.locals || {};
  redisClient.setEx(req.originalUrl, 3600, JSON.stringify(response));
  return res.status(200).json();
});

const getVideoDisLikes = asyncHandler(async (req, res) => {
  const { videoId } = req.params || {};
  const { userId } = req.query || {};

  const cacheKey = generateCacheKey("video-dislikes", videoId);
  const cachedData = await checkCache(req, cacheKey);

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

  const dislikes = await DisLike.countDocuments({
    video: videoId,
  });
  console.log("dislikes:", dislikes)

  const isDisliked =
    userId &&
    (await DisLike.exists({
      video: videoId,
      dislikedBy: userId,
    }));
  const response = new ApiResponse(
    200,
    {
      dislikes,
      isDisliked: !!isDisliked?._id,
    },
    "video dislikes count"
  );

  await setCache(req, JSON.stringify(response), cacheKey);

  return res.status(200).json(response);
});

export {
  getDisLikedVideos,
  getVideoDisLikes,
  toggleCommentDisLike,
  toggleTweetDisLike,
  toggleVideoDisLike,
};
