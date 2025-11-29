//  generate cache key
const generateCacheKey = (resource, ...props) =>
  `app:${resource}:${JSON.stringify(...props)}`;

// check cache
const checkCache = async (req, cacheKey) => {
  const { redisClient } = req.app.locals || {};
  const cachedData = await redisClient.get(cacheKey);
  if (cachedData) {
    // console.log("Cache hit");
    return JSON.parse(cachedData);
  }
  return false;
};

// default duration is 1 hour
const setCache = async (req, data, cacheKey, duration = 3600) => {
  const { redisClient } = req.app.locals || {};
  await redisClient.setEx(cacheKey, duration, JSON.stringify(data));
};

// revalidate cache
const revalidateCache = async (req, cacheKey) => {
  const { redisClient } = req.app.locals || {};
  await redisClient.del(cacheKey);
};

// revalidate related caches
const revalidateRelatedCaches = async (req, prefixKey, ...props) => {
  const { redisClient } = req.app.locals || {};
  // Delete all related cache keys
  const videoCachePattern = `app:${prefixKey}:${JSON.stringify(...props)}:*`;
  const keys = await redisClient.keys(videoCachePattern);
  // console.log("rvlad keys:", keys);
  if (keys.length > 0) {
    // console.log("Deleting related caches");
    await redisClient.del(...keys); // Delete all related caches
  }
};

export {
  checkCache,
  generateCacheKey,
  revalidateCache,
  revalidateRelatedCaches,
  setCache,
};
