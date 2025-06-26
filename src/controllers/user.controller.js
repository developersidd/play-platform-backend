import jwt from "jsonwebtoken";

import { isValidObjectId } from "mongoose";
import LoginHistory from "../models/loginHistory.model.js";
import Notification from "../models/notification.model.js";
import User from "../models/user.model.js";
import sendMail from "../nodemailer.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import {
  deleteFromCloudinary,
  uploadOnCloudinary,
} from "../utils/cloudinary.js";
import generateAuthTokens from "../utils/generateAuthTokens.js";
import { createMongoId } from "../utils/mongodb.util.js";
import {
  checkCache,
  generateCacheKey,
  revalidateCache,
  revalidateRelatedCaches,
  setCache,
} from "../utils/redis.util.js";
import { createHistory } from "./loginHistory.controller.js";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "none",
  domain: "play-platform.vercel.app",
};

const registerUser = asyncHandler(async (req, res) => {
  const { username, fullName, email, password } = req.body || {};
  // check if all required fields are provided
  if (
    [username, fullName, email, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "Please provide all required fields");
  }
  // check email with regEx
  if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
    throw new ApiError(400, "Please provide a valid email address");
  }
  // check if user already exists
  const existedUser = await User.findOne({ $or: [{ username }, { email }] });
  if (existedUser) {
    throw new ApiError(409, "User already exists");
  }
  // check Images
  /*
    * output of req.files 
    {
      avatar: [
      {
        fieldname: 'avatar',
        originalname: 'ab-siddi
        encoding: '7bit',
        mimetype: 'image/jpeg',
        destination: './public/
        filename: 'ab-siddik.jp
        path: 'public\\temp\\ab
        size: 120789
      }
    ]
  }
    */
  console.log("req.files:", req.files);
  const avatarLocalPath = (req?.files?.avatar ?? [])[0]?.path;
  const coverImageLocalPath = (req?.files?.coverImage ?? [])[0]?.path;
  if (!avatarLocalPath) {
    // throw new ApiError(400, "Avatar and Cover Image are required");
    throw new ApiError(400, "Avatar is required");
  }

  // upload images on cloudinary
  const avatar = await uploadOnCloudinary(avatarLocalPath);

  const coverImage =
    coverImageLocalPath && (await uploadOnCloudinary(coverImageLocalPath));
  if (!avatar?.url) {
    throw new ApiError(
      500,
      "Something went wrong while uploading Avatar Image"
    );
  }

  if (coverImageLocalPath && !coverImage?.url) {
    throw new ApiError(500, "Something went wrong while uploading Cover Image");
  }

  // create user object and save to database
  const user = await User.create({
    username,
    fullName,
    email,
    password,
    avatar: {
      public_id: avatar?.public_id,
      url: avatar?.url,
    },
    coverImage: {
      public_id: coverImage?.public_id,
      url: coverImage?.url,
    },
  });

  // check for user creation and remove password and refresh token from response
  const createdUser = await User.findById(user?._id).select(
    "-password -refreshToken"
  );
  console.log("createdUser:", createdUser);

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering user");
  }
  // Create admin notification
  const notification = await Notification.create({
    sender: user?._id,
    type: "ADMIN",
    message: `${fullName} registered on Youtube Clone`,
    image: avatar?.url,
    link: `/channels/${username}`,
  });

  // Emit real-time notification
  const io = req.app.get("io");
  // make sure you take the callback function as the last argument
  io.to("admin-room").emit("registration", notification, (message) => {
    console.log("message:", message);
  });

  // send response to client
  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User registered successfully"));
});
const loginUser = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body || {};
  console.log(req.body);
  // check if all required fields are provided
  if (!(username || email) || !password) {
    throw new ApiError(400, "Please provide all required fields");
  }
  // check email with regEx
  if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
    throw new ApiError(400, "Please provide a valid email address");
  }
  // check if user exists on DB
  const user = await User.findOne({
    $or: [{ username }, { email }],
  });
  if (!user) {
    throw new ApiError(404, "User not found");
  }
  // check password
  const isPasswordMatched = await user.isPasswordCorrect(password);
  if (!isPasswordMatched) {
    throw new ApiError(401, "Invalid user credentials");
  }
  // create access and refresh token
  const { accessToken, refreshToken } = await generateAuthTokens(user?._id);

  user.refreshToken = refreshToken;
  await user.save({
    validateBeforeSave: false,
  });

  // delete password from response
  user.password = undefined;

  // create login history
  createHistory(req, res, {
    token: accessToken,
    userId: user?._id,
  });
  return res
    .status(200)
    .cookie("accessToken", accessToken, cookieOptions)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json(
      new ApiResponse(
        200,
        { user, tokens: { accessToken, refreshToken } },
        "User logged In successfully"
      )
    );
});

