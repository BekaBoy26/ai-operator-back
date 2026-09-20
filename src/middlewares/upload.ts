import multer, { memoryStorage } from "multer";
import { NextFunction, Request, Response } from "express";
import { apiErrors } from "../utils/apiErrors";
import { isRealImage } from "../utils/imageSignature";

const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

// Файл живёт только в памяти запроса (не более 5 МБ) и нигде на диске не сохраняется:
// на Render локальный диск временный. В Cloudinary он попадает позже, уже после проверок.
export const uploadMiddleware = multer({
  storage: memoryStorage(),
  limits: { fileSize: 1024 * 1024 * 5, files: 1 },
  // svg и html не пускаем: со своего origin они выполняли бы скрипты
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) return cb(null, true);
    cb(apiErrors.badRequest("Only PNG, JPEG, WebP or GIF images are allowed"));
  },
});

// проверяем реальное содержимое файла (сигнатуру), а не заявленный клиентом тип
export const verifyUploadedImage = (req: Request, _res: Response, next: NextFunction) => {
  if (req.file && !isRealImage(req.file.buffer)) {
    return next(apiErrors.badRequest("The uploaded file is not a valid image"));
  }

  next();
};
