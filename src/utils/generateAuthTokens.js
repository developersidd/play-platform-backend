import User from "../models/user.model.js";
import ApiError from "./ApiError.js";

const generateAuthTokens = async (userId) => {
  try {
    // find user by id
    const user = await User.findById(userId);
    if (!user) throw new ApiError(404, "User not found");
    // generate access and refresh token
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();
    if (!accessToken || !refreshToken)
      throw new ApiError(500, "Something went wrong while generating tokens");
    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(error?.statusCode || 500, error.message);
  }
};

export default generateAuthTokens;
