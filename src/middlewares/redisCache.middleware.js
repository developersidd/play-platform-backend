// Middleware to check if data is in the cache
const checkCache = async (req, res, next) => {
  const { redisClient } = req.app.locals || {};
  const key = req?.redisKey ?? req.originalUrl;
  console.log("key:", key);
  console.log("from cache");
  const cachedData = await redisClient.get(key);
  if (cachedData) {
    return res.status(200).json(JSON.parse(cachedData));
  }
  next(); // Continue to the route handler if data is not in the cache
};
export default checkCache;
