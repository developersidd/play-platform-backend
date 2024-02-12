import express from "express";

const app = express();

// Anything in this directory will be served up as static content.
app.use(express.static("public"));
