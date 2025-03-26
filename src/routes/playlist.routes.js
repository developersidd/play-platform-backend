import { Router } from "express";
import {
  createPlaylist,
  deletePlaylist,
  getPlaylistById,
  getUserCollections,
  getUserPlaylists,
  toggleVideoInPlaylist,
  updatePlaylist,
} from "../controllers/playlist.controller.js";

import verifyJWT from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/").post(verifyJWT, createPlaylist);

router.get("/collections", verifyJWT, getUserCollections);
router
  .route("/:playlistId")
  .get(getPlaylistById)
  .patch(verifyJWT, updatePlaylist)
  .delete(verifyJWT, deletePlaylist);

router
  .route("/:playlistId/v/:videoId/toggle")
  .patch(verifyJWT, toggleVideoInPlaylist);

router.route("/user/:username").get(getUserPlaylists);

export default router;
