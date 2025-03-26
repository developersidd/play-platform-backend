import { Router } from "express";
import {
  addVideoInWatchLater,
  getUserWatchLaterVideos,
  removeVideoFromWatchLater,
} from "../controllers/watchLater.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";

const router = Router();

router.use(verifyJWT);

router.route("/videos").get(getUserWatchLaterVideos);

router
  .patch("/v/:videoId/add", addVideoInWatchLater)
  .delete("/v/:videoId/remove", removeVideoFromWatchLater);

export default router;
