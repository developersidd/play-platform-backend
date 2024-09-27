import { isValidObjectId } from "mongoose";
import Subscription from "../models/subscription.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { createMongoId } from "../utils/mongodb.util.js";

const toggleSubscription = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  const { redisClient } = req.app.locals || {};
  if (!isValidObjectId(channelId)) {
    throw new ApiError(400, "Invalid channel id");
  }
  redisClient.del(
    [
      "subscribers-list",
      "subscribers-list?expand=true",
      "check-subscription-status",
    ],
    (err, reply) => {
      if (err) {
        console.log("err:", err);
      }
      console.log("deleted keys:", reply);
    }
  );
  const isSubscribed = await Subscription.exists({
    subscriber: req.user._id,
    channel: channelId,
  });
  // if user is already subscribed, then unsubscribe
  if (isSubscribed) {
    await Subscription.deleteOne({
      subscriber: req.user._id,
      channel: channelId,
    });
    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Unsubscribed successfully"));
  }

  //  if user is not subscribed, then subscribe
  const subscription = await Subscription.create({
    subscriber: req.user._id,
    channel: channelId,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, subscription, "Subscribed successfully"));
});

// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  const { redisClient } = req.app.locals || {};
  const { page, limit, expand = false } = req.query || {};
  // delete the cache if expand is true

  if (!isValidObjectId(channelId)) {
    throw new ApiError(400, "Invalid channel id");
  }

  if (!expand) {
    // check if the response is cached
    const cachedResponse = await redisClient.get("subscribers-list");
    if (cachedResponse) {
      console.log("cachedResponse not expand");
      return res.status(200).json(JSON.parse(cachedResponse));
    }
    const subscribers = await Subscription.countDocuments({
      channel: channelId,
    });

    const response = new ApiResponse(200, { subscribers }, "Subscribers count");
    redisClient.setEx("subscribers-list", 3600, JSON.stringify(response));
    return res.status(200).json(response);
  }
  const cachedResponse = await redisClient.get("subscribers-list?expand=true");
  if (cachedResponse) {
    console.log("cachedResponse expand");
    return res.status(200).json(JSON.parse(cachedResponse));
  }
  // paginate subscribers list query
  const mongoChannelId = createMongoId(channelId);
  const channelSubscribersQuery = Subscription.aggregate([
    {
      $match: { channel: mongoChannelId },
    },
    {
      $lookup: {
        from: "users",
        localField: "subscriber",
        foreignField: "_id",
        as: "subscriber",
      },
    },
    {
      $addFields: {
        subscriber: { $first: "$subscriber" },
      },
    },
    {
      $project: {
        "subscriber.username": 1,
        "subscriber.email": 1,
        "subscriber.avatar": 1,
        channel: 1,
      },
    },
  ]);

  const options = {
    page: parseInt(page, 10) || 1,
    limit: parseInt(limit, 10) || 10,
  };

  const result = await Subscription.aggregatePaginate(
    channelSubscribersQuery,
    options
  );

  // cache the response
  const response = new ApiResponse(
    200,
    {
      subscribers: result.docs,
      totalSubscribers: result.totalDocs,
      totalPages: result.totalPages,
      currentPage: result.page,
      hasNextPage: result.hasNextPage,
      hasPrevPage: result.hasPrevPage,
    },
    "Subscribers list"
  );
  req.app.locals.redisKey = "subscribers-list?expand=true";

  redisClient.setEx(
    "subscribers-list?expand=true",
    3600,
    JSON.stringify(response)
  );
  return res.status(200).json(response);
});

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
  const { subscriberId } = req.params;
  const { page, limit } = req.query || {};

  if (!isValidObjectId(subscriberId)) {
    throw new ApiError(400, "Invalid subscriber id");
  }

  // paginate subscribed channels list query
  const mongoSubscriberId = createMongoId(subscriberId);
  const subscribedChannelsQuery = Subscription.aggregate([
    {
      $match: { subscriber: mongoSubscriberId },
    },

    {
      $lookup: {
        from: "users",
        localField: "channel",
        foreignField: "_id",
        as: "channel",
      },
    },
    {
      $addFields: {
        channel: { $first: "$channel" },
      },
    },
    {
      $project: {
        "channel.username": 1,
        "channel.email": 1,
        "channel.avatar": 1,
        subscriber: 1,
      },
    },
  ]);

  const options = {
    page: parseInt(page, 10) || 1,
    limit: parseInt(limit, 10) || 10,
  };

  const result = await Subscription.aggregatePaginate(
    subscribedChannelsQuery,
    options
  );

  // cache the response
  const { redisClient } = req.app.locals || {};
  const response = new ApiResponse(
    200,
    {
      subscribedChannels: result.docs,
      totalSubscribedChannels: result.totalDocs,
      totalPages: result.totalPages,
      currentPage: result.page,
      hasNextPage: result.hasNextPage,
      hasPrevPage: result.hasPrevPage,
    },
    "Subscribed channels list"
  );
  redisClient.setEx(req.originalUrl, 3600, JSON.stringify(response));
  return res.status(200).json(response);
});

// check subscription status
const checkSubscriptionStatus = asyncHandler(async (req, res) => {
  const { channelId } = req.params;

  const { redisClient } = req.app.locals || {};
  const cachedData = await redisClient.get("check-subscription-status");

  if (cachedData) {
    console.log("from cache");
    return res.status(200).json(JSON.parse(cachedData));
  }
  if (!isValidObjectId(channelId)) {
    throw new ApiError(400, "Invalid channel id");
  }
  console.log("req.user?._id:", req.user?._id);
  const data = await Subscription.exists({
    subscriber: req.user?._id,
    channel: channelId,
  });
  const response = new ApiResponse(
    200,
    { isSubscribed: !!data?._id },
    "Subscription status"
  );
  await redisClient.setEx(
    "check-subscription-status",
    3600,
    JSON.stringify(response)
  );

  return res.status(200).json(response);
});

export {
  checkSubscriptionStatus,
  getSubscribedChannels,
  getUserChannelSubscribers,
  toggleSubscription,
};
