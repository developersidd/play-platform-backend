import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import {
  deleteFromCloudinary,
  uploadOnCloudinary,
} from "../utils/cloudinary.js";
import generateAccessAndRefreshToken from "../utils/generateAndSaveAccessAndRefreshToken.js";
import { createMongoId } from "../utils/mongodb.util.js";

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
  const avatarLocalPath = (req?.files?.avatar ?? [])[0]?.path;
  const coverImageLocalPath = (req?.files?.coverImage ?? [])[0]?.path;
  if (!avatarLocalPath) {
    // throw new ApiError(400, "Avatar and Cover Image are required");
    throw new ApiError(400, "Avatar is required");
  }

  // upload images on cloudinary
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);
  if (!avatar?.url) {
    throw new ApiError(
      500,
      "Something went wrong while uploading Avatar Image"
    );
  }

  if (!coverImage?.url) {
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

  console.log("files", req.files);

  // send response to client

  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User registered successfully"));
});
const loginUser = asyncHandler(async (req, res) => {
  /* Steps to register user */
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
  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user?._id
  );

  user.refreshToken = refreshToken;
  await user.save({
    validateBeforeSave: false,
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
  // clear the cookies
  return res
    .status(200)
    .clearCookie("accessToken", cookieOptions)
    .clearCookie("refreshToken", cookieOptions)
    .json(new ApiResponse(200, {}, "User logged out successfully"));
});

// refresh access token
const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies?.refreshToken || req.body?.refreshToken;
  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized request");
  }
  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );
    const user = await User.findById(decodedToken?._id);
    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }
    if (user?.refreshToken !== incomingRefreshToken) {
      throw new ApiError(401, "Refresh token in expired or used");
    }

    const { accessToken, refreshToken } =
      (await generateAccessAndRefreshToken(user?._id)) || {};
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
  } catch (error) {
    throw new ApiError(401, error.message || "Invalid refresh token");
  }
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
  return res
    .status(200)
    .json(new ApiResponse(200, user, "Password changed successfully"));
});

// find current user
const getCurrentUser = asyncHandler((req, res) =>
  res.status(200).json(new ApiResponse(200, req?.user, "User found"))
);

// update account  details
const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body || {};
  if (!(fullName || email)) {
    throw new ApiError(400, "Please provide all required fields");
  }
  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        fullName,
        email,
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
              $in: [req.user?._id, "$subscribers.subscriber"],
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

  console.log("channel:", channel);
  if (!channel?.length) {
    throw new ApiError(404, "Channel does not exist");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, channel[0], "Channel profile found"));
});

// get user watch history

const getWatchHistory = asyncHandler(async (req, res) => {
  // you need to create a mongoDB Object Id to find by user id because agreegation works directly with mongoDB not used mongoose
  const userId = createMongoId(req?.user?._id);
  const user = await User.aggregate([
    {
      $match: {
        _id: userId,
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        /* populate: {
          path: "owner",
          model: "User",
          select: "username avatar",
        },
        */
        pipeline: [
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
                // $arrayElemtAt: ["$owner", 0],
                $first: "$owner",
              },
            },
          },
          /* {
            $project: {
              title: 1,    
            }
          } */
        ],
      },
    },
  ]);
  console.log("user from watch history:", user);
  return res
    .status(200)
    .json(new ApiResponse(200, user[0]?.watchHistory, "Watch history found"));
});

const getAllUsers = asyncHandler(async (req, res) => {
  const users = await User.find({}).select("-password");
  return res.status(200).json(new ApiResponse(200, users, "All users found"));
});

export {
  changeCurrentPassword,
  getAllUsers,
  getCurrentUser,
  getUserChannelProfile,
  getWatchHistory,
  loginUser,
  logoutUser,
  refreshAccessToken,
  registerUser,
  updateAccountDetails,
  updateAvatar,
  updateCoverImage,
};