// logout user
const logoutUser = asyncHandler(async (req, res) => {
  const userId = req?.user?._id;
  const loggedInHistoryId = req?.user?.loginHistoryId;
  await User.findByIdAndUpdate(
    userId,
    {
      $unset: { refreshToken: 1 }, // this removes the field from document
    },
    {
      new: true,
    }
  );
  const ss = await LoginHistory.findByIdAndUpdate(
    loggedInHistoryId,
    {
      $set: {
        token: null,
      },
    },
    {
      new: true,
    }
  );
  console.log(" ss:", ss);
  console.log("req.user:", req.user);
  // clear the cookies
  return res
    .status(200)
    .clearCookie("accessToken", cookieOptions)
    .clearCookie("refreshToken", cookieOptions)
    .json(new ApiResponse(200, {}, "User logged out successfully"));
});

// send email Verification code to user email
const sendEmailVerificationCode = asyncHandler(async (req, res) => {
  const { email } = req.body || {};
  if (
    !email ||
    !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)
  ) {
    throw new ApiError(400, "Please provide email address");
  }
  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiError(404, "User not found");
  }
  const verificationDigits = Math.floor(Math.random() * 9000);
  user.verificationDigits = verificationDigits;
  await user.save({ validateBeforeSave: false });
  // send email to user
  await sendMail(
    email,
    "Youtube Clone - Email Verification",
    `Your verification code is ${verificationDigits}`
  );
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Verification code sent to email"));
});

// verify email
const verifyEmail = asyncHandler(async (req, res) => {
  const { email, verificationDigits } = req.body || {};
  if (
    !email ||
    !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email) ||
    !verificationDigits
  ) {
    throw new ApiError(400, "Please provide all required fields");
  }
  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiError(404, "User not found");
  }
  if (user.verificationDigits !== verificationDigits) {
    throw new ApiError(400, "Invalid verification code");
  }
  user.isEmailVerified = true;
  user.verificationDigits = null;
  await user.save({ validateBeforeSave: false });
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Email verified successfully"));
});
// refresh access token
const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies?.refreshToken || req.body?.refreshToken;
  console.log("incomingRefreshToken:", incomingRefreshToken);
  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized request");
  }

  const decodedToken = jwt.verify(
    incomingRefreshToken,
    process.env.REFRESH_TOKEN_SECRET
  );

  const user = await User.findById(decodedToken?._id);
  console.log("user from rat:", user);
  if (!user) {
    throw new ApiError(401, "Invalid refresh token");
  }
  if (user?.refreshToken !== incomingRefreshToken) {
    throw new ApiError(401, "Refresh token in expired or used");
  }

  const { accessToken, refreshToken } =
    (await generateAuthTokens(user?._id)) || {};
  console.log("new accessToken:", accessToken);
  return res
    .status(200)
    .cookie("accessToken", accessToken, cookieOptions)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json(
      new ApiResponse(
        200,
        { accessToken, refreshToken },
        "Access Token refreshed"
      )
    );
});

// change current password
const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    throw new ApiError(400, "Please provide all required fields");
  }
  const user = await User.findById(req?.user?._id);
  if (!user) {
    throw new ApiError(404, "User not found");
  }
  const isPasswordMatched = await user.isPasswordCorrect(currentPassword);
  if (!isPasswordMatched) {
    throw new ApiError(401, "Invalid user credentials");
  }
  user.password = newPassword;
  await user.save({
    validateBeforeSave: false,
  });
  user.password = undefined;
  user.refreshToken = undefined;
  return res
    .status(200)
    .json(new ApiResponse(200, user, "Password changed successfully"));
});

// forgot password
const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body || {};
  if (
    !email ||
    !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)
  ) {
    throw new ApiError(404, "Please Provide a valid email address");
  }

  const user = await User.findOne({ email });
  if (!user) {
    throw new ApiError(404, "User not found");
  }
  const resetToken = await jwt.sign(
    {
      _id: user?._id,
    },
    process.env.RESET_PASSWORD_SECRET,
    {
      expiresIn: "20m",
    }
  );
  user.refreshToken = resetToken;
  await user.save({ validateBeforeSave: false });
  // send email to user with reset token
  await sendMail(
    email,
    "Youtube Clone - Reset Password",
    `<a href="${process.env.SITE_URL}/reset-password/${resetToken}"> Reset password </a>`
  );

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        resetToken,
      },
      "Reset link sent to email"
    )
  );
});

