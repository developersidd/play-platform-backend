import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  changeCurrentPassword,
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
  updateAccountDetails,
  updateAvatar,
  updateCoverImage,
  verifyEmail,
} from "../controllers/user.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
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
router.get("/user-list", getAllUsers);
// logout route
router.route("/logout").post(verifyJWT, logoutUser);
// refresh token route
router.route("/refresh-token").post(refreshAccessToken);
// get watch history
router.route("/history").get(verifyJWT, getWatchHistory);
// get user channel profile
router.route("/c/:username").get(verifyJWT, getUserChannelProfile);
// change password route
router.route("/change-password").post(verifyJWT, changeCurrentPassword);
// get current user
router.route("/current-user").get(verifyJWT, getCurrentUser);
// update account details
router.route("/update-account").patch(verifyJWT, updateAccountDetails);
// update avatar
router.route("/avatar").patch(verifyJWT, upload.single("avatar"), updateAvatar);
// update cover image
router
  .route("/cover-image")
  .patch(verifyJWT, upload.single("coverImage"), updateCoverImage);
// forgot password
router.post("/forgot-password", forgotPassword);
// reset password
router.post("/reset-password", resetPassword);

// send email verification code
router.post("/send-verification-code", verifyJWT, sendEmailVerificationCode);

// verify email
router.post("/verify-email", verifyJWT, verifyEmail);

export default router;
