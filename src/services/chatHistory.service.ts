import { pool } from "../plugins/pg";

export interface IStoredMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  isError: boolean;
}

const TITLE_MAX = 60;
// в модель уходит не вся переписка, а последние сообщения: иначе запрос дорожает бесконечно
export const CONTEXT_LIMIT = 30;

// заголовок диалога — начало первого сообщения
export const makeConversationTitle = (message: string) => {
  const oneLine = message.replace(/\s+/g, " ").trim();
  return oneLine.length > TITLE_MAX
    ? `${oneLine.slice(0, TITLE_MAX - 1).trimEnd()}…`
    : oneLine;
};

export const getConversationsService = async (userId: number) => {
  const result = await pool.query(
    `
      select id, title, updated_at
      from chat_conversations
      where user_id = $1
      order by updated_at desc, id desc
      limit 50
    `,
    [userId],
  );

  return result.rows;
};

export interface IConversationWithMessages {
  id: number;
  title: string;
  updated_at: string;
  messages: IStoredMessage[];
}

// null, если диалога нет или он чужой
export const getConversationService = async (
  userId: number,
  conversationId: number,
): Promise<IConversationWithMessages | null> => {
  const conversation = await pool.query(
    `select id, title, updated_at from chat_conversations where id = $1 and user_id = $2`,
    [conversationId, userId],
  );

  if (!conversation.rows[0]) return null;

  const messages = await pool.query(
    `
      select id, role, content, is_error as "isError"
      from chat_messages
      where conversation_id = $1
      order by id asc
    `,
    [conversationId],
  );

  return { ...conversation.rows[0], messages: messages.rows };
};

export const conversationBelongsTo = async (userId: number, conversationId: number) => {
  const result = await pool.query(
    `select 1 from chat_conversations where id = $1 and user_id = $2`,
    [conversationId, userId],
  );

  return Boolean(result.rows[0]);
};

// контекст для модели: последние сообщения без ответов-ошибок
// ("модель перегружена" не должна попадать в переписку как реплика ИИ)
export const getRecentContext = async (conversationId: number) => {
  const result = await pool.query(
    `
      select role, content from (
        select id, role, content
        from chat_messages
        where conversation_id = $1 and is_error = false
        order by id desc
        limit $2
      ) recent
      order by id asc
    `,
    [conversationId, CONTEXT_LIMIT],
  );

  return result.rows as { role: "user" | "assistant"; content: string }[];
};

// Пара "вопрос-ответ" сохраняется одной транзакцией и только после ответа модели:
// если запрос упал, в истории не остаётся ни пустых диалогов, ни дублей при повторе.
export const saveExchange = async (
  userId: number,
  target: { conversationId?: number; title?: string },
  userMessage: string,
  reply: { text: string; isError: boolean },
) => {
  const client = await pool.connect();

  try {
    await client.query("begin");

    let conversation: { id: number; title: string };

    if (target.conversationId) {
      const existing = await client.query(
        `select id, title from chat_conversations where id = $1 and user_id = $2`,
        [target.conversationId, userId],
      );
      conversation = existing.rows[0];
    } else {
      const created = await client.query(
        `insert into chat_conversations (user_id, title) values ($1, $2) returning id, title`,
        [userId, target.title ?? "New chat"],
      );
      conversation = created.rows[0];
    }

    await client.query(
      `
        insert into chat_messages (conversation_id, role, content, is_error)
        values ($1, 'user', $2, false), ($1, 'assistant', $3, $4)
      `,
      [conversation.id, userMessage, reply.text, reply.isError],
    );
    await client.query(`update chat_conversations set updated_at = now() where id = $1`, [
      conversation.id,
    ]);

    await client.query("commit");
    return conversation;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
};

export const deleteConversationService = async (
  userId: number,
  conversationId: number,
) => {
  const result = await pool.query(
    `delete from chat_conversations where id = $1 and user_id = $2`,
    [conversationId, userId],
  );

  return (result.rowCount ?? 0) > 0;
};
