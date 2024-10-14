import { isValidObjectId } from "mongoose";
import Tweet from "../models/tweet.model.js";
import User from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { createMongoId } from "../utils/mongodb.util.js";
import {
  checkCache,
  generateCacheKey,
  revalidateCache,
} from "../utils/redis.util.js";

const createTweet = asyncHandler(async (req, res) => {
  const { content } = req.body;
  const owner = req.user?._id;
  console.log("content:", content);
  if (!content?.trim()) {
    throw new ApiError(400, "Content is required");
  }

  const tweet = await Tweet.create({
    content,
    owner,
  });
  const cacheKey = generateCacheKey("user-tweets", owner);
  await revalidateCache(req, cacheKey);
  return res.status(201).json(new ApiResponse(201, tweet, "Tweet created"));
});

const getUserTweets = asyncHandler(async (req, res) => {
  // TODO: get user tweets
  const { username } = req.params;
  const { loggedInUserId } = req.query;
  console.log("username:", username);
  if (!username) {
    throw new ApiError(400, "Invalid User Id");
  }
  const user = await User.findOne({ username }).select("_id");
  if (!user) {
    throw new ApiError(404, "User not found");
  }
  const mongoLoggedInUserId = createMongoId(loggedInUserId);
  console.log("loggedInUserId:", loggedInUserId);
  // check if the user tweets are cached
  const cacheKey = generateCacheKey("user-tweets", user._id);
  const cachedTweets = await checkCache(req, cacheKey);
  await revalidateCache(req, cacheKey);
  /* if (cachedTweets) {
    return res.status(200).json(cachedTweets);
  } */

  const mongoUserId = createMongoId(user?._id);
  const tweets = await Tweet.aggregate([
    { $match: { owner: mongoUserId } },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
        pipeline: [
          {
            $project: {
              avatar: 1,
              fullName: 1,
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "tweet",
        as: "likes",
      },
    },
    {
      $lookup: {
        from: "dislikes",
        localField: "_id",
        foreignField: "tweet",
        as: "dislikes",
      },
    },
    {
      $addFields: {
        isLiked: {
          $in: [mongoLoggedInUserId, "$likes.likedBy"],
        },
        isDisliked: {
          $in: [mongoLoggedInUserId, "$dislikes.dislikedBy"],
        },
        likes: { $size: "$likes" },
        dislikes: { $size: "$dislikes" },
        owner: { $arrayElemAt: ["$owner", 0] },
      },
    },
    { $unset: ["__v"] },
    { $sort: { createdAt: -1 } },
  ]);

  // cache the response
  const response = new ApiResponse(200, tweets, "User tweets found");
  // await setCache(req, response, cacheKey);
  return res.status(200).json(response);
});

const updateTweet = asyncHandler(async (req, res) => {
  // TODO: update tweet
  const { tweetId } = req.params;
  const { content } = req.body || {};
  const owner = req.user?._id;

  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, "Invalid Tweet Id");
  }
  if (!content?.trim()) {
    throw new ApiError(400, "Content is required");
  }

  const tweet = await Tweet.findByIdAndUpdate(
    tweetId,
    { $set: { content } },
    {
      new: true,
    }
  );
  if (!tweet) {
    throw new ApiError(404, "Tweet not found");
  }
  // revalidate the cache
  const cacheKey = generateCacheKey("user-tweets", owner);
  await revalidateCache(req, cacheKey);
  return res.status(200).json(new ApiResponse(200, tweet, "Tweet updated"));
});

const deleteTweet = asyncHandler(async (req, res) => {
  // TODO: delete tweet
  const { tweetId } = req.params;
  const owner = req.user?._id;

  if (!isValidObjectId(tweetId)) {
    throw new ApiError(400, "Invalid Tweet Id");
  }
  const tweet = await Tweet.findByIdAndDelete(tweetId);
  if (!tweet) {
    throw new ApiError(404, "Tweet not found");
  }
  // revalidate the cache
  const cacheKey = generateCacheKey("user-tweets", owner);
  await revalidateCache(req, cacheKey);
  return res.status(200).json(new ApiResponse(200, {}, "Tweet deleted"));
});

export { createTweet, deleteTweet, getUserTweets, updateTweet };
