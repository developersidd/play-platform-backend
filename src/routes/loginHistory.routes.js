import express from "express";

import {
  getLoginHistory,
  logoutAllDevices,
  logoutSingleDevice,
} from "../controllers/loginHistory.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import checkCache from "../middlewares/redisCache.middleware.js";

const router = express.Router();
router.use(verifyJWT);
router.get("/", checkCache, getLoginHistory);
router.get("/single/logout/:id", logoutSingleDevice);
router.get("/all/logout", logoutAllDevices);

export default router;
