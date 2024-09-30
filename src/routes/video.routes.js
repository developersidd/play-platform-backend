import express from "express";
import {
  deleteVideo,
  getAllVideos,
  getRelatedVideos,
  getVideoById,
  publishVideo,
  updateAllVideo,
  updateVideoById,
  updateVideoPublishStatus,
} from "../controllers/video.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import upload from "../middlewares/multer.middleware.js";

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
  .patch(verifyJWT, updateAllVideo)
  .get(getAllVideos);
// related video routes

router.get("/related/:id", getRelatedVideos);
// single video routes
router
  .route("/:id")
  .get(getVideoById)
  .delete(verifyJWT, deleteVideo)
  .patch(verifyJWT, upload.single("thumbnail"), updateVideoById);

// Toggle video publish status
router.route("/toggle/publish/:id").patch(verifyJWT, updateVideoPublishStatus);

export default router;
