import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

const healthcheck = asyncHandler((req, res) =>
  res.status(200).json(new ApiResponse(200, {}, "OK"))
);

export default healthcheck;
