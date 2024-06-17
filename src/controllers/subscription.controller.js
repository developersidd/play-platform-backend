import { isValidObjectId } from "mongoose";
import Subscription from "../models/subscription.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

const toggleSubscription = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  if (!isValidObjectId(channelId)) {
    throw new ApiError(400, "Invalid channel id");
  }
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
      .json(new ApiResponse(200, null, "Unsubscribed successfully"));
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
  const { page, limit } = req.query || {};

  // paginate subscribers list query
  const subscribersQuery = await Subscription.find({ channel: channelId });

  const options = {
    page: parseInt(page, 10) || 1,
    limit: parseInt(limit, 10) || 10,
  };

  const result = await Subscription.aggregatePaginate(
    subscribersQuery,
    options
  );

  console.log("result subscribers:", result);

  return res.status(200).json(
    new ApiResponse(
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
    )
  );
});

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
  const { subscriberId } = req.params;
  const { page, limit } = req.query || {};

  // paginate subscribed channels list query
  const subscribersQuery = await Subscription.find({
    subscriber: subscriberId,
  });

  const options = {
    page: parseInt(page, 10) || 1,
    limit: parseInt(limit, 10) || 10,
  };

  const result = await Subscription.aggregatePaginate(
    subscribersQuery,
    options
  );

  console.log("result subscribed channels:", result);

  return res.status(200).json(
    new ApiResponse(
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
    )
  );
});

export { getSubscribedChannels, getUserChannelSubscribers, toggleSubscription };
