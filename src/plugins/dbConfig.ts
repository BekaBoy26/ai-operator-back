import { PoolConfig } from "pg";

// Neon (и любой облачный Postgres) подключается одной строкой DATABASE_URL.
// Если она пуста, используются отдельные DB_* — удобно для локальной базы.

// sslmode=require в pg 8 и так работает как verify-full, но печатает предупреждение:
// задаём режим явно, поведение остаётся тем же (сертификат сервера проверяется).
const normalizeUrl = (raw: string) => {
  try {
    const url = new URL(raw);
    const mode = url.searchParams.get("sslmode");

    if (mode === "require" || mode === "verify-ca") {
      url.searchParams.set("sslmode", "verify-full");
    } else if (!mode && url.hostname.endsWith(".neon.tech")) {
      // Neon принимает только TLS
      url.searchParams.set("sslmode", "verify-full");
    }

    return url.toString();
  } catch {
    return raw;
  }
};

const readUrl = (name: string) => process.env[name]?.trim() || "";

// unpooled: для миграций лучше прямое соединение (без pgbouncer), если задан DATABASE_URL_UNPOOLED
export const getDbConfig = ({ unpooled = false } = {}): PoolConfig => {
  const url = (unpooled && readUrl("DATABASE_URL_UNPOOLED")) || readUrl("DATABASE_URL");

  if (url) {
    return {
      connectionString: normalizeUrl(url),
      // облачная база "засыпает" без нагрузки: первое подключение может занять несколько секунд
      connectionTimeoutMillis: 20_000,
    };
  }

  return {
    database: process.env.DB_NAME,
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectionTimeoutMillis: 5_000,
  };
};

// куда подключаемся — для лога, без пароля
export const describeDb = () => {
  const url = readUrl("DATABASE_URL");

  if (url) {
    try {
      const parsed = new URL(url);
      return `${parsed.hostname}${parsed.pathname}`;
    } catch {
      return "DATABASE_URL";
    }
  }

  return `${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;
};
