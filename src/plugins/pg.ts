import { Pool, types } from "pg";
import { describeDb, getDbConfig } from "./dbConfig";

// колонки date отдаём строкой "YYYY-MM-DD": иначе JS сдвинет день по часовому поясу
types.setTypeParser(types.builtins.DATE, (value) => value);
// numeric (суммы сделок) приходит строкой — приводим к числу
types.setTypeParser(types.builtins.NUMERIC, (value) => Number(value));

export const pool = new Pool({
  ...getDbConfig(),
  max: 10,
  idleTimeoutMillis: 30_000,
});

// без этого обрыв соединения с БД ронял весь процесс
pool.on("error", (error) => {
  console.error("[db] idle client error:", error.message);
});

// раньше pool.connect() занимал одно соединение навсегда и не ловил ошибку
pool
  .query("select 1")
  .then(() => console.log(`DB Connected (${describeDb()})`))
  .catch((error) => console.error("[db] cannot connect:", error.message));
