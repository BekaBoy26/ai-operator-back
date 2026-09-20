import { v2 as cloudinary } from "cloudinary";
import { CustomApiError } from "../utils/apiErrors";

// Cloudinary настраивается только из переменных окружения (в Render они заданы в Environment)
const REQUIRED_VARS = [
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
] as const;

export const getMissingCloudinaryVars = () =>
  REQUIRED_VARS.filter((name) => !process.env[name]?.trim());

export const getCloudName = () => process.env.CLOUDINARY_CLOUD_NAME?.trim() || "";

// папка внутри Cloudinary: можно развести prod и staging через CLOUDINARY_FOLDER
export const getImageFolder = () =>
  (process.env.CLOUDINARY_FOLDER?.trim() || "opero/avatars").replace(/^\/+|\/+$/g, "");

let configured = false;
let reportedMissing = false;

// Возвращает готовый SDK или бросает понятную ошибку 503.
// Регистрация без аватарки и всё остальное продолжают работать даже без Cloudinary.
export const getCloudinary = () => {
  const missing = getMissingCloudinaryVars();

  if (missing.length > 0) {
    if (!reportedMissing) {
      reportedMissing = true;
      console.error(
        `[storage] Cloudinary is not configured. Missing environment variable(s): ${missing.join(", ")}. ` +
          "Avatar uploads will fail until they are set.",
      );
    }

    throw new CustomApiError(
      503,
      "Image storage is not configured on the server",
      "storage_not_configured",
    );
  }

  if (!configured) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME!.trim(),
      api_key: process.env.CLOUDINARY_API_KEY!.trim(),
      api_secret: process.env.CLOUDINARY_API_SECRET!.trim(),
      secure: true,
    });
    configured = true;
  }

  return cloudinary;
};

// проверка при старте: видно в логах Render сразу после деплоя
export const checkCloudinaryConfig = () => {
  const missing = getMissingCloudinaryVars();

  if (missing.length > 0) {
    console.error(
      `[storage] Cloudinary is NOT configured. Missing: ${missing.join(", ")}. ` +
        "Set them in the environment (Render → Environment). Avatar uploads are disabled until then.",
    );
    reportedMissing = true;
    return;
  }

  console.log(`[storage] Cloudinary ready (cloud "${getCloudName()}", folder "${getImageFolder()}")`);
};
