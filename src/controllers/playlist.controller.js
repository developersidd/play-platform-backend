import { isValidObjectId } from "mongoose";
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
  console.log("🚀 ~ req.body:", req.body);
  if (!name?.trim()) {
    throw new ApiError(400, "Name is required");
  }
  if (type === "videPlaylist" && !videos.length) {
    throw new ApiError(400, "Videos are required for playlist");
  }

  // Check if the user already has a playlist with the same name
  const existingPlaylist = await Playlist.findOne({
    name,
    owner: req.user._id,
    type,
  });

  if (existingPlaylist) {
    throw new ApiError(400, "Playlist with this name already exists");
  }

  // create the videos array
  const videosArray = videos.map((videoId, ind) => ({
    video: videoId,
    position: ind,
    addedAt: new Date(),
  }));

  const playlist = await Playlist.create({
    name,
    description,
    type,
    videos: videosArray,
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
  const {
    sortBy = "createdAt",
    sortOrder = "desc",
    q = "",
    status = "public",
  } = req.query || {};

  if (!username) {
    throw new ApiError(400, "Invalid User Name");
  }
  const user = await User.findOne({ username }).select("_id");
  if (!user) {
    throw new ApiError(404, "User not found");
  }
  // search query
  const searchQuery = {
    owner: createMongoId(user?._id),
    type: "playlist",
  };
  // Filter by publish status
  if (status === "public") searchQuery.isPrivate = false;
  else if (status === "private") searchQuery.isPrivate = true;
  else if (status === "all") delete searchQuery.isPrivate;
  // Search query
  const decodedQ = decodeURIComponent(q);
  if (decodedQ && decodedQ.trim() !== "") {
    searchQuery.$or = [
      { name: { $regex: decodedQ, $options: "i" } },
      { description: { $regex: decodedQ, $options: "i" } },
      // also add _id search
      {
        _id: isValidObjectId(decodedQ) ? createMongoId(decodedQ) : null,
      },
    ];
  }

  // Sorting
  const sortQuery = {
    [decodeURIComponent(sortBy)]: sortOrder === "desc" ? -1 : 1,
  };

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
      $match: searchQuery,
    },
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
    // Get the first video ID
    {
      $addFields: {
        firstVideoId: { $arrayElemAt: ["$videos.video", 0] },
      },
    },

    // Lookup only that first video
    {
      $lookup: {
        from: "videos",
        localField: "firstVideoId",
        foreignField: "_id",
        as: "firstVideo",
        pipeline: [
          {
            $project: {
              thumbnail: 1,
              title: 1,
              views: 1,
              duration: 1,
              createdAt: 1,
            },
          },
        ],
      },
    },

    // Replace the first item in videos array with the populated version
    {
      $addFields: {
        videos: {
          $concatArrays: [
            "$firstVideo", // populated
            { $slice: ["$videos", 1, { $size: "$videos" }] }, // rest of raw ones
          ],
        },
        owner: { $arrayElemAt: ["$owner", 0] },
      },
    },

    // Clean up
    {
      $project: {
        firstVideoId: 0,
        firstVideo: 0,
      },
    },
    {
      $sort: sortQuery,
    },
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
  // cache key
  const cacheKey = generateCacheKey("user-collection", userId, req.query);
  // check cache
  await revalidateCache(req, cacheKey);
  const cachedData = await checkCache(req, cacheKey);
  if (cachedData) {
    return res.status(200).json(cachedData);
  }

  let result;
  if (!expand) {
    result = await Playlist.find({
      owner: userId,
      type: "collection",
      isPrivate,
    }).select("-description");
  } else {
    // if expand is true, populate the videos
    result = await Playlist.aggregate([
      // Match the specific playlist
      {
        $match: { owner: createMongoId(userId), isPrivate, type: "collection" },
      },

      // Sort the playlist videos array by position
      {
        $addFields: {
          videos: {
            $sortArray: {
              input: "$videos",
              sortBy: { position: 1 },
            },
          },
        },
      },

      // Get the first video ID
      {
        $addFields: {
          firstVideoId: { $arrayElemAt: ["$videos.video", 0] },
        },
      },

      // Lookup only that first video
      {
        $lookup: {
          from: "videos",
          localField: "firstVideoId",
          foreignField: "_id",
          as: "firstVideo",
          pipeline: [
            {
              $project: {
                thumbnail: 1,
                title: 1,
                views: 1,
                duration: 1,
                createdAt: 1,
              },
            },
          ],
        },
      },

      // Replace the first item in videos array with the populated version
      {
        $addFields: {
          videos: {
            $concatArrays: [
              "$firstVideo", // populated
              { $slice: ["$videos", 1, { $size: "$videos" }] }, // rest of raw ones
            ],
          },
        },
      },

      // Clean up
      {
        $project: {
          firstVideoId: 0,
          firstVideo: 0,
        },
      },
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
      path: "videos.video",
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
  const playlist = await Playlist.findById(playlistId);
  if (!value) {
    console.log("removing video from playlist");
    const updatedPlaylist = await Playlist.findByIdAndUpdate(
      playlistId,
      {
        $pull: { videos: { video: videoId } },
      },
      {
        new: true,
      }
    );

    if (!updatedPlaylist) {
      throw new ApiError(500, "Failed to remove video from playlist");
    }
    // revalidate the user playlist and collection caches
    await revalidateRelatedCaches(req, "user-playlist", req.user._id);
    await revalidateRelatedCaches(req, "user-collection", req.user._id);
    return res
      .status(200)
      .json(new ApiResponse(200, playlist, "Video removed from playlist"));
  }
  if (value) {
    console.log("adding video to playlist");
    const updatedPlaylist = await Playlist.findByIdAndUpdate(
      playlistId,
      {
        $addToSet: {
          videos: { video: videoId, position: playlist?.videos?.length ?? 0 },
        },
      },
      {
        upsert: true, // in case the video is not already in the playlist
      },
      
    );
    if (!updatedPlaylist) {
      throw new ApiError(500, "Failed to add video to playlist");
    }
    // revalidate the user playlist and collection caches
    await revalidateRelatedCaches(req, "user-playlist", req.user._id);
    await revalidateRelatedCaches(req, "user-collection", req.user._id);
    return res
      .status(200)
      .json(new ApiResponse(200, updatedPlaylist, "Video added to playlist"));
  }
});

// update a playlist
const updatePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  const { name, description, isPrivate, videos } = req.body;
  console.log("🚀 ~ req.body in update platylist:", req.body);
  const cacheKey = generateCacheKey("playlist", playlistId);

  if (!isValidObjectId(playlistId)) {
    throw new ApiError(400, "Invalid Playlist Id");
  }
  const playlist = await Playlist.findByIdAndUpdate(
    playlistId,
    {
      name,
      description,
      isPrivate,
      videos,
    },
    {
      new: true,
    }
  );
  if (!playlist) {
    throw new ApiError(404, "Playlist not found");
  }

  await revalidateCache(req, cacheKey);
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

// Delete many Playlists
const deleteManyPlaylist = asyncHandler(async (req, res) => {
  const { playlistIds } = req.body;
  if (!Array.isArray(playlistIds) || playlistIds.length === 0) {
    throw new ApiError(400, "Please provide playlist ids to delete");
  }
  console.log(" playlistIds:", playlistIds);

  // check if all playlist ids are valid
  const validIds = playlistIds.filter((id) => isValidObjectId(id));
  if (validIds.length !== playlistIds.length) {
    throw new ApiError(400, "Invalid playlist ids provided");
  }

  // delete playlists
  const result = await Playlist.deleteMany({ _id: { $in: playlistIds } });
  if (result.deletedCount === 0) {
    throw new ApiError(500, "Failed to delete playlists");
  }
  await revalidateRelatedCaches(req, "user-playlist", req.user._id);
  // revalidate all playlists cache
  return res.status(200).json(new ApiResponse(200, {}, "Playlists deleted"));
});

export {
  createPlaylist,
  deleteManyPlaylist,
  deletePlaylist,
  getPlaylistById,
  getUserCollections,
  getUserPlaylists,
  toggleVideoInPlaylist,
  updatePlaylist,
};
