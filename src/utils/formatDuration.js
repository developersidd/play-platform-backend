function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const hoursStr = hours > 0 ? `${hours}h ` : "";
  const minutesStr = minutes > 0 ? `${minutes}m ` : "";
  const secondsStr = `${secs}s`;

  return `${hoursStr}${minutesStr}${secondsStr}`.trim();
}

// Example usage:
const durationInSeconds = 3800; // Example duration
console.log(formatDuration(durationInSeconds)); // Output: "1h 1m 5s"
export default formatDuration;
