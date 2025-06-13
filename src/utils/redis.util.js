import Video from "../models/video.model.js";

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
const revalidateRelatedCaches = async (req, prefixKey) => {
  const { redisClient } = req.app.locals || {};
  // Delete all related cache keys
  const videoCachePattern = `app:${prefixKey}:*`;
  const keys = await redisClient.keys(videoCachePattern);
  // console.log("rvlad keys:", keys);
  if (keys.length > 0) {
    // console.log("Deleting related caches");
    await redisClient.del(...keys); // Delete all related caches
  }
};

// Check and add views in Redis
async function addViewIfNotExists(req, videoId, userIp) {
  const redisKey = `video:${videoId}:viewedBy:${userIp}`;
  const videoCacheKey = generateCacheKey("video", videoId);

  // Check if the user (IP) has already viewed the video within the last 24 hours
  const viewExists = await checkCache(req, redisKey);
  // console.log("viewExists:", viewExists)

  if (!viewExists) {
    // Set a key with an expiry of 24 hours (86400 seconds) in Redis
    await setCache(req, true, redisKey, 86400);

    // Increment the view count in MongoDB
    await Video.findByIdAndUpdate(videoId, { $inc: { views: 1 } });
    await revalidateCache(req, videoCacheKey); // Revalidate the video cache
    return true; // View added
  }

  return false; // View not added
}

export {
  addViewIfNotExists,
  checkCache,
  generateCacheKey,
  revalidateCache,
  revalidateRelatedCaches,
  setCache
};

