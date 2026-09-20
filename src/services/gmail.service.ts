import { google } from "googleapis";
import { apiErrors } from "../utils/apiErrors";
import { parseRecipients } from "../utils/email";
import { withGoogle } from "./google.service";

export type GmailFolder = "inbox" | "starred" | "sent" | "trash";
export type GmailAction =
  | "read"
  | "unread"
  | "star"
  | "unstar"
  | "archive"
  | "unarchive"
  | "trash"
  | "untrash";

const FOLDER_LABEL: Record<GmailFolder, string> = {
  inbox: "INBOX",
  starred: "STARRED",
  sent: "SENT",
  trash: "TRASH",
};

const PAGE_SIZE = 25;
const LIST_HEADERS = ["From", "To", "Subject", "Date"];
const MESSAGE_FIELDS = "id,threadId,labelIds,snippet,internalDate,payload/headers";

export const listGmailMessages = (
  userId: number,
  options: { folder?: GmailFolder | undefined; q?: string | undefined; pageToken?: string | undefined } = {},
) =>
  withGoogle(userId, async (auth) => {
    const gmail = google.gmail({ version: "v1", auth });
    const folder = options.folder ?? "inbox";

    // раньше "Inbox" был вообще всей почтой: фильтра по папке не было
    const list = await gmail.users.messages.list({
      userId: "me",
      maxResults: PAGE_SIZE,
      labelIds: [FOLDER_LABEL[folder]],
      includeSpamTrash: folder === "trash",
      ...(options.q ? { q: options.q } : {}),
      ...(options.pageToken ? { pageToken: options.pageToken } : {}),
    });

    const details = await Promise.all(
      (list.data.messages ?? []).map((message) =>
        gmail.users.messages
          .get({
            userId: "me",
            id: message.id!,
            format: "metadata",
            metadataHeaders: LIST_HEADERS,
            fields: MESSAGE_FIELDS,
          })
          .then((result) => result.data)
          // письмо могли удалить между list и get — не роняем весь список
          .catch(() => null),
      ),
    );

    return {
      messages: details.filter((message) => message !== null),
      nextPageToken: list.data.nextPageToken ?? null,
    };
  });

export const modifyGmailMessage = (userId: number, messageId: string, action: GmailAction) =>
  withGoogle(userId, async (auth) => {
    const gmail = google.gmail({ version: "v1", auth });

    if (action === "trash") {
      await gmail.users.messages.trash({ userId: "me", id: messageId });
    } else if (action === "untrash") {
      await gmail.users.messages.untrash({ userId: "me", id: messageId });
    } else {
      const labels: Record<string, { add?: string[]; remove?: string[] }> = {
        read: { remove: ["UNREAD"] },
        unread: { add: ["UNREAD"] },
        star: { add: ["STARRED"] },
        unstar: { remove: ["STARRED"] },
        archive: { remove: ["INBOX"] },
        unarchive: { add: ["INBOX"] },
      };
      const change = labels[action]!;

      await gmail.users.messages.modify({
        userId: "me",
        id: messageId,
        requestBody: {
          ...(change.add ? { addLabelIds: change.add } : {}),
          ...(change.remove ? { removeLabelIds: change.remove } : {}),
        },
      });
    }

    return { id: messageId, action };
  });

// ── чтение письма ───────────────────────────────────────────────────────────

const ENTITIES: Record<string, string> = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", copy: "©", reg: "®",
  trade: "™", hellip: "…", mdash: "—", ndash: "–", laquo: "«", raquo: "»",
  rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", bull: "•", middot: "·",
  euro: "€", pound: "£", yen: "¥", cent: "¢", deg: "°", times: "×", rarr: "→", larr: "←",
};

const decodeEntities = (text: string) =>
  text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const code = entity[1]?.toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      try {
        return String.fromCodePoint(code);
      } catch {
        return match;
      }
    }
    return ENTITIES[entity.toLowerCase()] ?? match;
  });

