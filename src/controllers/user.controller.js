import jwt from "jsonwebtoken";

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
import { createHistory } from "./loginHistory.controller.js";

const cookieOptions = {
  httpOnly: true,
  secure: true,
};

const registerUser = asyncHandler(async (req, res) => {
  /* Steps to register user */
  // 1. get user details from request body
  // 2. validate user details
  // 3. check if user already exists: username, email
  // 4. check for Images, check for avatar
  // 5. Upload them to cloudinary - check upload successfully
  // 6. create user object - create entry in database
  // 7. remove password and refresh token from response
  // 8. check for user creation
  // 9. send response to client

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
  /* Steps to login user */
  // 1. get user details from request body
  // 2. validate user details
  // 3. check if user exists: username, email
  // 4. check password
  // 5. create access and refresh token
  // 6. set refresh token in cookie
  // 7. send response to client

  const { username, email, password } = req.body || {};
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
  await User.findByIdAndUpdate(
    req?.user?._id,
    {
      $unset: { refreshToken: 1 }, // this removes the field from document
    },
    {
      new: true,
    }
  );
  await LoginHistory.findByIdAndDelete(req.user?.loginHistoryId);
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

const getAllUsers = asyncHandler(async (req, res) => {
  const users = await User.find({}).select("-password");
  return res.status(200).json(new ApiResponse(200, users, "All users found"));
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

const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { username } = req.params || {};
  const loggedInUserId = createMongoId(req?.query?.loggedInUserId);
  console.log("loggedInUserId:", loggedInUserId);
  console.log("username:", username);
  if (!username?.trim()) {
    throw new ApiError(400, "Please provide username");
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
  const { redisClient } = req.app.locals || {};
  const response = new ApiResponse(200, channel[0], "Channel profile found");
  // console.log("channel[0]:", channel[0])
  // redisClient.setEx(req.originalUrl, 3600, JSON.stringify(response));
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
        from: "watchlaters",
        let: {
          videoId: "$watchHistory.videoId",
          userId,
        },
        as: "watchLaterCheck",
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  {
                    $in: ["$$videoId", "$videos.video"],
                  },
                  {
                    $eq: ["$$userId", "$user"],
                  },
                ],
              },
            },
          },
        ],
      },
    },

    {
      $lookup: {
        from: "videos",
        localField: "watchHistory.videoId",
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
      $addFields: {
        "watchHistory.video.isInWatchLater": {
          $gt: [{ $size: "$watchLaterCheck" }, 0],
        },
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
          videoId,
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
  deleteVideoFromWatchHistory,
  forgotPassword,
  getAllUsers,
  getCurrentUser,
  getUserChannelProfile,
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
