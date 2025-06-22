import Comment from "../models/comment.model.js";
import DisLike from "../models/dislike.model.js";
import Like from "../models/like.model.js";
import Playlist from "../models/playlist.model.js";
import User from "../models/user.model.js";
import WatchLater from "../models/watchLater.model.js";

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

export { addToWatchHistory, cleanUpReferences };
