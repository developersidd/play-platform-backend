import express from "express";
import {
  getDisLikedVideos,
  getVideoDisLikes,
  toggleCommentDisLike,
  toggleTweetDisLike,
  toggleVideoDisLike,
} from "../controllers/dislike.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";

const router = express.Router();
router.get("/video/:videoId", getVideoDisLikes);
router.use(verifyJWT);
router.get("/my/videos", getDisLikedVideos);
router.post("/toggle/v/:videoId", toggleVideoDisLike);
router.post("/toggle/c/:commentId", toggleCommentDisLike);
router.post("/toggle/t/:tweetId", toggleTweetDisLike);

export default router;
