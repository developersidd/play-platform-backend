import { isValidObjectId } from "mongoose";
import NotificationModel from "../models/notification.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { generateCacheKey, setCache } from "../utils/redis.util.js";

// get notifications for a user
const getNotifications = asyncHandler(async (req, res) => {
  const { _id, role } = req?.user || {};
  const cacheKey = generateCacheKey("notifications", _id, role);
  //  const cachedData = await checkCache(req, cacheKey);
  //  if (cachedData) {
  //      return res.status(200).json(cachedData);
  //    }
  const notifications = await NotificationModel.find({
    $or: [{ recipient: _id?.toString() }, { type: role }],
  })
    .sort({ createdAt: -1 })
    .populate("sender", "username avatar");
  // console.log(" notifications:", notifications);
  const response = new ApiResponse(
    200,
    notifications,
    "Notifications retrieved successfully"
  );
  await setCache(req, response, cacheKey);
  return res.status(200).json(response);
});

// delete notification by id
const deleteNotification = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return new ApiError(400, null, "Invalid notification id");
  }

  const notification = await NotificationModel.findByIdAndDelete(id);
  if (!notification) {
    return new ApiError(404, null, "Notification not found");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, null, "Notification deleted successfully"));
});


export { deleteNotification, getNotifications };
