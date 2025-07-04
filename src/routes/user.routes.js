import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
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
} from "../controllers/user.controller.js";
import {
  verifyAuthorization,
  verifyJWT,
} from "../middlewares/auth.middleware.js";
import upload from "../middlewares/multer.middleware.js";

const router = Router();

const appLimiter = rateLimit({
  windowMs: 30 * 60 * 1000,
  max: 30,
  message: "Too many requests from this IP, please try again after an hour",
});

// Register route
router.post(
  "/register",
  upload.fields([
    { name: "avatar", maxCount: 1 },
    { name: "coverImage", maxCount: 1 },
  ]),
  registerUser
);

// login route
router.post("/login", appLimiter, loginUser);
// get all users
router.get("/all", verifyJWT, verifyAuthorization("ADMIN"), getAllUsers);
// delete many users
router.delete("/", verifyJWT, verifyAuthorization("ADMIN"), deleteManyUsers);

// logout route
router.post("/logout", verifyJWT, logoutUser);
// refresh token route
router.post("/refresh-token", refreshAccessToken);
// get watch history
router.get("/history", verifyJWT, getWatchHistory);

// clear watch history
router.delete("/history/clear", verifyJWT, clearWatchHistory);

// pause watch history
router.patch("/history/toggle-pause", verifyJWT, toggleHistoryPauseState);

// delete video from watch history
router.delete(
  "/history/remove/:videoId",
  verifyJWT,
  deleteVideoFromWatchHistory
);

// get user channel stats
router.get("/profile/stats", verifyJWT, getUserChannelStats);

// get user channel profile
router.get("/c/:username", getUserChannelProfile);

// change password route
router.post("/change-password", verifyJWT, changeCurrentPassword);
// get current user
router.get("/current-user", verifyJWT, getCurrentUser);
// update account details
router.patch("/update-account", verifyJWT, updateAccountDetails);
// update avatar
router.patch("/avatar", verifyJWT, upload.single("avatar"), updateAvatar);
// update cover image
router.patch(
  "/cover-image",
  verifyJWT,
  upload.single("coverImage"),
  updateCoverImage
);
// forgot password
router.post("/forgot-password", forgotPassword);
// reset password
router.post("/reset-password", resetPassword);

// send email verification code
router.post("/send-verification-code", verifyJWT, sendEmailVerificationCode);

// verify email
router.post("/verify-email", verifyJWT, verifyEmail);

export default router;
