import bcrypt from "bcryptjs";
import crypto from "crypto";
import { pool } from "../plugins/pg";
import { apiErrors } from "../utils/apiErrors";
import { normalizeEmail } from "../utils/email";
import { removeUpload } from "../utils/files";
import { hashToken } from "../utils/generateTokens";
import { sendMail } from "../utils/mailer";
import { endAllSessions, endSession, rotateSession, startSession } from "./session.service";

// 10 раундов (было 8): разумный компромисс между стойкостью и временем входа
const BCRYPT_COST = 10;
// сравнение с пустышкой выравнивает время ответа для несуществующих email
const DUMMY_HASH = bcrypt.hashSync("opero-dummy-password", BCRYPT_COST);

const emailTaken = () =>
  apiErrors.conflict("An account with this email already exists", "email_taken");

export const registerService = async (body: {
  email: string;
  password: string;
  name: string;
  avatar: string;
}) => {
  const email = normalizeEmail(body.email);

  const existing = await pool.query(`select 1 from users where lower(email) = $1`, [email]);
  if (existing.rows[0]) throw emailTaken();

  const hashedPass = await bcrypt.hash(body.password, BCRYPT_COST);

  let user;
  try {
    const result = await pool.query(
      `
        insert into users (name, email, password, avatar)
        values ($1, $2, $3, $4)
        returning name, email, id, avatar, created_at
      `,
      [body.name.trim(), email, hashedPass, body.avatar],
    );
    user = result.rows[0];
  } catch (error: any) {
    // гонка двух одновременных регистраций: сработал unique-индекс
    if (error?.code === "23505") throw emailTaken();
    throw error;
  }

  const tokens = await startSession(user);

  return { user, token: tokens };
};

export const loginService = async (body: { email: string; password: string }) => {
  const result = await pool.query(`select * from users where lower(email) = $1`, [
    normalizeEmail(body.email),
  ]);
  const found = result.rows[0];

  // аккаунт создан через Google и пароля нет
  if (found && !found.password) {
    throw apiErrors.unauthorized(
      "This account uses Google sign-in. Continue with Google, or use “Forgot password” to set a password.",
      "google_only",
    );
  }

  const isMatchedPass = await bcrypt.compare(body.password, found?.password ?? DUMMY_HASH);

  // одинаковый ответ и для неизвестного email, и для неверного пароля
  if (!found || !isMatchedPass) {
    throw apiErrors.unauthorized("Invalid email or password", "invalid_credentials");
  }

  const tokens = await startSession(found);

  return {
    user: {
      email: found.email,
      id: found.id,
      avatar: found.avatar,
      name: found.name,
    },
    token: tokens,
  };
};

export const refreshService = (refreshToken: string | undefined) =>
  rotateSession(refreshToken);

export const profileService = async (userId: number) => {
  const result = await pool.query(
    `
      select name, email, avatar, id, google_id, created_at,
             (google_access is not null) as google_connected
      from users
      where id = $1
    `,
    [userId],
  );

  return result.rows[0];
};

export const logoutService = (refreshToken: string | undefined) =>
  endSession(refreshToken);

export const updateProfileService = async (
  userId: number,
  body: { name: string; avatar?: string },
) => {
  const previous = await pool.query(`select avatar from users where id = $1`, [userId]);

  const result = await pool.query(
    `
      update users
      set name = $1, avatar = coalesce($2, avatar)
      where id = $3
      returning name, email, avatar, id, google_id, created_at,
                (google_access is not null) as google_connected
    `,
    [body.name.trim(), body.avatar ?? null, userId],
  );

  // старая локальная аватарка больше не нужна
  if (body.avatar && previous.rows[0]?.avatar !== body.avatar) {
    removeUpload(previous.rows[0]?.avatar);
  }

  return result.rows[0];
};

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 час

export const forgotPasswordService = async (email: string) => {
  const result = await pool.query(
    `select id, name from users where lower(email) = $1`,
    [normalizeEmail(email)],
  );
  const user = result.rows[0];

  // не палим существование email
  if (!user) return;

  const rawToken = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  // действует только последняя выданная ссылка
  await pool.query(
    `update password_resets set used_at = now() where user_id = $1 and used_at is null`,
    [user.id],
  );
  await pool.query(
    `insert into password_resets (user_id, token_hash, expires_at) values ($1, $2, $3)`,
    [user.id, hashToken(rawToken), expiresAt],
  );

  const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/reset-password?token=${rawToken}`;

  // письмо уходит в фоне: ответ мгновенный и не зависит от того,
  // существует ли email (раньше по времени ответа это было видно)
  sendMail({
    to: email,
    subject: "Reset your Opero password",
    text: `Hi ${user.name},\n\nUse this link to reset your password. It expires in 1 hour:\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email.`,
  }).catch((error) => {
    console.error("[mailer] failed to send the password reset email:", error);
  });
};

export const resetPasswordService = async (token: string, newPassword: string) => {
  const hashedPass = await bcrypt.hash(newPassword, BCRYPT_COST);
  const client = await pool.connect();

  try {
    await client.query("begin");

    const result = await client.query(
      `
        select id, user_id from password_resets
        where token_hash = $1 and used_at is null and expires_at > now()
        for update
      `,
      [hashToken(token)],
    );

    const record = result.rows[0];
    if (!record) {
      throw apiErrors.badRequest("This reset link is invalid or has expired");
    }

    await client.query(`update users set password = $1 where id = $2`, [
      hashedPass,
      record.user_id,
    ]);
    await client.query(
      `update password_resets set used_at = now() where user_id = $1 and used_at is null`,
      [record.user_id],
    );

    await client.query("commit");

    // пароль сменён — все ранее выданные сессии больше не действуют
    await endAllSessions(record.user_id);
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
};
