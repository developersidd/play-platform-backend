// Middleware to check if data is in the cache
const checkCache = async (req, res, next) => {
  const { redisClient } = req.app.locals || {};
  const key = req.originalUrl;
  const cachedData = await redisClient.get(key);
  if (cachedData) {
    console.log("Data from cache");
    res.status(200).send(JSON.parse(cachedData));
  } else {
    next(); // Continue to the route handler if data is not in the cache
  }
};
export default checkCache;
