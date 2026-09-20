import fs from "fs";
import path from "path";

// УСТАРЕЛО. Раньше аватарки хранились на диске в src/uploads и в БД лежали пути "/uploads/<файл>".
// Новые файлы сюда больше не пишутся — они уходят в Cloudinary. Папка нужна только для
// чтения старых файлов и для скрипта `npm run migrate:avatars`, который переносит их в Cloudinary.
// На Render этой папки нет (она в .gitignore), поэтому там всё это неактивно.
export const LEGACY_UPLOADS_DIR = path.resolve(process.cwd(), "src/uploads");

export const legacyUploadsAvailable = () => fs.existsSync(LEGACY_UPLOADS_DIR);
