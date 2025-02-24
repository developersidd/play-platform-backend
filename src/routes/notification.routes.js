import { Router } from "express";
import {
  getNotifications,
  updateNotification,
} from "../controllers/notification.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";

const router = Router();
router.use(verifyJWT);
router.get("/", getNotifications);
router.patch("/:id", updateNotification);

export default router;
