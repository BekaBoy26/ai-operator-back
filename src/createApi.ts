import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import passport from "passport";
import "./config/googleAuth";
import authRouter from "./routes/auth.route";
import chatRouter from "./routes/chat.route";
import notesRouter from "./routes/notes.route";
import tasksRouter from "./routes/tasks.route";
import contactsRouter from "./routes/contacts.route";
import dealsRouter from "./routes/deals.route";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";
import { logger } from "./middlewares/logger";
import { LEGACY_UPLOADS_DIR, legacyUploadsAvailable } from "./utils/legacyUploads";

const createApi = () => {
  const app = express();

  app.disable("x-powered-by");
  app.use(
    cors({
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      credentials: true,
    }),
  );

  // базовые заголовки безопасности
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    next();
  });

  app.use(logger);
  app.use(cookieParser());
  app.use(express.json({ limit: "1mb" }));
  app.use(passport.initialize());

  // Только чтение старых аватарок ("/uploads/<файл>" в БД до перехода на Cloudinary).
  // Новые файлы сюда не пишутся; если папки нет (Render) — маршрут не создаётся.
  // Удалите после `npm run migrate:avatars`.
  if (legacyUploadsAvailable()) {
    app.use(
      "/uploads",
      express.static(LEGACY_UPLOADS_DIR, { maxAge: "7d", index: false, dotfiles: "ignore" }),
    );
  }

  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.use("/auth", authRouter);
  app.use("/chat", chatRouter);
  app.use("/notes", notesRouter);
  app.use("/tasks", tasksRouter);
  app.use("/contacts", contactsRouter);
  app.use("/deals", dealsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

export default createApi;
