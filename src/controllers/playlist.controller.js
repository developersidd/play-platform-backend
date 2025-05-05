import { isValidObjectId } from "mongoose";
import verifyJWT from "../middlewares/auth.middleware.js";
import Playlist from "../models/playlist.model.js";
import Subscription from "../models/subscription.model.js";
import User from "../models/user.model.js";
import Video from "../models/video.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { createMongoId } from "../utils/mongodb.util.js";
import {
  checkCache,
  generateCacheKey,
  revalidateCache,
  revalidateRelatedCaches,
  setCache,
} from "../utils/redis.util.js";
import { getUserWatchLaterVideos } from "./watchLater.controller.js";

// crate a new playlist
const createPlaylist = asyncHandler(async (req, res) => {
  // const {userId} = req.params;
  const {
    name,
    description,
    type = "playlist",
    videos = [],
    isPrivate = false,
  } = req.body;
  if (!name?.trim()) {
    throw new ApiError(400, "Name is required");
  }
  if (type === "videPlaylist" && !videos.length) {
    throw new ApiError(400, "Videos are required for playlist");
  }
  const playlist = await Playlist.create({
    name,
    description,
    type,
    videos,
    isPrivate,
    owner: req.user?._id,
  });
  await revalidateRelatedCaches(req, "user-playlist", req.user._id);
  return res
    .status(201)
    .json(new ApiResponse(201, playlist, "Playlist created"));
});

// get all playlists of a user
const getUserPlaylists = asyncHandler(async (req, res) => {
  const { username = "" } = req.params || {};
  const { isPrivate = false } = req.query || {};
  if (!username) {
    throw new ApiError(400, "Invalid User Name");
  }
  const user = await User.findOne({ username }).select("_id");
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  // cache key
  const cacheKey = generateCacheKey("user-playlist", user?._id, req.query);
  // check cache
  await revalidateCache(req, cacheKey);
  const cachedData = await checkCache(req, cacheKey);
  if (cachedData) {
    return res.status(200).json(cachedData);
  }

  const result = await Playlist.aggregate([
    // Match the specific playlist
    {
      $match: { owner: createMongoId(user?._id), isPrivate, type: "playlist" },
    },

    // Add totalVideos field with the length of the videos array
    { $addFields: { totalVideos: { $size: "$videos" } } },

    // Lookup to populate only the first video
    {
      $lookup: {
        from: "videos",
        localField: "videos",
        foreignField: "_id",
        as: "populatedVideos",

        pipeline: [
          { $limit: 1 },
          {
            $project: {
              thumbnail: 1,
              title: 1,
              views: 1,
              duration: 1,
              createdAt: 1,
            },
          },
        ], // Populate only the first video
      },
    },

    // Replace the first video in the videos array with the populated one
    {
      $addFields: {
        videos: {
          $concatArrays: [
            { $slice: ["$populatedVideos", 1] }, // Replace the first video ID with the populated video
            { $slice: ["$videos", 1, { $size: "$videos" }] }, // Retain the rest of the video IDs
          ],
        },
      },
    },

    // Remove the temporary populatedVideos array
    { $project: { populatedVideos: 0 } },
  ]);

  // cache the response
  const response = new ApiResponse(200, result, "User playlists found");
  await setCache(req, response, cacheKey);
  return res.status(200).json(response);
});

// get user collections
const getUserCollections = asyncHandler(async (req, res) => {
  const { isPrivate = false, expand = false } = req.query || {};
  const { _id: userId } = req.user;
  console.log(" userId:", userId);
  // cache key
  const cacheKey = generateCacheKey("user-collection", userId, req.query);
  // check cache
  await revalidateCache(req, cacheKey);
  // const cachedData = await checkCache(req, cacheKey);
  // if (cachedData) {
  //  return res.status(200).json(cachedData);
  // }
  //

  let result;
  if (!expand) {
    result = await Playlist.find({
      owner: userId,
      type: "collection",
      isPrivate,
    }).select("-description");
  } else {
    console.log("expand", expand);
    result = await Playlist.aggregate([
      {
        $match: {
          owner: createMongoId(userId),
          type: "collection",
          isPrivate,
          videos: { $exists: true, $ne: [] },
        },
      },

      // Add totalVideos field with the length of the videos array
      { $addFields: { totalVideos: { $size: "$videos" } } },

      // Lookup to populate only the first video
      {
        $lookup: {
          from: "videos",
          localField: "videos",
          foreignField: "_id",
          as: "populatedVideos",

          pipeline: [
            { $limit: 1 },
            {
              $project: {
                thumbnail: 1,
                title: 1,
                views: 1,
                duration: 1,
                createdAt: 1,
              },
            },
          ], // Populate only the first video
        },
      },

      // Replace the first video in the videos array with the populated one
      {
        $addFields: {
          videos: {
            $concatArrays: [
              { $slice: ["$populatedVideos", 1] }, // Replace the first video ID with the populated video
              { $slice: ["$videos", 1, 10000] }, // Retain the rest of the video IDs
            ],
          },
        },
      },

      // Remove the temporary populatedVideos array
      { $project: { populatedVideos: 0 } },
    ]);
  }

  // cache the response
  const response = new ApiResponse(200, result, "User Collection found");
  await setCache(req, response, cacheKey);
  return res.status(200).json(response);
});

