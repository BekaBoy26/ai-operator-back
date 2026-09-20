import { NextFunction, Request, Response } from "express";
import passport from "passport";
import { startSession } from "../services/session.service";
import { readLinkState } from "../utils/googleState";
import { setRefreshCookie } from "../utils/cookies";

const frontendUrl = () => process.env.FRONTEND_URL || "http://localhost:3000";

const withParam = (path: string, param: string) =>
  `${path}${path.includes("?") ? "&" : "?"}${param}`;

// Ошибки и отмена на экране Google раньше показывали голый текст "Unauthorized" —
// теперь возвращаем пользователя в приложение с понятным сообщением.
export const googleCallback = (req: Request, res: Response, next: NextFunction) => {
  const link = readLinkState(req.query.state);

  const backWithError = (reason: string) =>
    res.redirect(
      link
        ? `${frontendUrl()}${withParam(link.returnTo, `google=${reason}`)}`
        : `${frontendUrl()}/login?error=${reason}`,
    );

  passport.authenticate("google", { session: false }, async (error: unknown, user: any, info: any) => {
    try {
      if (error) {
        console.error("[google] callback error:", error);
        return backWithError("failed");
      }

      if (!user) {
        const reason = ["account_exists", "google_in_use"].includes(info?.message)
          ? info.message
          : "denied";
        return backWithError(reason);
      }

      // подключение Google к текущей сессии: новый вход не создаём
      if (user.linked) {
        return res.redirect(`${frontendUrl()}${withParam(user.returnTo, "google=connected")}`);
      }

      const tokens = await startSession(user);
      setRefreshCookie(res, tokens.refreshToken);

      // access-токен больше не передаём в URL: фронт получит его через /auth/refresh
      res.redirect(`${frontendUrl()}/?auth=google`);
    } catch (err) {
      next(err);
    }
  })(req, res, next);
};
