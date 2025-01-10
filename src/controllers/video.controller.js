import { isValidObjectId } from "mongoose";
import { addToWatchHistory } from "../helpers/video.helper.js";
import Like from "../models/like.model.js";
import User from "../models/user.model.js";
import Video from "../models/video.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import formatDuration from "../utils/formatDuration.js";
import { createMongoId } from "../utils/mongodb.util.js";
import {
  addViewIfNotExists,
  checkCache,
  generateCacheKey,
  revalidateCache,
  revalidateRelatedCaches,
  setCache,
} from "../utils/redis.util.js";
// Get all videos

const getAllVideos = asyncHandler(async (req, res) => {
  // Extract pagination parameters from query string
  const {
    page = 1,
    limit = 10,
    sortBy,
    sortType,
    username,
    q,
  } = req.query || {};
  // throw new ApiError(400, "Invalid query parameters");
  // search query
  const searchQuery = { isPublished: true };
  if (q) {
    searchQuery.$or = [
      { title: { $regex: q, $options: "i" } },
      { description: { $regex: q, $options: "i" } },
      { tags: { $in: q.split(" ").map((val) => val.toLowerCase()) } },
    ];
  }
  // console.log("searchQuery:", JSON.stringify(searchQuery, null, 2));
  if (username) {
    const userId = await User.findOne({ username }).select("_id");
    if (!userId) {
      throw new ApiError(404, "User not found");
    }
    searchQuery.owner = createMongoId(userId);
  }
  // sort query
  const sortQuery = {};
  if (sortBy) {
    sortQuery[sortBy] = sortType === "desc" ? -1 : 1;
  } else {
    sortQuery.createdAt = -1;
  }
  const cacheKey = generateCacheKey("all-videos", req.query);
  // Check cache
  // await revalidateRelatedCaches(req, "all-videos");
  const cachedRes = await checkCache(req, cacheKey);
  if (cachedRes) {
    return res.status(200).json(cachedRes);
  }

  // Create the aggregation pipeline
  const aggregateQuery = Video.aggregate([
    {
      $match: searchQuery,
    },
    {
      $sort: sortQuery,
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
              _id: 1,
              username: 1,
              fullName: 1,
              email: 1,
              avatar: 1,
              coverImage: 1,
            },
          },
        ],
      },
    },
    {
      $set: {
        owner: {
          $first: "$owner",
        },
      },
    },
  ]);

  // Use aggregatePaginate for pagination
  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
  };
  // Use aggregatePaginate with the aggregation object (not array of stages)
  const result = await Video.aggregatePaginate(aggregateQuery, options);
  // Create the response object
  const response = new ApiResponse(
    200,
    {
      videos: result.docs,
      totalVideos: result.totalDocs,
      totalPages: result.totalPages,
      currentPage: result.page,
      hasNextPage: result.hasNextPage,
      hasPrevPage: result.hasPrevPage,
    },
    "Videos found"
  );
  // Cache the response
  await setCache(req, response, cacheKey);
  return res.status(200).json(response);
});

