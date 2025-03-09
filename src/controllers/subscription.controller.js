import { isValidObjectId } from "mongoose";
import Subscription from "../models/subscription.model.js";
import User from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { createMongoId } from "../utils/mongodb.util.js";
import { checkCache, generateCacheKey, setCache } from "../utils/redis.util.js";

const toggleSubscription = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  const subscriber = req.user?._id;
  if (!isValidObjectId(channelId)) {
    throw new ApiError(400, "Invalid channel id");
  }

  const isSubscribed = await Subscription.exists({
    subscriber,
    channel: channelId,
  });
  // if user is already subscribed, then unsubscribe
  if (isSubscribed) {
    await Subscription.deleteOne({
      subscriber,
      channel: channelId,
    });
    return res
      .status(200)
      .json(new ApiResponse(200, {}, "Unsubscribed successfully"));
  }

  //  if user is not subscribed, then subscribe
  const subscription = await Subscription.create({
    subscriber,
    channel: channelId,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, subscription, "Subscribed successfully"));
});

// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  const { page, limit, expand = false } = req.query || {};
  // delete the cache if expand is true

  if (!isValidObjectId(channelId)) {
    throw new ApiError(400, "Invalid channel id");
  }

  const cacheKey = generateCacheKey("subscribers-list", req.query);
  // Check cache

  if (!expand) {
    // check if the response is cached
    const cachedRes = await checkCache(req, cacheKey);
    console.log(" cachedRes:", cachedRes);

    if (cachedRes) {
      console.log("cachedRes not expand");
      return res.status(200).json(cachedRes);
    }
    const subscribers = await Subscription.countDocuments({
      channel: channelId,
    });

    const response = new ApiResponse(200, { subscribers }, "Subscribers count");
    await setCache(req, response, cacheKey);
    return res.status(200).json(response);
  }

  const cachedRes = await checkCache(req, cacheKey);
  if (cachedRes) {
    console.log("cachedRes expand");
    return res.status(200).json(JSON.parse(cachedRes));
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

  await setCache(req, response, cacheKey);
  return res.status(200).json(response);
});

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
  const { username } = req.params;
  const { search } = req.query || {};
  const { page, limit } = req.query || {};
  if (!username) {
    throw new ApiError(400, "Invalid subscriber Name");
  }
  const user = await User.findOne({ username }).select("_id");
  if (!user) {
    throw new ApiError(404, "User not found");
  }
  const cacheKey = generateCacheKey("subscribed-channels", {
    username,
    search,
    page,
    limit,
  });

  // check cache
  const cachedData = await checkCache(req, cacheKey);
  if (cachedData) {
    return res.status(200).json(cachedData);
  }

  // paginate subscribed channels list query
  const subscribedChannelsQuery = Subscription.aggregate([
    {
      $match: { subscriber: user?._id },
    },

    {
      $lookup: {
        from: "users",
        localField: "channel",
        foreignField: "_id",
        as: "channel",
        pipeline: [
          // Add the search filter here
          // search && {...searchQuery},
          {
            $lookup: {
              from: "subscriptions",
              localField: "_id",
              foreignField: "channel",
              as: "channelSubscriber",
            },
          },

          {
            $addFields: {
              isSubscribed: {
                $cond: {
                  if: {
                    $in: [user?._id, "$channelSubscriber.subscriber"],
                  },
                  then: true,
                  else: false,
                },
              },
              channelSubscribers: { $size: "$channelSubscriber" },
            },
          },
        ],
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
        "channel._id": 1,
        "channel.fullName": 1,
        "channel.email": 1,
        "channel.avatar": 1,
        "channel.channelSubscribers": 1,
        "channel.isSubscribed": 1,
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

  // search the result
  const searchedResult = result.docs.filter(({ channel }) => {
    if (search) {
      return (
        channel.username.toLowerCase().includes(search.toLowerCase()) ||
        channel.fullName.toLowerCase().includes(search.toLowerCase())
      );
    }
  });
  const response = new ApiResponse(
    200,
    {
      subscribedChannels: search ? searchedResult : result.docs,
      totalSubscribedChannels: result.totalDocs,
      totalPages: result.totalPages,
      currentPage: result.page,
      hasNextPage: result.hasNextPage,
      hasPrevPage: result.hasPrevPage,
    },
    "Subscribed channels list"
  );
  // cache the response
  await setCache(req, response, cacheKey);
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
