import { Router } from "express";
import {
  checkSubscriptionStatus,
  getSubscribedChannels,
  getUserChannelSubscribers,
  toggleSubscription,
} from "../controllers/subscription.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/u/:channelId").get(getUserChannelSubscribers);
router.route("/c/:username").get(getSubscribedChannels);
router.use(verifyJWT); // Apply verifyJWT middleware to all routes in this file
router.post("/c/:channelId", toggleSubscription);

router.route("/status/c/:channelId").get(checkSubscriptionStatus);

export default router;
