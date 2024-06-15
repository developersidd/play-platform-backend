import { isValidObjectId } from "mongoose";
import Comment from "../models/comment.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

const getVideoComments = asyncHandler(async (req, res) => {
  // TODO: get all comments for a video
  const { videoId } = req.params;
  const { page = 1, limit = 10 } = req.query;
  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video id");
  }
  const searchQuery = { video: videoId };
  const sortQuery = { createdAt: -1 };
  const aggregateQuery = Comment.aggregate([
    {
      $match: searchQuery,
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

  const result = await Comment.aggregatePaginate(aggregateQuery, options);
  console.log("result:", JSON.stringify(result, null, 2));
  return res.status(200).json(
    new ApiResponse(
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
    )
  );
});

const addComment = asyncHandler(async (req, res) => {
  // TODO: add a comment to a video
  const { videoId } = req.params;
  const { content } = req.body;
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
  return res.status(201).json(new ApiResponse(201, comment, "Comment added"));
});

const updateComment = asyncHandler(async (req, res) => {
  // TODO: update a comment
  const { commentId } = req.params;
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
  return res.status(200).json(new ApiResponse(200, comment, "Comment updated"));
});

const deleteComment = asyncHandler(async (req, res) => {
  // TODO: delete a comment
  const { commentId } = req.params;
  if (!isValidObjectId(commentId)) {
    throw new ApiError(400, "Invalid comment id");
  }
  const comment = await Comment.findByIdAndDelete(commentId);
  if (!comment) {
    throw new ApiError(404, "Comment not found");
  }
  return res.status(200).json(new ApiResponse(200, null, "Comment deleted"));
});

export { addComment, deleteComment, getVideoComments, updateComment };
