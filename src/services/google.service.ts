import { google } from "googleapis";
import { pool } from "../plugins/pg";
import { apiErrors, CustomApiError, googleErrors } from "../utils/apiErrors";

export type GoogleAuth = InstanceType<typeof google.auth.OAuth2>;

// OAuth-клиент пользователя; обновлённый access-токен сразу сохраняем в БД
// (раньше он терялся и каждый запрос после часа делал лишний обмен токена)
export const getGoogleClient = async (userId: number): Promise<GoogleAuth> => {
  const result = await pool.query(
    `select google_access, google_refresh from users where id = $1`,
    [userId],
  );
  const user = result.rows[0];

  if (!user || (!user.google_access && !user.google_refresh)) {
    throw googleErrors.notConnected();
  }

  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_CALLBACK_URL,
  );

  auth.setCredentials({
    access_token: user.google_access,
    refresh_token: user.google_refresh,
  });

  auth.on("tokens", (tokens) => {
    pool
      .query(
        `
          update users
          set google_access = coalesce($1, google_access),
              google_refresh = coalesce($2, google_refresh)
          where id = $3
        `,
        [tokens.access_token ?? null, tokens.refresh_token ?? null, userId],
      )
      .catch((error) => console.error("[google] failed to store refreshed token:", error));
  });

  return auth;
};

// ошибки googleapis -> наши понятные ошибки с кодом
export const mapGoogleError = (error: any): CustomApiError => {
  if (error instanceof CustomApiError) return error;

  const data = error?.response?.data;
  const status: number | undefined =
    error?.status ?? error?.response?.status ?? (typeof error?.code === "number" ? error.code : undefined);
  const message: string =
    data?.error?.message ?? data?.error_description ?? error?.message ?? "Unknown Google error";
  const reason: string | undefined = data?.error?.errors?.[0]?.reason;

  if (error?.message === "invalid_grant" || data?.error === "invalid_grant" || status === 401) {
    return googleErrors.reconnect();
  }

  if (
    status === 429 ||
    reason === "rateLimitExceeded" ||
    reason === "userRateLimitExceeded"
  ) {
    return apiErrors.limit("Google is rate-limiting requests. Please try again in a moment.");
  }

  if (status === 403 && /has not been used|is disabled/i.test(message)) {
    return apiErrors.badGateway(
      "This Google API is disabled for the project. Enable it in Google Cloud Console.",
    );
  }

  if (status === 403) return googleErrors.scope();
  if (status === 404) return apiErrors.notFound("Not found in Google");
  if (status === 400) return apiErrors.badRequest(message);

  console.error("[google] unexpected API error:", message);
  return apiErrors.badGateway("Google API request failed. Please try again later.");
};

export const withGoogle = async <T>(
  userId: number,
  fn: (auth: GoogleAuth) => Promise<T>,
): Promise<T> => {
  const auth = await getGoogleClient(userId);

  try {
    return await fn(auth);
  } catch (error) {
    throw mapGoogleError(error);
  }
};
