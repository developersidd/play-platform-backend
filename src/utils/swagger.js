import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Youtube Clone",
      description: "A simple Youtube Clone API Documentation using Swagger UI",
      version: "1.0.0",
    },
    servers: [
      {
        url: `${process.env.SITE_URL}/api/v1`,
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
    tags: [
      {
        name: "Auth",
        description: "Authentication related endpoints",
      },
      {
        name: "User",
        description: "User related endpoints",
      },
      {
        name: "Video",
        description: "Video related endpoints",
      },
    ],
  },
  apis: ["./src/swagger-ui/*.js", "./src/models/*.ts"],
};

const swaggerSpec = swaggerJsdoc(options);

function swaggerDocs(app, port) {
  // Swagger page
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  // Docs in JSON format
  app.get("/docs.json", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.send(swaggerSpec);
  });

  console.info(`Docs available at http://localhost:${port}/docs`);
}

export default swaggerDocs;
