import { Router } from "express";
import {
  createPlaylist,
  deleteManyPlaylist,
  deletePlaylist,
  getPlaylistById,
  getUserCollections,
  getUserPlaylists,
  toggleVideoInPlaylist,
  updatePlaylist,
} from "../controllers/playlist.controller.js";

import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/collections", verifyJWT, getUserCollections);
router
  .route("/")
  .post(verifyJWT, createPlaylist)
  .delete(verifyJWT, deleteManyPlaylist);
router
  .route("/:playlistId")
  .get(getPlaylistById)
  .patch(verifyJWT, updatePlaylist)
  .delete(verifyJWT, deletePlaylist);

router
  .route("/:playlistId/v/:videoId/toggle")
  .patch(verifyJWT, toggleVideoInPlaylist);

// Get user collections

// Get playlists by username
router.get("/user/:username", getUserPlaylists);

export default router;
