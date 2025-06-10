import  jwt  from "jsonwebtoken";
import DeviceDetector from "node-device-detector";
import LoginHistory from "../models/loginHistory.model.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

const createHistory = asyncHandler(async (req, res, { token, userId }) => {
  // Login History
  const detector = new DeviceDetector({
    deviceAliasCode: true,
    deviceInfo: true,
  });
  const userAgent = req.headers["user-agent"];

  let deviceInfo = {};
  const ip = req.clientIp;
  const result = detector.detect(userAgent);
  if (result) {
    deviceInfo = {
      os: result.os.name,
      version: result.os.version || "Unknown",
      model: result.device.model || "Unknown",
      browser: result.client.name || "Unknown",
      deviceType: result.device.type || "Unknown",
    };
  }

  const loginHistory = await LoginHistory.findOneAndUpdate(
    {
      $and: [{ user: userId }, { userAgent }],
    },
    {
      user: userId,
      ip,
      time: new Date().toISOString(),
      token,
      deviceInfo,
      userAgent,
    },
    {
      upsert: true,
      new: true,
    }
  );
  console.log("loginHistory:", loginHistory);
  return loginHistory;
});

// check if the user has login history using the access token getting from params request

const hasLoginHistory = asyncHandler(async (req, res) => {
  const accessToken =
    req?.cookies?.accessToken ||
    req.header("Authorization")?.replace("Bearer ", "");
  const decoded = jwt.decode(accessToken);
  const userId = decoded?._id;
  const loginHistory = await LoginHistory.findOne({
    token: accessToken,
    user: userId,
  });
  if (!loginHistory) {
    return res
      .status(401)
      .json(new ApiResponse(404, {}, "Login history not found"));
  }
  return res.status(200).json(
    new ApiResponse(
      200,
      {
        hasLoginHistory: true,
      },
      "Login history found"
    )
  );
});

const getLoginHistory = asyncHandler(async (req, res) => {
  const data = await LoginHistory.find({ user: req.user._id });
  console.log("history id:", req.user.loginHistoryId);
  // console.log("history user:", req.user);
  const modifiedHistory = data.map((history) => {
    if (history?._id?.toString() === req.user.loginHistoryId) {
      return {
        ...history._doc,
        isActive: true,
      };
    }
    return history._doc;
  });
  // cache the response
  // const { redisClient } = req.app.locals || {};
  const response = new ApiResponse(200, modifiedHistory, "Login history found");
  // redisClient.setEx(req.originalUrl, 3600, JSON.stringify(response));
  return res.status(200).json(response);
});

// Delete a single login history record
const deleteLoginHistory = asyncHandler(async (req, res) => {
  const { id: loginHistoryId } = req.params;

  await LoginHistory.findByIdAndDelete(loginHistoryId);
  return res.status(200).json(new ApiResponse(200, {}, "Login history deleted"))
    .cookies;
});

// Delete all login records except the current one
const deleteAllLoginHistory = asyncHandler(async (req, res) => {
  await LoginHistory.deleteMany({
    $and: [{ user: req.user._id }, { token: { $ne: req.cookies.accessToken } }],
  });
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "All login history deleted"));
});

export {
  createHistory,
  deleteAllLoginHistory,
  deleteLoginHistory,
  getLoginHistory,
  hasLoginHistory,
};
