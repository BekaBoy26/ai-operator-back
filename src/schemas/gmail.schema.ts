import z from "zod";
import { parseRecipients } from "../utils/email";

export const sendGmailSchema = z.object({
  to: z
    .string()
    .refine((value) => parseRecipients(value) !== null, "Enter a valid recipient email address"),
  subject: z
    .string()
    .min(1, "Subject is required")
    .max(300, "Subject is too long")
    .refine((value) => !/[\r\n]/.test(value), "Subject must be a single line"),
  body: z.string().min(1, "Message can't be empty").max(100_000, "Message is too long"),
});

export const gmailListQuerySchema = z.object({
  folder: z.enum(["inbox", "starred", "sent", "trash"]).optional(),
  q: z.string().trim().max(200).optional(),
  pageToken: z.string().max(500).optional(),
});

export const gmailModifySchema = z.object({
  action: z.enum(["read", "unread", "star", "unstar", "archive", "unarchive", "trash", "untrash"]),
});
