import jwt from "jsonwebtoken";
import { pool } from "../plugins/pg";
import { IPayload } from "../types/types";
import { apiErrors } from "../utils/apiErrors";
import {
  generateTokens,
  hashToken,
  REFRESH_TTL_MS,
  refresh_secret,
} from "../utils/generateTokens";

// старый refresh-токен ещё столько секунд принимается после ротации:
// две вкладки, обновляющиеся одновременно, больше не разлогинивают друг друга
const ROTATION_GRACE_MS = 30_000;

interface ISessionUser {
  id: number;
  email: string;
  name: string;
  google_id?: string | null;
}

const toPayload = (user: ISessionUser): IPayload => ({
  id: user.id,
  email: user.email,
  name: user.name,
  ...(user.google_id ? { google_id: user.google_id } : {}),
});

const storeSession = async (userId: number, refreshToken: string) => {
  await pool.query(
    `
      insert into auth_sessions (user_id, token_hash, expires_at)
      values ($1, $2, now() + ($3 || ' milliseconds')::interval)
    `,
    [userId, hashToken(refreshToken), String(REFRESH_TTL_MS)],
  );
};

// новая сессия (вход, регистрация, Google-вход): каждое устройство независимо
export const startSession = async (user: ISessionUser) => {
  const tokens = generateTokens(toPayload(user));
  await storeSession(user.id, tokens.refreshToken);

  // заодно чистим протухшие сессии
  pool.query(`delete from auth_sessions where expires_at < now()`).catch(() => {});

  return tokens;
};

export const rotateSession = async (refreshToken: string | undefined) => {
  if (!refreshToken) throw apiErrors.unauthorized("Unauthorized");

  try {
    jwt.verify(refreshToken, refresh_secret);
  } catch {
    throw apiErrors.unauthorized("Invalid or expired refresh token");
  }

  const session = await pool.query(
    `
      select id, user_id, rotated_at
      from auth_sessions
      where token_hash = $1 and expires_at > now()
    `,
    [hashToken(refreshToken)],
  );

  const row = session.rows[0];
  if (!row) throw apiErrors.unauthorized("Unauthorized");

  if (row.rotated_at && Date.now() - new Date(row.rotated_at).getTime() > ROTATION_GRACE_MS) {
    throw apiErrors.unauthorized("Unauthorized");
  }

  const userResult = await pool.query(
    `select id, name, email, google_id from users where id = $1`,
    [row.user_id],
  );
  const user = userResult.rows[0];
  if (!user) throw apiErrors.unauthorized("Unauthorized");

  const tokens = generateTokens(toPayload(user));
  await storeSession(user.id, tokens.refreshToken);

  await pool.query(
    `update auth_sessions set rotated_at = coalesce(rotated_at, now()) where id = $1`,
    [row.id],
  );
  await pool.query(
    `delete from auth_sessions where user_id = $1 and rotated_at < now() - interval '1 minute'`,
    [user.id],
  );

  return tokens;
};

export const endSession = async (refreshToken: string | undefined) => {
  if (!refreshToken) return;
  await pool.query(`delete from auth_sessions where token_hash = $1`, [
    hashToken(refreshToken),
  ]);
};

export const endAllSessions = async (userId: number) => {
  await pool.query(`delete from auth_sessions where user_id = $1`, [userId]);
};
