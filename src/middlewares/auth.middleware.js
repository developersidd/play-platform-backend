import jwt from "jsonwebtoken";
import LoginHistory from "../models/loginHistory.model.js";
import User from "../models/user.model.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";

const verifyJWT = asyncHandler(async (req, _, next) => {
  try {
    const accessToken =
      req?.cookies?.accessToken ||
      req.header("Authorization")?.replace("Bearer ", "");
    if (!accessToken) {
      throw new ApiError(401, "Unauthorized access");
    }
    const decodedToken = jwt.verify(
      accessToken,
      process.env.ACCESS_TOKEN_SECRET
    );
    const user = await User.findById(decodedToken?._id).select(
      "-password -refreshToken"
    );
    const loginHistory = await LoginHistory.findOne({
      $and: [{ user: user?._id }, { token: accessToken }],
    });
    console.log("loginHistory from auth:", loginHistory);
    if (!user || !loginHistory) {
      throw new ApiError(401, "Invalid Access Token");
    }
    req.user = { ...user?._doc, loginHistoryId: loginHistory?._id };
    console.log("req.user from auth:", req.user);
    next();
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid Access Token");
  }
});

export default verifyJWT;
