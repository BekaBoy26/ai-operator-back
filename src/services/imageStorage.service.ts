import crypto from "crypto";
import { UploadApiResponse } from "cloudinary";
import { getCloudinary, getCloudName, getImageFolder } from "../config/cloudinary";
import { apiErrors, CustomApiError } from "../utils/apiErrors";

// то, что нужно от загруженного файла (multer.File ему соответствует) — без зависимости от глобальных типов multer
export interface IUploadedFile {
  buffer: Buffer;
}

export interface IStoredImage {
  // https-адрес, который сохраняется в БД и который браузер открывает напрямую
  url: string;
  publicId: string;
}

// аватарка никогда не нужна больше 1024px — Cloudinary уменьшает при загрузке (не увеличивает)
const MAX_SIDE = 1024;
const REQUEST_TIMEOUT_MS = 30_000;

const describeError = (error: unknown) =>
  error instanceof Error
    ? error.message
    : (error as { message?: string } | undefined)?.message ?? String(error);

// Загрузка буфера в Cloudinary. Вызывать только ПОСЛЕ проверки типа и содержимого файла.
export const uploadImageBuffer = async (buffer: Buffer): Promise<IStoredImage> => {
  const cloudinary = getCloudinary();

  try {
    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: getImageFolder(),
          // уникальный public_id: разные файлы никогда не конфликтуют и не перезаписываются
          public_id: crypto.randomUUID(),
          resource_type: "image",
          overwrite: false,
          unique_filename: false,
          allowed_formats: ["png", "jpg", "jpeg", "webp", "gif"],
          transformation: [{ width: MAX_SIDE, height: MAX_SIDE, crop: "limit" }],
          timeout: REQUEST_TIMEOUT_MS,
        },
        (error, response) => {
          if (error || !response) return reject(error ?? new Error("Empty response from Cloudinary"));
          resolve(response);
        },
      );

      stream.end(buffer);
    });

    return { url: result.secure_url, publicId: result.public_id };
  } catch (error) {
    if (error instanceof CustomApiError) throw error;

    console.error("[storage] Cloudinary upload failed:", describeError(error));
    throw apiErrors.badGateway("Could not store the image. Please try again in a moment.");
  }
};

export const uploadAvatar = (file: IUploadedFile) => uploadImageBuffer(file.buffer);

// "https://res.cloudinary.com/<cloud>/image/upload/[transformations/]v123/<folder>/<id>.jpg"
// -> "<folder>/<id>". Возвращает null для чужих адресов (Google-аватар, старые /uploads/…).
export const publicIdFromUrl = (url?: string | null) => {
  const cloudName = getCloudName();
  if (!url || !cloudName) return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null; // относительный путь /uploads/… — не Cloudinary
  }

  if (parsed.hostname !== "res.cloudinary.com") return null;

  const parts = parsed.pathname.split("/").filter(Boolean);
  if (parts[0] !== cloudName || parts[1] !== "image" || parts[2] !== "upload") return null;

  let rest = parts.slice(3);
  // всё до "v<версия>" — трансформации
  const versionIndex = rest.findIndex((part) => /^v\d+$/.test(part));
  if (versionIndex >= 0) rest = rest.slice(versionIndex + 1);

  const publicId = decodeURIComponent(rest.join("/")).replace(/\.[A-Za-z0-9]+$/, "");

  // удаляем только то, что загружено нашим приложением
  return publicId.startsWith(`${getImageFolder()}/`) ? publicId : null;
};

// Удаление ресурса из Cloudinary. Не бросает: неудачная чистка не должна ломать запрос пользователя.
// Для Google-аватарок и старых /uploads/… ничего не делает.
export const deleteStoredImage = async (url?: string | null) => {
  const publicId = publicIdFromUrl(url);
  if (!publicId) return;

  try {
    await getCloudinary().uploader.destroy(publicId, { resource_type: "image", invalidate: true });
  } catch (error) {
    console.error(`[storage] failed to delete "${publicId}" from Cloudinary:`, describeError(error));
  }
};
