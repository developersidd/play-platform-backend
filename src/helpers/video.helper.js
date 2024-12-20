const addToWatchHistory = async (userId, videoId) => {
  try {
    // Find the user by ID
    const user = await User.findById(userId);

    // Check if the video already exists in the user's watch history
    const videoIndex = user.watchHistory.findIndex((item) =>
      item?.videoId.equals(videoId)
    );

    if (videoIndex !== -1) {
      // If the video already exists, remove it from its current position
      user.watchHistory.splice(videoIndex, 1);
    }

    // Add the video to the front of the watch history
    user.watchHistory.unshift({
      videoId,
      createdAt: new Date(),
    });

    // Optionally: Limit the size of the watch history (e.g., to 50 items)
    if (user.watchHistory.length > 50) {
      user.watchHistory.pop(); // Remove the oldest video if the limit is exceeded
    }

    // Save the updated user document
    await user.save();

    return { success: true, message: "Video added to watch history." };
  } catch (error) {
    console.error("Error adding to watch history:", error);
    return { success: false, message: "Failed to update watch history." };
  }
};

export { addToWatchHistory };
