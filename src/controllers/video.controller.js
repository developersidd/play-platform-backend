import { Types, isValidObjectId } from "mongoose";
import Video from "../models/video.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import formatDuration from "../utils/formatDuration.js";

// Get all videos

const getAllVideos = asyncHandler(async (req, res) => {
  // Extract pagination parameters from query string
  const {
    page = 1,
    limit = 10,
    sortBy = "createdAt",
    sortType = "desc",
    userId,
  } = req.query || {};

  // search query
  const searchQuery = { isPublished: true };
  if (userId) {
    if (!isValidObjectId(userId)) {
      throw new ApiError(400, "Invalid User Id");
    }
    const mongoId = new Types.ObjectId(userId);
    searchQuery.owner = mongoId;
  }
  // sort query
  const sortQuery = {};
  if (sortBy) {
    sortQuery[sortBy] = sortType === "desc" ? -1 : 1;
  } else {
    sortQuery.createdAt = -1;
  }

  // Create the aggregation pipeline
  const aggregateQuery = await Video.aggregate([
    {
      $match: searchQuery,
    },
    {
      $sort: sortQuery,
    },
    /* {
      $project: {
        // Project only necessary fields
        title: 1,
        description: 1,
        thumbnail: 1,
        views: 1,
        duration: 1,
        createdAt: 1,
      },
    }, */
  ]);

  // Use aggregatePaginate for pagination
  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
  };
  // aggregation result
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
  const { redisClient } = req.app.locals || {};
  redisClient.setEx(req.originalUrl, 3600, JSON.stringify(response));
  return res.status(200).json(response);
});

// Get video by id
const getVideoById = asyncHandler(async (req, res) => {
  const video = await Video.findById(req.params.id);
  if (!video) {
    throw new ApiError(404, "Video not found");
  }
  // Cache the response
  const { redisClient } = req.app.locals || {};
  const response = new ApiResponse(200, video, "Video found");
  redisClient.setEx(req.originalUrl, 3600, JSON.stringify(response));
  return res.status(200).json(response);
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
  return res.status(200).json(new ApiResponse(200, video, "Video updated"));
});

//  Publish video
const publishVideo = asyncHandler(async (req, res) => {
  const { title, description } = req.body;
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
    duration,
    owner: req.user._id,
  });
  console.log("video:", video);
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
  return res.status(200).json(new ApiResponse(200, {}, "Video deleted"));
});

// update video publish status
const updateVideoPublishStatus = asyncHandler(async (req, res) => {
  const video = await Video.findByIdAndUpdate(
    req.params.id,
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
  return res
    .status(200)
    .json(new ApiResponse(200, video, "Video publish status updated"));
});

export {
  deleteVideo,
  getAllVideos,
  getVideoById,
  publishVideo,
  updateVideoById,
  updateVideoPublishStatus,
};
