// Dependencies
import dotenv from "dotenv";
import app from "./app.js";
import connectDB from "./db/index.js";
import swaggerDocs from "./utils/swagger.js";
// configure environment variables
dotenv.config({ path: "./.env" });

// configuration
const { PORT } = process.env;

// connect to DB and start server
connectDB()
  .then(() => {
    // check if app is ready to run
    app.on("error", (error) => {
      console.log("Application isn't ready to run");
      throw error;
    });
    // Swagger
    swaggerDocs(app, PORT);
    // start server
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.log("MongoDB connection failed !!!", err);
  });
