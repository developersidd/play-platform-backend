import User from "../models/user.model.js";

const addToWatchHistory = async (userId, videoId) => {
  try {
    const user = await User.findById(userId);
    if (!user || user.isHistoryPaused) return;

    // Remove existing entry (if any)
    user.watchHistory = user.watchHistory.filter(
      (entry) => entry.videoId.toString() !== videoId.toString()
    );

    // Add new entry to start
    user.watchHistory.unshift({ videoId, createdAt: new Date() });

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

export { addToWatchHistory };
