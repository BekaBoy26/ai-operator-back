import crypto from "crypto";
import fs from "fs";
import multer, { diskStorage } from "multer";
import { NextFunction, Request, Response } from "express";
import { apiErrors } from "../utils/apiErrors";
import { isRealImage, removeUpload, UPLOADS_DIR } from "../utils/files";

const EXTENSIONS: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

// папка нужна на чистом клоне: multer сам её не создаёт
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = diskStorage({
  destination: (_, __, cb) => cb(null, UPLOADS_DIR),
  filename: (_, file, cb) => {
    cb(null, `${crypto.randomUUID()}${EXTENSIONS[file.mimetype] ?? ""}`);
  },
});

export const uploadMiddleware = multer({
  storage,
  limits: { fileSize: 1024 * 1024 * 5, files: 1 },
  // svg и html не пускаем: со своего origin они выполняли бы скрипты
  fileFilter: (_req, file, cb) => {
    if (EXTENSIONS[file.mimetype]) return cb(null, true);
    cb(apiErrors.badRequest("Only PNG, JPEG, WebP or GIF images are allowed"));
  },
});

// проверяем реальное содержимое загруженного файла
export const verifyUploadedImage = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  try {
    if (req.file && !(await isRealImage(req.file.path))) {
      removeUpload(`/uploads/${req.file.filename}`);
      throw apiErrors.badRequest("The uploaded file is not a valid image");
    }
    next();
  } catch (error) {
    next(error);
  }
};