// Get video by id
const getVideoById = asyncHandler(async (req, res) => {
  const videoId = req.params.id;
  console.log("videoId:", videoId);
  const userId = req?.query?.userId || "guest";
  const mongoLoggedInUserId = createMongoId(userId);
  // Generate cache key
  const cacheKey = generateCacheKey("video", videoId, userId);
  // await revalidateCache(req, cacheKey);
  // Check cache
  // Add video to watch history
  if (isValidObjectId(userId) && userId !== "guest") {
    await addToWatchHistory(mongoLoggedInUserId, videoId);
  }
  const cachedData = await checkCache(req, cacheKey);
  if (cachedData) {
    return res.status(200).json(cachedData);
  }

  const video = await Video.aggregate([
    {
      $match: {
        _id: createMongoId(videoId),
      },
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
              _id: 1,
              username: 1,
              fullName: 1,
              email: 1,
              avatar: 1,
              coverImage: 1,
            },
          },
        ],
      },
    },
    {
      // lookup likes and dislikes count also check if user liked or disliked
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "video",
        as: "likes",
      },
    },
    {
      $lookup: {
        from: "dislikes",
        localField: "_id",
        foreignField: "video",
        as: "dislikes",
      },
    },
    {
      $set: {
        isLiked: {
          $in: [mongoLoggedInUserId, "$likes.likedBy"],
        },
        isDisliked: {
          $in: [mongoLoggedInUserId, "$dislikes.dislikedBy"],
        },
        likes: {
          $size: "$likes",
        },
        dislikes: {
          $size: "$dislikes",
        },
        owner: {
          $first: "$owner",
        },
      },
    },
  ]);

  if (!video?.length) {
    throw new ApiError(404, "Video not found");
  }
  // Cache the response
  const response = new ApiResponse(200, (video || [])[0], "Video found");
  await setCache(req, response, cacheKey);
  return res.status(200).json(response);
});

// API endpoint for viewing a video
const updateVideoCount = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userIp = req.ip; // You could also use session/cookie if logged-in users
  console.log("userIp:", userIp);
  const video = await Video.findById(id);
  if (!video) {
    throw new ApiError(404, "Video not found");
  }
  const viewAdded = await addViewIfNotExists(req, id, userIp);
  console.log("viewAdded:", viewAdded);
  if (viewAdded) {
    return res.status(200).json(new ApiResponse(200, "View added", {}));
  }
  return res.status(200).json(409, "View already exists", {});
});

// Update video by id
const updateVideoById = asyncHandler(async (req, res) => {
  const { title, description } = req.body;
  const thumbnailLocalPath = req.file?.path;
  if (
    [title, description, thumbnailLocalPath].every(
      (value) => value?.trim() === ""
    )
  ) {
    throw new ApiError(400, "Please provide All required fields");
  }
  const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);
  if (!thumbnail?.public_id) {
    throw new ApiError(500, "Failed to update thumbnail");
  }
  const video = await Video.findByIdAndUpdate(
    req.params.id,
    {
      $set: {
        title,
        description,
        thumbnail: {
          url: thumbnail.secure_url,
          public_id: thumbnail.public_id,
        },
      },
    },
    {
      new: true,
    }
  );
  if (!video) {
    throw new ApiError(500, "Failed to update video");
  }
  // delete the video cache
  const cacheKey = generateCacheKey("video", req.params.id);
  await revalidateCache(req, cacheKey);
  // revalidate all videos cache
  await revalidateRelatedCaches(req, "all-videos");
  return res.status(200).json(new ApiResponse(200, video, "Video updated"));
});

// Update all video
const updateAllVideo = asyncHandler(async (req, res) => {
  const { title, description, tags } = req.body;
  if (
    [title, description].every((value) => value?.trim() === "") ||
    tags.length === 0
  ) {
    throw new ApiError(400, "Please provide All required fields");
  }

  const result = await Video.updateMany(
    {},
    {
      $set: {
        title,
        description,
        tags,
      },
    }
  );
  if (result?.modifiedCount === 0) {
    throw new ApiError(500, "Failed to update videos");
  }
  // revalidate all videos cache
  await revalidateRelatedCaches(req, "all-videos");
  return res.status(200).json(new ApiResponse(200, "All Videos Updated"));
});

