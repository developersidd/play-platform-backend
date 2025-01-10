import User from "../models/user.model.js";

const addToWatchHistory = async (userId, videoId) => {
  try {
    // Find the user by ID
    const user = await User.findById(userId);
    if (user?.isHistoryPaused) return;

    // check if video already exists in watchHistory array
    const videoExists = await User.exists({
      _id: userId,
      "watchHistory.videoId": videoId,
    });

    // if video exists, remove it from the watchHistory array
    if (videoExists) {
      await User.updateOne(
        { _id: userId },
        { $pull: { watchHistory: { videoId } } }
      );
    }

    //  change the position of the video to the front in watchHistory array with mongoose
    await User.updateOne(
      { _id: userId },
      {
        $push: {
          watchHistory: {
            $each: [{ videoId, createdAt: new Date() }], // Add the new entry at the start
            $position: 0,
          },
        },
      },
      {
        upsert: true,
      }
    );

    // Optionally: Limit the size of the watch history (e.g., to 50 items)
    if (user.watchHistory.length > 50) {
      user.watchHistory.pop(); // Remove the oldest video if the limit is exceeded
    }

    // Save the updated user document
    await user.save();
    console.log("Adding to watch history");

    return { success: true, message: "Video added to watch history." };
  } catch (error) {
    console.error("Error adding to watch history:", error);
    return { success: false, message: "Failed to update watch history." };
  }
};

export { addToWatchHistory };
