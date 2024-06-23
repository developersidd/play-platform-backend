import { Router } from "express";
import {
  getSubscribedChannels,
  getUserChannelSubscribers,
  toggleSubscription,
} from "../controllers/subscription.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import checkCache from "../middlewares/redisCache.middleware.js";

const router = Router();
router.use(verifyJWT); // Apply verifyJWT middleware to all routes in this file

router
  .route("/c/:subscriberId")
  .get(checkCache, getSubscribedChannels)
  .post(toggleSubscription);

router.route("/u/:channelId").get(checkCache, getUserChannelSubscribers);

export default router;
