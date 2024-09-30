const generateCacheKey = (resource, props) =>
  `app:${resource}:${JSON.stringify(props)}`;

const checkCache = async (req, cacheKey) => {
  const { redisClient } = req.app.locals || {};
  const cachedData = await redisClient.get(cacheKey);
  if (cachedData) {
    console.log("Cache hit");
    return JSON.parse(cachedData);
  }
  return false;
};

const setCache = async (req, data, cacheKey) => {
  const { redisClient } = req.app.locals || {};
  await redisClient.setEx(cacheKey, 3600, JSON.stringify(data));
};

const revalidateCache = async (req, cacheKey) => {
  const { redisClient } = req.app.locals || {};
  await redisClient.del(cacheKey);
};
const revalidateRelatedCaches = async (req, prefixKey) => {
  const { redisClient } = req.app.locals || {};
  // Delete all related cache keys
  const videoCachePattern = `app:${prefixKey}:*`;
  const keys = await redisClient.keys(videoCachePattern);
  console.log("keys:", keys);
  if (keys.length > 0) {
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