// reset password
const resetPassword = asyncHandler(async (req, res) => {
  const { resetToken, newPassword } = req.body || {};
  if (!resetToken?.trim() || !newPassword?.trim()) {
    throw new ApiError(400, "Please provide all required fields");
  }
  const decodedToken = jwt.verify(
    resetToken,
    process.env.RESET_PASSWORD_SECRET
  );
  if (!decodedToken?._id) {
    throw new ApiError(401, "Invalid reset token");
  }
  const user = await User.findById(decodedToken?._id);
  if (!user) {
    throw new ApiError(404, "User not found");
  }
  user.password = newPassword;
  await user.save({ validateBeforeSave: false });
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password reset successfully"));
});

// find current user
const getCurrentUser = asyncHandler((req, res) =>
  res.status(200).json(new ApiResponse(200, req?.user, "User found"))
);

// get all users
const getAllUsers = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 10,
    sortBy = "createdAt",
    sortOrder = "desc",
    q = "",
  } = req.query;

  // Sorting
  const sortQuery = {
    [decodeURIComponent(sortBy)]: sortOrder === "desc" ? -1 : 1,
  };
  console.log(" sortQuery:", sortQuery);
  const searchQuery = {};
  const decodedQuery = decodeURIComponent(q);
  if (decodedQuery?.length > 0) {
    searchQuery.$or = [
      { fullName: { $regex: decodedQuery, $options: "i" } },
      { username: { $regex: decodedQuery, $options: "i" } },
      { email: { $regex: decodedQuery, $options: "i" } },
    ];
  }
  // Check cache
  const cacheKey = generateCacheKey("all-users", req.query);
  await revalidateCache(req, cacheKey);
  const cachedRes = await checkCache(req, cacheKey);
  if (cachedRes) {
    console.log("cache hit for all users");
    return res.status(200).json(cachedRes);
  }

  const aggregateQuery = User.aggregate([
    {
      $match: searchQuery,
    },
    {
      $lookup: {
        from: "videos",
        localField: "_id",
        foreignField: "owner",
        as: "videos",
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedChannels",
      },
    },
    {
      $lookup: {
        from: "tweets",
        localField: "_id",
        foreignField: "owner",
        as: "tweets",
      },
    },
    {
      $addFields: {
        videosCount: { $size: "$videos" },
        subscribersCount: { $size: "$subscribers" },
        tweetsCount: { $size: "$tweets" },
        subscribedChannelsCount: { $size: "$subscribedChannels" },
      },
    },
    {
      $project: {
        email: 1,
        fullName: 1,
        username: 1,
        avatar: 1,
        coverImage: 1,
        subscribersCount: 1,
        videosCount: 1,

        tweetsCount: 1,
        subscribedChannelsCount: 1,
        createdAt: 1,
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
  const result = await User.aggregatePaginate(aggregateQuery, options);
  // console.log(" result:", result);
  // Create the response object
  const response = new ApiResponse(
    200,
    {
      users: result.docs,
      totalUsers: result.totalDocs,
      totalPages: result.totalPages,
      currentPage: result.page,
      hasNextPage: result.hasNextPage,
      hasPrevPage: result.hasPrevPage,
    },
    "Users found"
  );
  // Cache the response
  await setCache(req, response, cacheKey);
  return res.status(200).json(response);
});

// Delete many users
const deleteManyUsers = asyncHandler(async (req, res) => {
  const { userIds } = req.body;
  if (!Array.isArray(userIds) || userIds.length === 0) {
    throw new ApiError(400, "Please provide user ids to delete");
  }

  // check if all user ids are valid
  const validIds = userIds.filter((id) => isValidObjectId(id));
  if (validIds.length !== userIds.length) {
    throw new ApiError(400, "Invalid user ids provided");
  }

  // delete users
  const result = await User.deleteMany({ _id: { $in: userIds } });
  console.log(" result:", result);
  if (result.deletedCount === 0) {
    throw new ApiError(500, "Failed to delete users");
  }
  await revalidateRelatedCaches(req, "all-users");
  // revalidate all users cache
  return res.status(200).json(new ApiResponse(200, {}, "Users deleted"));
});

// update account  details
const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullName, email, username, description } = req.body || {};
  console.log("description:", description);
  if (!(fullName || email || username || description)) {
    throw new ApiError(400, "Please provide all required fields");
  }
  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        fullName,
        email,
        username,
        description,
      },
    },
    { new: true }
  ).select("-password");
  if (!user) {
    throw new ApiError(500, "Something went wrong while updating user details");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, user, "User details updated successfully"));
});

