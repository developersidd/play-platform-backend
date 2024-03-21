// Dependencies
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";

// import Routes
import userRouter from "./routes/user.routes.js";

// App Initialization
const app = express();

// Middlewares
app.use(express.json({ limit: "20kb" }));
app.use(express.urlencoded({ limit: "20kb" }));
// Anything in this directory will be served up as static content.
app.use(express.static("public"));
app.use(cors({ credentials: true, origin: process.env.CORS_ORIGIN }));
app.use(cookieParser());
// routes
app.use("/api/v1/users", userRouter);



export default app;
