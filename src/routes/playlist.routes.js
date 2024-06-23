import { Router } from "express";
import {
  addVideoToPlaylist,
  createPlaylist,
  deletePlaylist,
  getPlaylistById,
  getUserPlaylists,
  removeVideoFromPlaylist,
  updatePlaylist,
} from "../controllers/playlist.controller.js";

import verifyJWT from "../middlewares/auth.middleware.js";
import checkCache from "../middlewares/redisCache.middleware.js";

const router = Router();

router.use(verifyJWT); // Apply verifyJWT middleware to all routes in this file

router.route("/").post(createPlaylist);

router
  .route("/:playlistId")
  .get(checkCache, getPlaylistById)
  .patch(updatePlaylist)
  .delete(deletePlaylist);

router.route("/add/:videoId/:playlistId").patch(addVideoToPlaylist);

router.route("/remove/:videoId/:playlistId").patch(removeVideoFromPlaylist);

router.route("/user/:userId").get(checkCache, getUserPlaylists);

export default router;