// change  avatar
const updateAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;
  const reqUser = req?.user || {};
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is missing");
  }

  const { public_id, url } = (await uploadOnCloudinary(avatarLocalPath)) || {};

  if (!url) {
    throw new ApiError(500, "Error occurred while updating avatar");
  }

  const user = await User.findByIdAndUpdate(
    reqUser?._id,
    {
      $set: {
        avatar: {
          url,
          public_id,
        },
      },
    },
    {
      new: true,
    }
  ).select("-password");
  if (!user) {
    throw new ApiError(500, "Error occurred while updating avatar");
  }
  // delete avatar from cloudinary
  const delRes = await deleteFromCloudinary(reqUser?.avatar?.public_id);
  console.log("res:", delRes);
  return res
    .status(200)
    .json(new ApiResponse(200, user, "User avatar updated successfully"));
});

// change  cover avatar
const updateCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;
  const reqUser = req?.user || {};
  if (!coverImageLocalPath) {
    throw new ApiError(400, "Cover Image file is missing");
  }
  const { public_id, url } =
    (await uploadOnCloudinary(coverImageLocalPath)) || {};

  if (!url) {
    throw new ApiError(500, "Error occurred while updating cover Image");
  }

  const user = await User.findByIdAndUpdate(
    reqUser?._id,
    {
      $set: {
        coverImage: {
          url,
          public_id,
        },
      },
    },
    {
      new: true,
    }
  ).select("-password");
  if (!user) {
    throw new ApiError(500, "Error occurred while updating cover Image");
  }
  // delete previous coverImage from cloudinary
  const delRes = await deleteFromCloudinary(reqUser?.coverImage?.public_id);
  console.log("res:", delRes);
  return res
    .status(200)
    .json(new ApiResponse(200, user, "User cover Image updated successfully"));
});

// get user channel profile
const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { username } = req.params || {};
  const loggedInUserId = createMongoId(req?.query?.loggedInUserId);
  const cacheKey = generateCacheKey(
    "user-channel-profile",
    username,
    loggedInUserId
  );
  const cachedResponse = await checkCache(req, cacheKey);
  if (!username?.trim()) {
    throw new ApiError(400, "Please provide username");
  }
  if (cachedResponse) {
    return res.status(200).json(cachedResponse);
  }

  const channel = await User.aggregate([
    {
      $match: {
        username: username?.toLowerCase(),
      },
    },
    // calculate subscribers
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    // calculate subscribed to channels
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedChannels",
      },
    },
    // calculate subscribers and subscribed channels count and isSubscribed
    {
      $addFields: {
        subscribersCount: { $size: "$subscribers" },
        subscribedChannelsCount: { $size: "$subscribedChannels" },
        isSubscribed: {
          // $in: [req?.user?._id, "$subscribers.subscriber"],
          $cond: {
            if: {
              $in: [loggedInUserId, "$subscribers.subscriber"],
            },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        email: 1,
        fullName: 1,
        username: 1,
        avatar: 1,
        coverImage: 1,
        subscribersCount: 1,
        subscribedChannelsCount: 1,
        isSubscribed: 1,
        createdAt: 1,
      },
    },
  ]);

  if (!channel?.length) {
    throw new ApiError(404, "Channel does not exist");
  }
  // cache the response
  const response = new ApiResponse(200, channel[0], "Channel profile found");
  await setCache(req, response, cacheKey);
  return res.status(200).json(response);
});

// get user profile stats
const getUserChannelStats = asyncHandler(async (req, res) => {
  const userId = createMongoId(req?.user?._id);
  const cacheKey = generateCacheKey("user-profile-stats", userId);
  const cachedResponse = await checkCache(req, cacheKey);
  if (cachedResponse) {
    console.log("Cache hit for user profile stats");
    return res.status(200).json(cachedResponse);
  }
  const channelStats = await User.aggregate([
    {
      $match: {
        _id: userId,
      },
    },
    // calculate subscribers
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "owner",
        as: "users",
      },
    },
    // calculate likes
    {
      $lookup: {
        from: "likes",
        localField: "users._id",
        foreignField: "video",
        as: "likes",
      },
    },
    // calculate dislikes
    {
      $lookup: {
        from: "dislikes",
        localField: "users._id",
        foreignField: "video",
        as: "dislikes",
      },
    },
    {
      $addFields: {
        subscribersCount: { $size: "$subscribers" },
        usersCount: {
          $size: "$users",
        },
        viewsCount: {
          $sum: "$users.views",
        },
        likesCount: { $size: "$likes" },
        dislikesCount: { $size: "$dislikes" },
      },
    },
    {
      $project: {
        usersCount: 1,
        subscribersCount: 1,
        viewsCount: 1,
        likesCount: 1,
        dislikesCount: 1,
      },
    },
  ]);
  // console.log(" channelStats:", channelStats)

  if (!channelStats?.length) {
    throw new ApiError(404, "Channel does not exist");
  }

  // cache the response
  const response = new ApiResponse(
    200,
    channelStats[0],
    "User profile stats found"
  );

  await setCache(req, response, cacheKey);
  return res.status(200).json(response);
});

