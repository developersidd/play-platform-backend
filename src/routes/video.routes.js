import express from "express";
import {
  deleteVideo,
  getAllVideos,
  getVideoById,
  publishVideo,
  updateVideoById,
  updateVideoPublishStatus,
} from "../controllers/video.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import upload from "../middlewares/multer.middleware.js";
import checkCache from "../middlewares/redisCache.middleware.js";

const router = express.Router();
// Apply verifyJWT middleware to all routes in this file

router
  .route("/")
  .post(
    verifyJWT,
    upload.fields([
      {
        name: "videoFile",
        maxCount: 1,
      },
      {
        name: "thumbnail",
        maxCount: 1,
      },
    ]),
    publishVideo
  )
  .get(checkCache, getAllVideos);
// single video routes
router
  .route("/:id")
  .get(checkCache, getVideoById)
  .delete(verifyJWT, deleteVideo)
  .patch(verifyJWT, upload.single("thumbnail"), updateVideoById);

// Toggle video publish status
router.route("/toggle/publish/:id").patch(verifyJWT, updateVideoPublishStatus);

export default router;
