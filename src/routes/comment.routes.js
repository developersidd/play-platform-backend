import { Router } from "express";
import {
  addComment,
  deleteComment,
  getVideoComments,
  updateComment,
} from "../controllers/comment.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/:videoId").get(getVideoComments);
router.post("/add/v/:videoId", verifyJWT, addComment);
router
  .route("/c/:commentId")
  .delete(verifyJWT, deleteComment)
  .patch(verifyJWT, updateComment);

export default router;
