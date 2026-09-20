import "dotenv/config";
import fs from "fs";
import path from "path";
import { Client } from "pg";
import { getDbConfig } from "../plugins/dbConfig";

// npm run migrate — применяет src/db/schema.sql (идемпотентно)
const run = async () => {
  // для миграций берём прямое соединение, если задан DATABASE_URL_UNPOOLED
  const client = new Client(getDbConfig({ unpooled: true }));

  // "already exists, skipping" не показываем — только наши сообщения
  client.on("notice", (notice) => {
    if (notice.message?.startsWith("users:")) console.log(`[db] ${notice.message}`);
  });

  await client.connect();

  try {
    const sql = fs.readFileSync(path.resolve(process.cwd(), "src/db/schema.sql"), "utf8");
    await client.query("begin");
    await client.query(sql);
    await client.query("commit");
    console.log("[db] schema is up to date");
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
};

run().catch((error) => {
  console.error("[db] migration failed:", error);
  process.exit(1);
});
