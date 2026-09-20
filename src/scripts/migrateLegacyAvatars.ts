import "dotenv/config";
import fs from "fs";
import path from "path";
import { pool } from "../plugins/pg";
import { checkCloudinaryConfig, getMissingCloudinaryVars } from "../config/cloudinary";
import { uploadImageBuffer } from "../services/imageStorage.service";
import { isRealImage } from "../utils/imageSignature";
import { LEGACY_UPLOADS_DIR } from "../utils/legacyUploads";

// npm run migrate:avatars [-- --dry-run] [-- --clear-missing]
//
// Переносит аватарки, сохранённые старым способом ("/uploads/<файл>" в users.avatar,
// файл в src/uploads), в Cloudinary и переписывает адрес в БД на https-ссылку.
//  --dry-run        только показать, что будет сделано
//  --clear-missing  если файла на диске уже нет — очистить avatar (иначе на фронте битая картинка)
// Скрипт идемпотентен: уже перенесённые записи (https://…) не трогает; локальные файлы не удаляет.

const dryRun = process.argv.includes("--dry-run");
const clearMissing = process.argv.includes("--clear-missing");

const run = async () => {
  if (!dryRun) {
    const missing = getMissingCloudinaryVars();
    if (missing.length) {
      console.error(`Cannot upload: missing environment variable(s): ${missing.join(", ")}`);
      process.exit(1);
    }
    checkCloudinaryConfig();
  }

  const rows = (
    await pool.query(`select id, avatar from users where avatar like '/uploads/%' order by id`)
  ).rows as { id: number; avatar: string }[];

  console.log(`Found ${rows.length} user(s) with a legacy /uploads avatar${dryRun ? " (dry run)" : ""}.`);

  const stats = { migrated: 0, missing: 0, invalid: 0, failed: 0 };

  for (const row of rows) {
    const fileName = path.basename(row.avatar);
    const filePath = path.join(LEGACY_UPLOADS_DIR, fileName);

    if (!fs.existsSync(filePath)) {
      stats.missing++;
      console.warn(`  user ${row.id}: file ${fileName} not found on disk${clearMissing ? " -> avatar cleared" : ""}`);
      if (clearMissing && !dryRun) {
        await pool.query(`update users set avatar = '' where id = $1 and avatar = $2`, [row.id, row.avatar]);
      }
      continue;
    }

    const buffer = fs.readFileSync(filePath);
    if (!isRealImage(buffer)) {
      stats.invalid++;
      console.warn(`  user ${row.id}: ${fileName} is not a valid image, skipped`);
      continue;
    }

    if (dryRun) {
      console.log(`  user ${row.id}: ${fileName} would be uploaded`);
      continue;
    }

    try {
      // каждому пользователю — свой ресурс в Cloudinary, даже если файл на диске один:
      // иначе замена аватарки у одного удалила бы картинку у другого
      const { url } = await uploadImageBuffer(buffer);

      await pool.query(`update users set avatar = $1 where id = $2 and avatar = $3`, [url, row.id, row.avatar]);
      stats.migrated++;
      console.log(`  user ${row.id}: ${fileName} -> ${url}`);
    } catch (error) {
      stats.failed++;
      console.error(`  user ${row.id}: failed (${(error as Error).message})`);
    }
  }

  console.log(
    `Done. migrated: ${stats.migrated}, missing files: ${stats.missing}, invalid: ${stats.invalid}, failed: ${stats.failed}.`,
  );
  await pool.end();
  if (stats.failed > 0) process.exit(1);
};

run().catch(async (error) => {
  console.error("Avatar migration failed:", error);
  await pool.end().catch(() => {});
  process.exit(1);
});
