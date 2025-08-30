import { Router } from "express";
import {
  checkSubscriptionStatus,
  getMonthlySubscriptionGrowth,
  getSubscribedChannels,
  getUserChannelSubscribers,
  offNotification,
  toggleSubscription,
} from "../controllers/subscription.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/u/:channelId").get(getUserChannelSubscribers);
router.route("/c/:username").get(getSubscribedChannels);
router.use(verifyJWT);
router.route("/off-notification/:channelId").patch(offNotification);
router.post("/c/:channelId", toggleSubscription);
router.route("/status/c/:channelId").get(checkSubscriptionStatus);
router.route("/growth").get(getMonthlySubscriptionGrowth);

export default router;
