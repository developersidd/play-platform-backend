import { isValidObjectId } from "mongoose";
import { addToWatchHistory } from "../helpers/video.helper.js";
import Like from "../models/like.model.js";
import NotificationModel from "../models/notification.model.js";
import Subscription from "../models/subscription.model.js";
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
  
  const {
    page = 1,
    limit = 10,
    sortBy = "createdAt",
    sortOrder = "desc",
    q = "",
    username,
    expandQuery = false,
    status = "published",
  } = req.query;

  const searchQuery = {};
  // Filter by publish status
  if (status === "published") searchQuery.isPublished = true;
  else if (status === "unpublished") searchQuery.isPublished = false;
  else if (status === "all") delete searchQuery.isPublished;
  // Search query
  const decodedQ = decodeURIComponent(q);
  console.log(" decodedQ:", decodedQ);
  if (decodedQ && decodedQ.trim() !== "") {
    searchQuery.$or = [
      { title: { $regex: decodedQ, $options: "i" } },
      { description: { $regex: decodedQ, $options: "i" } },
      {
        tags: {
          $in: decodedQ
            .split(" ")
            .map((val) => val.toLowerCase())
            .filter(Boolean),
        },
      },
    ];
  }

  // Sorting
  const sortQuery = {
    [decodeURIComponent(sortBy)]: sortOrder === "desc" ? -1 : 1,
  };
  if (username && username !== "guest") {
    const userId = await User.findOne({ username }).select("_id");
    if (!userId) {
      throw new ApiError(404, "User not found");
    }
    searchQuery.owner = createMongoId(userId?._id);
  }

  // Check cache
  const cacheKey = generateCacheKey("all-videos", req.query);
  const cachedRes = await checkCache(req, cacheKey);
  // if (cachedRes) {
  //  return res.status(200).json(cachedRes);
  // }

  console.log(" searchQuery:", searchQuery);
  // if expandQuery is true, then we will add likes and dislikes count to the query
  let expandQueryAggregation = [];
  if (expandQuery) {
    expandQueryAggregation = [
      {
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
          likes: {
            $size: "$likes",
          },
          dislikes: {
            $size: "$dislikes",
          },
        },
      },
    ];
  }

  // Create the aggregation pipeline
  const aggregateQuery = Video.aggregate([
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
    ...expandQueryAggregation,
    {
      $set: {
        owner: {
          $first: "$owner",
        },
      },
    },
    {
      $sort: sortQuery,
    },
  ]);

  // Use aggregatePaginate for pagination
  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
  };
  // Use aggregatePaginate with the aggregation object (not array of stages)
  const result = await Video.aggregatePaginate(aggregateQuery, options);
  // console.log(" result:", result);
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
  console.log(" title, description:", title, description);
  const thumbnailLocalPath = req?.file?.path;
  console.log(" thumbnailLocalPath:", thumbnailLocalPath);
  if (
    [title, description, thumbnailLocalPath].every(
      (value) => value?.trim() === ""
    )
  ) {
    throw new ApiError(400, "Please provide All required fields");
  }
  let thumbnail = null;
  if (thumbnailLocalPath) {
    thumbnail = await uploadOnCloudinary(thumbnailLocalPath);
    if (!thumbnail?.public_id) {
      throw new ApiError(500, "Failed to update thumbnail");
    }
  }
  const video = await Video.findByIdAndUpdate(
    req.params.id,
    {
      $set: {
        title,
        description,
        ...(thumbnailLocalPath && {
          thumbnail: {
            url: thumbnail.secure_url,
            public_id: thumbnail.public_id,
          },
        }),
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
  const { _id, avatar, username } = req.user || {};
  const { title, description, tags } = req.body;
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
  if (!video) {
    throw new ApiError(500, "Failed to publish video");
  }
  res
    .status(201)
    .json(new ApiResponse(201, video, "Video published successfully"));
  // send notification to the subscribers
  const io = req.app.get("io");

  // get all subscribers of the channel
  const mongoChannelId = createMongoId(_id);
  const subscribers = await Subscription.find({
    channel: mongoChannelId,
  }).ne("subscriber", _id);

  // Create notification objects for all subscribers first
  const notificationObjects = subscribers.map(({ subscriber }) => ({
    sender: { _id, username, avatar },
    recipient: subscriber,
    type: "USER",
    message: `uploaded a new video: ${title}`,
    link: `/videos/${video?._id}`,
    image: thumbnail?.secure_url,
  }));

  // create notifications for all subscribers
  await NotificationModel.bulkWrite(
    notificationObjects.map((obj) => ({
      insertOne: { document: obj },
    }))
  );

  // Emit notifications to all subscribers
  notificationObjects.forEach((notification) => {
    // by default 'to' uses broadcast to emit to all connected clients except the sender
    io.to(`user-${notification.recipient}`).emit(
      "new-notification",
      notification
    );
  });
  // revalidate all video cache
  await revalidateRelatedCaches(req, "all-videos");
});

// Delete video
const deleteVideo = asyncHandler(async (req, res) => {
  // check if video exists
  const video = await Video.findById(req.params.id);
  if (!video) {
    throw new ApiError(404, "Video not found");
  }
  // check the owner of the video
  if (video.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(403, "You are not authorized to delete this video");
  }
  const deletedVideo = await Video.findByIdAndDelete(req.params.id);
  console.log(" deletedVideo:", deletedVideo);
  if (!deletedVideo) {
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

// get related videos
const getRelatedVideos = asyncHandler(async (req, res) => {
  const videoId = req.params.id;
  const {
    page = 1,
    limit = 10,
    sortBy = "createdAt",
    sortType = "desc",
  } = req.query;
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video Id");
  }
  // sort query
  const sortQuery = {};
  if (sortBy) {
    sortQuery[sortBy] = sortType === "desc" ? -1 : 1;
  } else {
    sortQuery.createdAt = -1;
  }

  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "Video not found");
  }
  const cacheKey = generateCacheKey("related-videos", videoId, req.query);
  // await revalidateCache(req, cacheKey);
  // Check cache
  const cachedRes = await checkCache(req, cacheKey);
  if (cachedRes) {
    return res.status(200).json(cachedRes);
  }

  // add aggregation pagination like getAllVideos
  const aggregateQuery = Video.aggregate([
    {
      $match: {
        _id: { $ne: createMongoId(videoId) },
        $or: [
          { tags: { $in: video.tags } },
          { title: { $regex: video.title, $options: "i" } },
        ],
      },
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

  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
  };
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
    "Related Videos found"
  );

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