const stripHtml = (html: string) =>
  decodeEntities(
    html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      // сохраняем ссылку рядом с текстом
      .replace(
        /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
        (_match, href: string, inner: string) => {
          const label = inner.replace(/<[^>]+>/g, "").trim();
          return !label || label === href ? href : `${label} (${href})`;
        },
      )
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\n{3,}/g, "\n\n")
    .trim();

// рекурсивный поиск части письма нужного типа
const findPart = (part: any, mimeType: string): any => {
  if (!part) return null;
  if (part.mimeType === mimeType && part.body?.data) return part;

  for (const child of part.parts ?? []) {
    const found = findPart(child, mimeType);
    if (found) return found;
  }

  return null;
};

// письма в windows-1251 / koi8-r раньше превращались в кракозябры (везде был utf-8)
const decodePart = (part: any) => {
  const buffer = Buffer.from(part.body.data, "base64url");
  const contentType: string =
    part.headers?.find((h: any) => h.name?.toLowerCase() === "content-type")?.value ?? "";
  const charset = contentType.match(/charset="?([\w-]+)"?/i)?.[1] ?? "utf-8";

  try {
    return new TextDecoder(charset).decode(buffer);
  } catch {
    return buffer.toString("utf8");
  }
};

const KEPT_HEADERS = new Set(["from", "to", "cc", "subject", "date"]);

export const getGmailMessage = (userId: number, messageId: string) =>
  withGoogle(userId, async (auth) => {
    const gmail = google.gmail({ version: "v1", auth });

    const result = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full",
    });

    const payload = result.data.payload;
    const plainPart = findPart(payload, "text/plain");
    const htmlPart = plainPart ? null : findPart(payload, "text/html");

    let body = result.data.snippet || "";
    if (plainPart) body = decodePart(plainPart).trim();
    else if (htmlPart) body = stripHtml(decodePart(htmlPart));

    // отдаём только нужное: раньше уходило всё дерево частей вместе с base64-телом
    return {
      id: result.data.id,
      threadId: result.data.threadId,
      labelIds: result.data.labelIds ?? [],
      snippet: result.data.snippet ?? "",
      internalDate: result.data.internalDate ?? null,
      payload: {
        headers: (payload?.headers ?? []).filter((h) => KEPT_HEADERS.has((h.name ?? "").toLowerCase())),
      },
      body,
    };
  });

// ── отправка ────────────────────────────────────────────────────────────────

const cleanHeader = (value: string) => value.replace(/[\r\n]+/g, " ").trim();

// RFC 2047: слова длиннее 75 символов нужно разбивать
const encodeSubject = (subject: string) => {
  const clean = cleanHeader(subject);
  if (/^[\x20-\x7E]*$/.test(clean)) return clean;

  const words: string[] = [];
  let chunk = "";

  for (const char of Array.from(clean)) {
    if (Buffer.byteLength(chunk + char, "utf8") > 42) {
      words.push(chunk);
      chunk = "";
    }
    chunk += char;
  }
  if (chunk) words.push(chunk);

  return words
    .map((word) => `=?UTF-8?B?${Buffer.from(word, "utf8").toString("base64")}?=`)
    .join("\r\n ");
};

export const sendGmailMessage = (
  userId: number,
  { to, subject, body }: { to: string; subject: string; body: string },
) => {
  const recipients = parseRecipients(to);
  if (!recipients) throw apiErrors.badRequest("Enter a valid recipient email address");

  return withGoogle(userId, async (auth) => {
    const gmail = google.gmail({ version: "v1", auth });

    const rawMessage = [
      `To: ${recipients.join(", ")}`,
      `Subject: ${encodeSubject(subject)}`,
      "MIME-Version: 1.0",
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      (Buffer.from(body, "utf8").toString("base64").match(/.{1,76}/g) ?? []).join("\r\n"),
    ].join("\r\n");

    const result = await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw: Buffer.from(rawMessage, "utf8").toString("base64url") },
    });

    return result.data;
  });
};
