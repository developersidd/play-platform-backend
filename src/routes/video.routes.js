import express from "express";
import { getAllVideos, publishVideo } from "../controllers/video.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import upload from "../middlewares/multer.middleware.js";

const router = express.Router();

router.use(verifyJWT); // Apply verifyJWT middleware to all routes in this file

router
  .route("/")
  .post(
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
  .get(getAllVideos);

export default router;