//  Publish video
const publishVideo = asyncHandler(async (req, res) => {
  const { title, description, tags } = req.body;
  console.log("req.body:", req.body);
  console.log(".file:", req.file);
  console.log(".files:", req.files);
  const videoLocalPath = (req.files?.videoFile ?? [])[0]?.path;
  const thumbnailLocalPath = (req.files?.thumbnail ?? [])[0]?.path;
  if (!videoLocalPath || !thumbnailLocalPath) {
    throw new ApiError(400, "Thumbnail and Video Files are required");
  }

  if ([title, description].some((value) => value?.trim() === "")) {
    throw new ApiError(400, "Please provide All required fields");
  }
  //  upload video and thumbnail on cloudinary
  const videoFile = await uploadOnCloudinary(videoLocalPath);
  const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

  if (!videoFile?.public_id) {
    throw new ApiError(500, "Failed to upload video file");
  }
  if (!thumbnail?.public_id) {
    throw new ApiError(500, "Failed to upload thumbnail file");
  }

  const duration = formatDuration(videoFile.duration);
  const video = await Video.create({
    title,
    description,
    video: {
      url: videoFile.secure_url,
      public_id: videoFile.public_id,
    },
    thumbnail: {
      url: thumbnail.secure_url,
      public_id: thumbnail.public_id,
    },
    tags,
    duration,
    owner: req.user._id,
  });
  // revalidate all video cache
  await revalidateRelatedCaches(req, "all-videos");
  return res
    .status(201)
    .json(new ApiResponse(201, video, "Video published successfully"));
});

// Delete video
const deleteVideo = asyncHandler(async (req, res) => {
  const video = await Video.findByIdAndDelete(req.params.id);
  if (!video) {
    throw new ApiError(500, "Failed to delete video");
  }
  // revalidate video cache
  const cacheKey = generateCacheKey("video", req.params.id);
  await revalidateCache(req, cacheKey);
  // revalidate all videos cache
  await revalidateRelatedCaches(req, "all-videos");
  return res.status(200).json(new ApiResponse(200, {}, "Video deleted"));
});

// update video publish status
const updateVideoPublishStatus = asyncHandler(async (req, res) => {
  const videoId = req.params.id;

  const video = await Video.findByIdAndUpdate(
    videoId,
    {
      $set: {
        isPublished: req.body.isPublished,
      },
    },
    {
      new: true,
    }
  );
  if (!video) {
    throw new ApiError(500, "Failed to update video publish status");
  }
  // Generate cache key
  const cacheKey = generateCacheKey("video", videoId);
  await revalidateCache(req, cacheKey);
  // revalidate all videos cache
  await revalidateRelatedCaches(req, "all-videos");
  return res
    .status(200)
    .json(new ApiResponse(200, video, "Video publish status updated"));
});

const getRelatedVideos = asyncHandler(async (req, res) => {
  const videoId = req.params.id;
  console.log("videoId:", videoId);
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video Id");
  }
  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "Video not found");
  }
  const cacheKey = generateCacheKey("related-videos", videoId);
  await revalidateCache(req, cacheKey);
  // Check cache
  const cachedRes = await checkCache(req, cacheKey);
  if (cachedRes) {
    return res.status(200).json(cachedRes);
  }
  const relatedVideos = await Video.find({
    _id: { $ne: videoId },
    tags: { $in: video.tags },
  }).populate({
    path: "owner",
    model: "User",
    select: "_id username fullName email avatar",
  });
  // Cache the response
  const response = new ApiResponse(200, relatedVideos, "Related videos found");
  // await setCache(req, response, cacheKey);
  return res.status(200).json(response);
});

const getLikedVideos = asyncHandler(async (req, res) => {
  // TODO: get all liked videos
  const videos = await Like.aggregate([
    {
      $match: {
        likedBy: req.user?._id,
        video: { $exists: true },
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "video",
        foreignField: "_id",
        as: "video",
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
                    _id: 1,
                    username: 1,
                    fullName: 1,
                    email: 1,
                    avatar: 1,
                    coverImage: 1,
                  },
                },
              ],
            },
          },
          {
            $set: {
              owner: {
                $first: "$owner",
              },
            },
          },
        ],
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
  await setCache(
    req,
    response,
    generateCacheKey("liked-videos", req.user?._id)
  );
  return res.status(200).json(response);
});

export {
  deleteVideo,
  getAllVideos,
  getLikedVideos,
  getRelatedVideos,
  getVideoById,
  publishVideo,
  updateAllVideo,
  updateVideoById,
  updateVideoCount,
  updateVideoPublishStatus,
};
