import fs from "fs";
import path from "path";

export const UPLOADS_DIR = path.resolve(process.cwd(), "src/uploads");

export const removeUpload = (publicPath?: string | null) => {
  // удаляем только файлы внутри нашей папки загрузок
  if (!publicPath || !publicPath.startsWith("/uploads/")) return;

  const file = path.resolve(UPLOADS_DIR, path.basename(publicPath));
  fs.promises.unlink(file).catch(() => {});
};

// сигнатуры файлов: не верим mimetype от клиента
const SIGNATURES: ((b: Buffer) => boolean)[] = [
  (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  (b) => b.subarray(0, 4).toString("ascii") === "GIF8",
  (b) =>
    b.subarray(0, 4).toString("ascii") === "RIFF" &&
    b.subarray(8, 12).toString("ascii") === "WEBP",
];

export const isRealImage = async (filePath: string) => {
  const handle = await fs.promises.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(12);
    await handle.read(buffer, 0, 12, 0);
    return SIGNATURES.some((test) => test(buffer));
  } finally {
    await handle.close();
  }
};
