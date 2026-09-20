import { Request, Response } from "express";
import { sendChatMessage } from "../services/chat.service";
import {
  conversationBelongsTo,
  deleteConversationService,
  getConversationService,
  getConversationsService,
  getRecentContext,
  makeConversationTitle,
  saveExchange,
  CONTEXT_LIMIT,
} from "../services/chatHistory.service";
import { apiErrors } from "../utils/apiErrors";
import { parseId } from "../utils/parseId";
import { userIdOf } from "../utils/request";

export const sendChatController = async (req: Request, res: Response) => {
  const userId = userIdOf(req);
  const { message, history, conversationId, newConversation, timeZone } = req.body as {
    message: string;
    history?: { role: "user" | "assistant"; content: string }[];
    conversationId?: number;
    newConversation?: boolean;
    timeZone?: string;
  };

  let context = (history ?? []).slice(-CONTEXT_LIMIT);

  if (conversationId) {
    if (!(await conversationBelongsTo(userId, conversationId))) {
      throw apiErrors.notFound("Conversation not found");
    }
    // контекст берём из БД, а не от клиента
    context = await getRecentContext(conversationId);
  }

  const reply = await sendChatMessage(userId, context, message, timeZone);

  let saved: { id: number; title: string } | undefined;

  if (conversationId || newConversation) {
    saved = await saveExchange(
      userId,
      {
        ...(conversationId ? { conversationId } : {}),
        title: makeConversationTitle(message),
      },
      message,
      reply,
    );
  }

  res.status(200).json({
    message: "Chat reply",
    data: {
      reply: reply.text,
      isError: reply.isError,
      conversationId: saved?.id,
      title: saved?.title,
    },
  });
};

export const getConversationsController = async (req: Request, res: Response) => {
  const data = await getConversationsService(userIdOf(req));

  res.status(200).json({ message: "Conversations", data });
};

export const getConversationController = async (req: Request<{ id: string }>, res: Response) => {
  const data = await getConversationService(userIdOf(req), parseId(req.params.id));
  if (!data) throw apiErrors.notFound("Conversation not found");

  res.status(200).json({ message: "Conversation", data });
};

export const deleteConversationController = async (req: Request<{ id: string }>, res: Response) => {
  const deleted = await deleteConversationService(userIdOf(req), parseId(req.params.id));
  if (!deleted) throw apiErrors.notFound("Conversation not found");

  res.status(200).json({ message: "Conversation deleted" });
};
