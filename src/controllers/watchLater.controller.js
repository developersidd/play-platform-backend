import { isValidObjectId } from "mongoose";
import Video from "../models/video.model.js";
import WatchLater from "../models/watchLater.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import {
  checkCache,
  generateCacheKey,
  revalidateCache,
  setCache,
} from "../utils/redis.util.js";

// crate a new playlist
const addVideoInWatchLater = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const userId = req?.user?._id;
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid Video Id");
  }
  // Check if video exists
  if (!(await Video.exists({ _id: videoId, isPublished: true }))) {
    throw new ApiError(404, "Video not found or not published");
  }
  // check if video already exists in watch later
  const videoExists = await WatchLater.findOne({
    user: userId,
    "videos.video": videoId,
  }).lean();
  console.log(" videoExists:", videoExists)
  if (!videoExists) {
    const watchLaterItem = await WatchLater.findOneAndUpdate(
      { user: userId },
      { $push: { videos: { video: videoId } } },
      { upsert: true, new: true }
    );
    return res
      .status(200)
      .json(new ApiResponse(200, watchLaterItem, "Video Added to Watch Later"));
  }
});

// get a user watch later
const getUserWatchLaterVideos = asyncHandler(async (req, res) => {
  const userId = req?.user?._id;
  // cache key
  const cacheKey = generateCacheKey("watchLater", userId);
  // check cache
  const cachedData = await checkCache(req, cacheKey);
  await revalidateCache(req, cacheKey);
  if (cachedData) {
    return res.status(200).json(cachedData);
  }
  const watchLater = await WatchLater.findById({ user: userId })
    .populate({
      path: "user",
      select: "username avatar _id fullName",
    })
    .populate({
      path: "videos",
      select: "thumbnail title views duration createdAt owner",
      // also populate the owner of the video
      populate: {
        path: "owner",
        select: "username avatar _id fullName",
      },
    })
    .lean();

  if (!watchLater) {
    throw new ApiError(404, "User watch later videos not found");
  }
  // cache the response
  const response = new ApiResponse(200, watchLater, "watch later videos found");
  await setCache(req, response, cacheKey);
  return res.status(200).json(response);
});

// remove  video from watch later videos
const removeVideoFromWatchLater = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const userId = req?.user?._id;
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid Video Id");
  }
  const watchLaterItem = await WatchLater.findOneAndUpdate(
    { user: userId },
    { $pull: { videos: { video: videoId } } },
    { new: true }
  );

  return res
    .status(200)
    .json(
      new ApiResponse(200, watchLaterItem, "Video removed from Watch Later")
    );
});

export {
  addVideoInWatchLater,
  getUserWatchLaterVideos,
  removeVideoFromWatchLater,
};
