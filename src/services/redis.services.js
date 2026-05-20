/* eslint-disable no-param-reassign */
import { createClient } from "redis";

// eslint-disable-next-line no-unused-vars
let redisClient = null;
let isRedisConnected = false;

const initRedis = async (app) => {
  try {
    const client = createClient({
      password: process.env.REDIS_PASSWORD,
      socket: {
        host: process.env.REDIS_HOST,
        // eslint-disable-next-line radix
        port: parseInt(process.env.REDIS_PORT),
        tls: true,
        reconnectStrategy: (retries) => {
          // Stop retrying after 3 attempts to avoid log spam
          if (retries > 3) {
            console.warn(
              "Redis: Max reconnect attempts reached. Running without cache."
            );
            return false; // stop retrying
          }
          return Math.min(retries * 500, 2000); // exponential backoff
        },
      },
    });

    client.on("error", (err) => {
      // Log once, don't crash
      if (isRedisConnected) {
        console.warn("Redis connection lost:", err.message);
        isRedisConnected = false;
      }
    });

    client.on("connect", () => {
      isRedisConnected = true;
      console.log("✅ Connected to Redis");
    });

    await client.connect();
    redisClient = client;
    app.locals.redisClient = client;
    app.locals.isRedisConnected = true;
  } catch (err) {
    // ✅ Don't crash — just warn and continue without Redis
    console.warn("⚠️  Redis unavailable. Running without cache:", err.message);
    app.locals.redisClient = null;
    app.locals.isRedisConnected = false;
  }
};

export default initRedis;
