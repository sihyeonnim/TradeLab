import multer from "multer";
import path from "path";
import fs from "fs";

const uploadRoot = path.join(__dirname, "..", "..", "uploads");
const videoUploadDir = path.join(uploadRoot, "videos");

if (!fs.existsSync(videoUploadDir)) {
  fs.mkdirSync(videoUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, videoUploadDir);
  },
  filename: (req, file, cb) => {
    const safeOriginalName = file.originalname
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9.\-_]/g, "");

    const filename = `lesson-${Date.now()}-${safeOriginalName}`;
    cb(null, filename);
  },
});

function videoFileFilter(
  req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) {
  const allowedExtensions = [".mp4", ".webm", ".mov"];
  const extension = path.extname(file.originalname).toLowerCase();

  if (!allowedExtensions.includes(extension)) {
    cb(new Error("Only .mp4, .webm, and .mov video files are allowed."));
    return;
  }

  cb(null, true);
}

export const videoUpload = multer({
  storage,
  fileFilter: videoFileFilter,
  limits: {
    fileSize: 200 * 1024 * 1024,
  },
});

export function toPublicVideoPath(file?: Express.Multer.File): string | null {
  if (!file) {
    return null;
  }

  return `/uploads/videos/${file.filename}`;
}