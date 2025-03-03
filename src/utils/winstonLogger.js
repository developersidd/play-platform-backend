import winston from "winston";

const { combine, timestamp, json, errors } = winston.format;

const logger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format: combine(errors({ stack: true }), timestamp(), json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "logs/combined.log" }),
    new winston.transports.File({
      filename: "logs/errors.log",
      level: "error",
    }),
  ],
  exceptionHandlers: [
    new winston.transports.File({ filename: "logs/exceptions.log" }),
  ],
  rejectionHandlers: [
    new winston.transports.File({ filename: "logs/rejections.log" }),
  ],
});

export default logger;
