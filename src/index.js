// Dependencies
import "./lib/env.js";
import { app, server } from "./app.js";
import connectDB from "./db/db.js";
import initRedis from "./services/redis.services.js";
import swaggerDocs from "./utils/swagger.js";

// configuration
const { PORT } = process.env;

// connect to DB and start server
connectDB()
  .then(async () => {
    // check if app is ready to run
    app.on("error", (error) => {
      console.log("Application isn't ready to run");
      throw error;
    });
    // initialize Redis client
    if (process.env.NODE_ENV === "production") {
      await initRedis(app);
    }
    // Swagger
    swaggerDocs(app, PORT);
    // start server
    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.log("MongoDB connection failed !!!", err);
  });
