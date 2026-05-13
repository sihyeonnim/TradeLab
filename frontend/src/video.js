export function buildVideoSrc(path) {
  if (!path || path === "NO_VIDEO") {
    return null;
  }

  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  return `${import.meta.env.VITE_API_URL}${path}`;
}

export function canPlayLocalVideo(lesson) {
  return (
    lesson?.video?.provider === "LOCAL" &&
    lesson?.video?.path?.startsWith("/uploads/videos/")
  );
}