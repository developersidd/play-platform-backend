import Comment from "../models/comment.model.js";
import DisLike from "../models/dislike.model.js";
import Like from "../models/like.model.js";
import Playlist from "../models/playlist.model.js";
import User from "../models/user.model.js";
import Video from "../models/video.model.js";
import WatchLater from "../models/watchLater.model.js";
import { checkCache, generateCacheKey, revalidateCache, setCache } from "../utils/redis.util.js";

const addToWatchHistory = async (userId, videoId) => {
  try {
    const user = await User.findById(userId);
    if (!user || user.isHistoryPaused) return;

    // Remove existing entry (if any)
    user.watchHistory = user.watchHistory.filter(
      (entry) => entry.video.toString() !== videoId.toString()
    );

    // Add new entry to start
    user.watchHistory.unshift({ video: videoId, createdAt: new Date() });

    // Limit history size
    if (user.watchHistory.length > 50) {
      user.watchHistory = user.watchHistory.slice(0, 50);
    }

    await user.save({ validateBeforeSave: false });

    return { success: true, message: "Video added to watch history." };
  } catch (error) {
    console.error("Error adding to watch history:", error);
    return { success: false, message: "Failed to update watch history." };
  }
};

// clean up references to deleted videos in User, Playlist, Collection, Comment, and Like models
async function cleanUpReferences(videoIds) {
  try {
    const cleanupOps = [
      WatchLater.updateMany({}, { $pull: { videos: { video: { $in: videoIds } } } }),
      Playlist.updateMany(
        {},
        { $pull: { videos: { video: { $in: videoIds } } } }
      ),
      User.updateMany(
        {},
        { $pull: { watchHistory: { video: { $in: videoIds } } } }
      ),
      Comment.deleteMany({ video: { $in: videoIds } }),
      Like.deleteMany({ video: { $in: videoIds } }),
      DisLike.deleteMany({ video: { $in: videoIds } }),
    ];

    await Promise.allSettled(cleanupOps).then((results) => {
      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          console.log(`✅ Cleanup successful for operation ${index + 1}`);
        } else {
          console.error(
            `❌ Cleanup failed for operation ${index + 1}:`,
            result.reason
          );
        }
      });
    });
    console.log(
      `✅ References cleaned for deleted videos: ${videoIds.join(", ")}`
    );
  } catch (err) {
    console.error("Error cleaning up references:", err);
  }
}

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

export { addToWatchHistory, cleanUpReferences, addViewIfNotExists };