// get user watch history
const getWatchHistory = asyncHandler(async (req, res) => {
  // you need to create a mongoDB Object Id to find by user id because agreegation works directly with mongoDB not used mongoose
  const { q } = req.query || {};
  const userId = createMongoId(req?.user?._id);
  const searchQuery = {};
  const decodedQuery = decodeURIComponent(q);
  if (decodedQuery?.length > 0) {
    searchQuery.$or = [
      { title: { $regex: decodedQuery, $options: "i" } },
      { description: { $regex: decodedQuery, $options: "i" } },
    ];
  }
  let result = await User.aggregate([
    {
      $match: {
        _id: userId,
      },
    },
    {
      $unwind: "$watchHistory", // Flatten watchHistory array
    },

    {
      $lookup: {
        from: "videos",
        localField: "watchHistory.video",
        foreignField: "_id",
        as: "videoDetails",
        pipeline: [
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
                    fullName: 1,
                    username: 1,
                    avatar: 1,
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

          {
            $project: {
              title: 1,
              description: 1,
              thumbnail: 1,
              duration: 1,
              createdAt: 1,
              views: 1,
              owner: 1,
            },
          },
        ],
      },
    },
    // Add video details to watchHistory
    {
      $set: {
        "watchHistory.video": { $arrayElemAt: ["$videoDetails", 0] },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: "%Y-%m-%d", // Group by formatted date
            date: "$watchHistory.createdAt", // Use the createdAt field from watchHistory
          },
        },
        videos: { $push: "$watchHistory" }, // Push all watchHistory objects for the group
      },
    },
    {
      $sort: { _id: -1 },
    },
  ]);
  if (q) {
    const isSearchMatched = result?.some((item) =>
      item?.videos?.some((v) => v?.video?._id)
    );
    if (!isSearchMatched) {
      result = [];
    }
  }

  // cache the response
  const response = new ApiResponse(200, result, "Watch history found");
  /* redisClient.setEx(req.originalUrl, 3600, JSON.stringify(response)); */
  return res.status(200).json(response);
});

// Clear watch history
const clearWatchHistory = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req?.user?._id,
    {
      $set: {
        watchHistory: [],
      },
    },
    {
      new: true,
    }
  );
  if (!user) {
    throw new ApiError(500, "Error occurred while clearing watch history");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Watch history cleared successfully"));
});

// Toggle history pause state
const toggleHistoryPauseState = asyncHandler(async (req, res) => {
  const user = await User.findById(req?.user?._id);
  if (!user) {
    throw new ApiError(404, "User not found");
  }
  user.isHistoryPaused = !user.isHistoryPaused;
  await user.save({ validateBeforeSave: false });
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        isHistoryPaused: user?.isHistoryPaused,
      },
      user?.isHistoryPaused
        ? "Watch history paused successfully"
        : "Watch history resumed successfully"
    )
  );
});

// Delete video from watch history
const deleteVideoFromWatchHistory = asyncHandler(async (req, res) => {
  const { videoId } = req.params || {};
  const user = await User.findByIdAndUpdate(
    req?.user?._id,
    {
      $pull: {
        watchHistory: {
          video: videoId,
        },
      },
    },
    {
      new: true,
    }
  );
  if (!user) {
    throw new ApiError(500, "Error occurred while deleting video from history");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Video deleted from watch history"));
});

export {
  changeCurrentPassword,
  clearWatchHistory,
  deleteManyUsers,
  deleteVideoFromWatchHistory,
  forgotPassword,
  getAllUsers,
  getCurrentUser,
  getUserChannelProfile,
  getUserChannelStats,
  getWatchHistory,
  loginUser,
  logoutUser,
  refreshAccessToken,
  registerUser,
  resetPassword,
  sendEmailVerificationCode,
  toggleHistoryPauseState,
  updateAccountDetails,
  updateAvatar,
  updateCoverImage,
  verifyEmail,
};
