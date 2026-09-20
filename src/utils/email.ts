import z from "zod";

const emailSchema = z.email();

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

// "a@x.com, b@y.com" -> ["a@x.com", "b@y.com"]; null, если хоть один адрес неверен
export const parseRecipients = (input: string): string[] | null => {
  const list = input
    .split(/[,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (list.length === 0 || list.length > 20) return null;
  // переводы строк в адресе = инъекция заголовков (Bcc: и т.п.)
  if (list.some((item) => /[\r\n]/.test(item) || !emailSchema.safeParse(item).success)) {
    return null;
  }

  return list;
};
