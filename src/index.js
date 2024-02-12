// Dependencies
import dotenv from "dotenv";
import connectDB from "./db/index.js";

// require("dotenv").config({path: "./env"})

// configuration
dotenv.config({ path: "./env" });
connectDB();
