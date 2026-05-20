// Helper to safely get client
const getClient = (req) => req?.app?.locals?.redisClient ?? null;

// Generate cache key
const generateCacheKey = (resource, ...props) =>
  `app:${resource}:${JSON.stringify(...props)}`;

// check cache 
const checkCache = async (req, cacheKey) => {
  const client = getClient(req);
  if (!client) return false; 

  try {
    const cachedData = await client.get(cacheKey);
    return cachedData ? JSON.parse(cachedData) : false;
  } catch (err) {
    console.warn("Cache read failed:", err.message);
    return false;
  }
};

// default duration is 1 hour
const setCache = async (req, data, cacheKey, duration = 3600) => {
  const client = getClient(req);
  if (!client) return;

  try {
    await client.setEx(cacheKey, duration, JSON.stringify(data));
  } catch (err) {
    console.warn("Cache write failed:", err.message);
  }
};

// revalidate single cache key
const revalidateCache = async (req, cacheKey) => {
  const client = getClient(req);
  if (!client) return;

  try {
    await client.del(cacheKey);
  } catch (err) {
    console.warn("Cache delete failed:", err.message);
  }
};

// revalidate related caches by pattern
const revalidateRelatedCaches = async (req, prefixKey, ...props) => {
  const client = getClient(req);
  if (!client) return;

  try {
    const pattern = `app:${prefixKey}:${JSON.stringify(...props)}:*`;
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(keys);
    }
  } catch (err) {
    console.warn("Cache pattern-delete failed:", err.message);
  }
};

export {
  checkCache,
  generateCacheKey,
  revalidateCache,
  revalidateRelatedCaches,
  setCache,
};
