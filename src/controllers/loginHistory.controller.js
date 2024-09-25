import DeviceDetector from "node-device-detector";
import LoginHistory from "../models/loginHistory.model.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

const createHistory = asyncHandler(async (req, res, { token, userId }) => {
  // Login History
  const detector = new DeviceDetector({
    clientIndexes: true,
    deviceIndexes: true,
    deviceAliasCode: false,
    deviceTrusted: false,
    deviceInfo: false,
    maxUserAgentSize: 500,
  });
  let deviceInfo = {};
  const ip = req.clientIp;
  console.log("ip:", ip);
  const userAgent = req.headers["user-agent"];
  console.log("userAgent:", userAgent);
  const result = detector.detect(userAgent);
  console.log("result:", result);
  if (result) {
    deviceInfo = {
      os: result.os.name,
      model: result.device.model ?? "",
      browser: result.client.name,
      deviceTye: result.device.type,
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

const getLoginHistory = asyncHandler(async (req, res) => {
  const data = await LoginHistory.find({ user: req.user._id });
  console.log("data:", data);
  const modifiedHistory = data.map((history) => {
    if (history.token === req.cookies.accessToken) {
      return {
        ...history._doc,
        isActive: true,
      };
    }
    return history._doc;
  });
  // cache the response
  const { redisClient } = req.app.locals || {};
  const response = new ApiResponse(200, modifiedHistory, "Login history found");
  redisClient.setEx(req.originalUrl, 3600, JSON.stringify(response));
  return res.status(200).json(response);
});

const logoutSingleDevice = asyncHandler(async (req, res) => {
  const { id: loginHistoryId } = req.params;

  await LoginHistory.findByIdAndDelete(loginHistoryId);
  return res.status(200).json(new ApiResponse(200, {}, "Logout successful"));
});

const logoutAllDevices = asyncHandler(async (req, res) => {
  await LoginHistory.deleteMany({
    $and: [{ user: req.user._id }, { token: { $ne: req.cookies.accessToken } }],
  });
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Logout from all devices successful"));
});

export { createHistory, getLoginHistory, logoutAllDevices, logoutSingleDevice };
