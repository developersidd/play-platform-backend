import express from "express";

import {
  deleteAllLoginHistory,
  deleteLoginHistory,
  getLoginHistory,
  hasLoginHistory,
} from "../controllers/loginHistory.controller.js";
import verifyJWT from "../middlewares/auth.middleware.js";

const router = express.Router();
router.use(verifyJWT);
router.get("/", getLoginHistory);
router.get("/has/:accessToken", hasLoginHistory);
router.get("");
router.delete("/remove/:id", deleteLoginHistory);
router.delete("/remove/all", deleteAllLoginHistory);

export default router;
