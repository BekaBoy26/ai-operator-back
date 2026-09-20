// Не верим mimetype от клиента: проверяем первые байты самого файла (буфер из памяти).
const SIGNATURES: ((b: Buffer) => boolean)[] = [
  // PNG
  (b) => b.length >= 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  // JPEG
  (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  // GIF
  (b) => b.length >= 4 && b.subarray(0, 4).toString("ascii") === "GIF8",
  // WebP
  (b) =>
    b.length >= 12 &&
    b.subarray(0, 4).toString("ascii") === "RIFF" &&
    b.subarray(8, 12).toString("ascii") === "WEBP",
];

export const isRealImage = (buffer: Buffer) => SIGNATURES.some((test) => test(buffer));
