import z from "zod";

export const chatSchema = z.object({
  message: z.string().trim().min(1, "Message can't be empty").max(4000, "Message is too long"),
  // история для быстрого чата без сохранения: ограничена, иначе растёт стоимость запроса
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(8000),
      }),
    )
    .max(40)
    .optional(),
  conversationId: z.number().int().positive().optional(),
  newConversation: z.boolean().optional(),
  // часовой пояс браузера: модель считает "завтра в 10:00" в поясе пользователя
  timeZone: z.string().max(64).optional(),
});
