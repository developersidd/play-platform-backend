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
    // console.log("auth middleware accessToken:", accessToken);
    if (!accessToken) {
      throw new ApiError(401, "Unauthorized access");
    }

    const decodedToken = jwt.verify(
      accessToken,
      process.env.ACCESS_TOKEN_SECRET
    );
    const user = await User.findById(decodedToken?._id).select("-password");

    if (!user) {
      throw new ApiError(401, "Invalid Access Token");
    }
    let loginHistory = null;
    if (user) {
      loginHistory = await LoginHistory.findOne({
        $and: [{ user: user?._id }, { token: accessToken }],
      });
    }

    if (!loginHistory?._id) {
      throw new ApiError(401, "Login history not found");
    }
    req.user = {
      ...user?._doc,
      accessToken,
      loginHistoryId: loginHistory?._id.toString(),
    };
    next();
  } catch (error) {
    console.log("error:", error);
    throw new ApiError(401, error?.message || "Invalid Access Token");
  }
});

// verify authorization roles
const verifyAuthorization =
  (...roles) =>
  (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      console.log("User role:", req.user?.role);
      return next(new ApiError(403, "Forbidden"));
    }
    next();
  };

export { verifyAuthorization, verifyJWT };
