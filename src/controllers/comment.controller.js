import { isValidObjectId } from "mongoose";
import Comment from "../models/comment.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { createMongoId } from "../utils/mongodb.util.js";
import {
  checkCache,
  generateCacheKey,
  revalidateCache,
  setCache,
} from "../utils/redis.util.js";

// Get comments for a video
const getVideoComments = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const {
    page = 1,
    limit = 10,
    sortBy = "createdAt",
    sortType = "desc",
  } = req.query;
  const cacheKey = generateCacheKey("video-comments", videoId, req.query);
  await revalidateCache(req, cacheKey);
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video id");
  }

  const cachedData = await checkCache(req, cacheKey);
  // if (cachedData) {
  //  return res.status(200).json(cachedData);
  // }
  //
  // search & sort query
  const searchQuery = { video: createMongoId(videoId) };
  // sort query
  const sortQuery = {};
  if (sortBy) {
    sortQuery[sortBy] = sortType === "desc" ? -1 : 1;
  } else {
    sortQuery.createdAt = -1;
  }

  const aggregateQuery = Comment.aggregate([
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
              fullName: 1,
              username: 1,
              email: 1,
              avatar: 1,
            },
          },
        ],
      },
    },
    {
      $set: {
        owner: { $first: "$owner" },
      },
    },
  ]);
  // Use aggregatePaginate for pagination
  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
  };
  console.log(" options.page:", options.page);

  const result = await Comment.aggregatePaginate(aggregateQuery, options);
  const response = new ApiResponse(
    200,
    {
      comments: result.docs,
      totalComments: result.totalDocs,
      totalPages: result.totalPages,
      currentPage: result.page,
      hasNextPage: result.hasNextPage,
      hasPrevPage: result.hasPrevPage,
    },
    "Comments found"
  );
  // cache the response
  await setCache(req, response, cacheKey);
  return res.status(200).json(response);
});

const addComment = asyncHandler(async (req, res) => {
  // TODO: add a comment to a video
  const { videoId } = req.params;
  const { content } = req.body;
  const { redisClient } = req.app.locals || {};
  // throw new ApiError(501, "Not implemented");
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video id");
  }
  if (content?.trim() === "") {
    throw new ApiError(400, "Content is required");
  }

  const comment = await Comment.create({
    content,
    owner: req.user._id,
    video: videoId,
  });
  await redisClient.del("video-comments");
  return res.status(201).json(new ApiResponse(201, comment, "Comment added"));
});

const updateComment = asyncHandler(async (req, res) => {
  // TODO: update a comment
  const { commentId } = req.params;
  // throw new ApiError(501, "Not implemented");
  const { redisClient } = req.app.locals || {};
  const { content } = req.body;
  if (!isValidObjectId(commentId)) {
    throw new ApiError(400, "Invalid comment id");
  }
  if (content?.trim() === "") {
    throw new ApiError(400, "Content is required");
  }

  const comment = await Comment.findByIdAndUpdate(
    commentId,
    { $set: { content } },
    { new: true }
  );
  if (!comment) {
    throw new ApiError(404, "Comment not found");
  }
  await redisClient.del("video-comments");
  return res.status(200).json(new ApiResponse(200, comment, "Comment updated"));
});

const deleteComment = asyncHandler(async (req, res) => {
  // TODO: delete a comment
  // throw new ApiError(501, "Not implemented");
  const { commentId } = req.params;
  const { redisClient } = req.app.locals || {};
  if (!isValidObjectId(commentId)) {
    throw new ApiError(400, "Invalid comment id");
  }
  const comment = await Comment.findByIdAndDelete(commentId);
  if (!comment) {
    throw new ApiError(404, "Comment not found");
  }
  await redisClient.del("video-comments");
  return res.status(200).json(new ApiResponse(200, {}, "Comment deleted"));
});

export { addComment, deleteComment, getVideoComments, updateComment };
