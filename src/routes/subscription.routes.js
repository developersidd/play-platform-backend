import { Router } from "express";
import {
  checkSubscriptionStatus,
  getSubscribedChannels,
  getUserChannelSubscribers,
  offNotification,
  toggleSubscription,
} from "../controllers/subscription.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/u/:channelId").get(getUserChannelSubscribers);
router.use(verifyJWT);
router.route("/off-notification/:channelId").patch(offNotification);
router.route("/c/:username").get(getSubscribedChannels);
router.post("/c/:channelId", toggleSubscription);
router.route("/status/c/:channelId").get(checkSubscriptionStatus);

export default router;
