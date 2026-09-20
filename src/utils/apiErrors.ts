export class CustomApiError extends Error {
  constructor(
    public status: number,
    message: string,
    // машинный код: по нему фронт отличает "Google не подключён" от прочих 400
    public code?: string,
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

const make =
  (status: number, fallback: string) =>
  (message = fallback, code?: string) =>
    new CustomApiError(status, message, code);

export const apiErrors = {
  badRequest: make(400, "Bad Request"),
  unauthorized: make(401, "Unauthorized"),
  forbidden: make(403, "Forbidden"),
  notFound: make(404, "Not Found"),
  conflict: make(409, "Conflict"),
  tooLarge: make(413, "Payload Too Large"),
  limit: make(429, "Too Many Requests"),
  badGateway: make(502, "Upstream service error"),
};

// ошибки интеграции с Google — фронт показывает "подключите аккаунт заново"
export const googleErrors = {
  notConnected: () =>
    new CustomApiError(400, "Google account is not connected", "google_not_connected"),
  reconnect: () =>
    new CustomApiError(
      400,
      "Google authorization expired. Please reconnect your Google account.",
      "google_reconnect",
    ),
  scope: () =>
    new CustomApiError(
      400,
      "Your Google connection is missing a permission. Please reconnect your Google account.",
      "google_scope",
    ),
};
