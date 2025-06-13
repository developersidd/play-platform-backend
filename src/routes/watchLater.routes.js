import { Router } from "express";
import {
  addVideoInWatchLater,
  getUserWatchLaterVideos,
  removeVideoFromWatchLater,
  updateVideoPositionsInWatchLater,
} from "../controllers/watchLater.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.use(verifyJWT);

router
  .get("/videos", getUserWatchLaterVideos)
  .patch("/videos/reorder", updateVideoPositionsInWatchLater);

router
  .patch("/v/:videoId/add", addVideoInWatchLater)
  .delete("/v/:videoId/remove", removeVideoFromWatchLater);

export default router;
