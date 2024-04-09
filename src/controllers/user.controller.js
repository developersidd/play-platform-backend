import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import uploadOnCloudinary from "../utils/cloudinary.js";
import generateAccessAndRefreshToken from "../utils/generateAndSaveAccessAndRefreshToken.js";

const cookieOptions = {
  httpOnly: true,
  secure: true,
};

const registerUser = asyncHandler(async (req, res, next) => {
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
    throw new ApiError(400, "Avatar and Cover Image are required");
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
    avatar: avatar?.url,
    coverImage: coverImage?.url,
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

  res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User registered successfully"));
});
const loginUser = asyncHandler(async (req, res, next) => {
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

  res
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

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req?.user?._id,
    {
      $set: { refreshToken: undefined },
    },
    {
      new: true,
    }
  );
  // clear the cookies
  res
    .status(200)
    .clearCookie("accessToken", cookieOptions)
    .clearCookie("refreshToken", cookieOptions)
    .json(new ApiResponse(200, {}, "User logged out successfully"));
});

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
    res
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

export { loginUser, logoutUser, refreshAccessToken, registerUser };
