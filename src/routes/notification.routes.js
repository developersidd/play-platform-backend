import { Router } from "express";
import {
  deleteNotification,
  getNotifications,
} from "../controllers/notification.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();
router.use(verifyJWT);
router.get("/", getNotifications);
router.delete("/:id", deleteNotification);
router.patch("/:id");

export default router;