// get a playlist by Id
const getPlaylistById = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  if (!isValidObjectId(playlistId)) {
    throw new ApiError(400, "Invalid Playlist Name");
  }
  // cache key
  const cacheKey = generateCacheKey("playlist", playlistId);
  // check cache
  const cachedData = await checkCache(req, cacheKey);
  await revalidateCache(req, cacheKey);
  if (cachedData) {
    return res.status(200).json(cachedData);
  }
  const playlist = await Playlist.findById(playlistId)
    .populate({
      path: "owner",
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
  // calculate the channel subscribers
  playlist.owner.subscribers = await Subscription.countDocuments({
    channel: playlist.owner._id,
  });

  if (!playlist) {
    throw new ApiError(404, "Playlist not found");
  }
  // cache the response
  const response = new ApiResponse(200, playlist, "Playlist found");
  await setCache(req, response, cacheKey);
  return res.status(200).json(response);
});

// add a video to a playlist
const toggleVideoInPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;
  const { value } = req.body;
  if (!isValidObjectId(playlistId) || !isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid Playlist or Video Id");
  }
  // Check if video exists
  if (!(await Video.exists({ _id: videoId, isPublished: true }))) {
    throw new ApiError(404, "Video not found or not published");
  }
  // Check if video already exists in the playlist
  if ((await Playlist.exists({ videos: videoId, _id: playlistId })) && !value) {
    const playlist = await Playlist.findByIdAndUpdate(
      playlistId,
      {
        $pull: { videos: videoId },
      },
      {
        new: true,
      }
    );

    if (!playlist) {
      throw new ApiError(500, "Failed to remove video from playlist");
    }

    return res
      .status(200)
      .json(new ApiResponse(200, playlist, "Video removed from playlist"));
  }
  if (value) {
    const playlist = await Playlist.findByIdAndUpdate(
      playlistId,
      {
        $addToSet: { videos: videoId }, // Add videoId to videos array if not already present in the array (no duplicates)
      },
      {
        new: true,
      }
    );
    if (!playlist) {
      throw new ApiError(500, "Failed to add video to playlist");
    }

    return res
      .status(200)
      .json(new ApiResponse(200, playlist, "Video added to playlist"));
  }
});

// update a playlist
const updatePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  const { name, description } = req.body;
  if (!isValidObjectId(playlistId)) {
    throw new ApiError(400, "Invalid Playlist Id");
  }
  if (!name?.trim() && !description?.trim()) {
    throw new ApiError(400, "Name or Description are required");
  }
  const playlist = await Playlist.findByIdAndUpdate(
    playlistId,
    {
      name,
      description,
    },
    {
      new: true,
    }
  );
  if (!playlist) {
    throw new ApiError(404, "Playlist not found");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, playlist, "Playlist updated"));
});

// delete a playlist
const deletePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  if (!isValidObjectId(playlistId)) {
    throw new ApiError(400, "Invalid Playlist Id");
  }
  const playlist = await Playlist.findByIdAndDelete(playlistId);
  if (!playlist) {
    throw new ApiError(404, "Playlist not found");
  }
  return res.status(200).json(new ApiResponse(200, [], "Playlist deleted"));
});

export {
  createPlaylist,
  deletePlaylist,
  getPlaylistById,
  getUserCollections,
  getUserPlaylists,
  toggleVideoInPlaylist,
  updatePlaylist,
};
