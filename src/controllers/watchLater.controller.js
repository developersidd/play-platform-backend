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
import { createMongoId } from "../utils/mongodb.util.js";

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
  const isVideoInWatchLater = await WatchLater.exists({
    owner: userId,
    "videos.video": videoId,
  });
  let watchLaterItem;
  // if userWatchLater is not found, create a new one
  if (!isVideoInWatchLater) {
    const userWatchLater = await WatchLater.findOne({
      owner: userId,
    });
    // calculate the position of the new video
    const totalVideosLength = userWatchLater?.videos?.length;
    watchLaterItem = await WatchLater.findOneAndUpdate(
      { owner: userId },
      {
        $push: {
          videos: {
            video: videoId,
            position: totalVideosLength || 0,
          },
        },
      },
      { upsert: true, new: true }
    );
  }
  // Revalidate the cache
  await revalidateCache(req, generateCacheKey("watchLater", userId));
  return res
    .status(200)
    .json(new ApiResponse(200, watchLaterItem, "Video Added to Watch Later"));
});

// get a user watch later
const getUserWatchLaterVideos = asyncHandler(async (req, res) => {
  const userId = req?.user?._id?.toString();
  // cache key
  const cacheKey = generateCacheKey("watchLater", userId);
  // check cache
  const cachedData = await checkCache(req, cacheKey);
  await revalidateCache(req, cacheKey);
  if (cachedData) {
    return res.status(200).json(cachedData);
  }

  const watchLater = await WatchLater.aggregate([
    { $match: { owner: createMongoId(userId) } },
    {
      $unwind: "$videos",
    },
    {
      $lookup: {
        from: "videos",
        localField: "videos.video",
        foreignField: "_id",
        as: "videos.video",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  $project: {
                    username: 1,
                    avatar: 1,
                    _id: 1,
                    fullName: 1,
                  },
                },
              ],
            },
          },
          {
            $set: {
              owner: { $arrayElemAt: ["$owner", 0] },
            },
          },
          {
            $project: {
              title: 1,
              thumbnail: 1,
              duration: 1,
              views: 1,
              owner: 1,
              createdAt: 1,
            },
          },
        ],
      },
    },

    {
      $set: {
        video: { $arrayElemAt: ["$videos.video", 0] },
      },
    },
    {
      $addFields: {
        position: "$videos.position",
        _id: "$videos._id",
        addedAt: "$videos.addedAt",
      },
    },
    {
      $project: {
        video: 1,
        position: 1,
        _id: 1,
        addedAt: 1,
      }
    },
    {
      $sort: {
        position: 1,
      },
    },
  ]);
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
    { owner: userId },
    { $pull: { videos: { video: videoId } } },
    { new: true }
  );
  await revalidateCache(req, generateCacheKey("watchLater", userId));
  return res
    .status(200)
    .json(
      new ApiResponse(200, watchLaterItem, "Video removed from Watch Later")
    );
});

// update videos positions in watch later  using bulk update
const updateVideoPositionsInWatchLater = asyncHandler(async (req, res) => {
  const { items } = req.body;
  console.log(" items:", items);
  const userId = req?.user?._id;
  if (!Array.isArray(items)) {
    throw new ApiError(400, "Invalid videos array");
  }
  const bulkOps = items.map(({ videoId, position }) => ({
    updateOne: {
      filter: { owner: userId, "videos.video": videoId },
      update: { $set: { "videos.$.position": position } },
    },
  }));
  const data = await WatchLater.bulkWrite(bulkOps);

  console.log(" data:", data);
  await revalidateCache(req, generateCacheKey("watchLater", userId));
  return res.status(200).json(new ApiResponse(200, {}, "Positions updated"));
});

export {
  addVideoInWatchLater,
  getUserWatchLaterVideos,
  removeVideoFromWatchLater,
  updateVideoPositionsInWatchLater,
};
