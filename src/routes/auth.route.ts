import { Router } from "express";
import passport from "passport";
import {
  forgotPasswordController,
  googleConnectController,
  loginController,
  logoutController,
  profileController,
  refreshController,
  registerController,
  resetPasswordController,
  updateProfileController,
} from "../controllers/auth.controller";
import {
  deleteCalendarController,
  getCalendarController,
  getDriveController,
  getGmailController,
  getGmailMessageController,
  modifyGmailMessageController,
  postCalendarController,
  sendGmailMessageController,
  updateCalendarController,
} from "../controllers/google.controller";
import { authMiddleware } from "../middlewares/auth";
import { googleCallback } from "../middlewares/googleCallback";
import { rateLimit } from "../middlewares/rateLimit";
import { validateQuery, validateSchema } from "../middlewares/schema";
import { uploadMiddleware, verifyUploadedImage } from "../middlewares/upload";
import {
  authSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from "../schemas/auth.schema";
import { calendarEventSchema, calendarRangeQuerySchema } from "../schemas/calendar.schema";
import {
  gmailListQuerySchema,
  gmailModifySchema,
  sendGmailSchema,
} from "../schemas/gmail.schema";
import { readLinkState } from "../utils/googleState";

const router = Router();

const MINUTE = 60 * 1000;
const loginLimiter = rateLimit({ windowMs: 15 * MINUTE, max: 30, message: "Too many sign-in attempts. Try again in a few minutes." });
const registerLimiter = rateLimit({ windowMs: 60 * MINUTE, max: 20, message: "Too many sign-ups from this address. Try again later." });
const forgotLimiter = rateLimit({ windowMs: 15 * MINUTE, max: 8, message: "Too many reset requests. Try again in a few minutes." });
const resetLimiter = rateLimit({ windowMs: 15 * MINUTE, max: 15 });

router.post(
  "/register",
  registerLimiter,
  uploadMiddleware.single("avatar"),
  validateSchema(authSchema),
  verifyUploadedImage,
  registerController,
);
router.post("/login", loginLimiter, validateSchema(loginSchema), loginController);
router.post("/refresh", refreshController);
router.get("/profile", authMiddleware, profileController);
router.patch(
  "/profile",
  authMiddleware,
  uploadMiddleware.single("avatar"),
  validateSchema(updateProfileSchema),
  verifyUploadedImage,
  updateProfileController,
);
router.post("/logout", logoutController);
router.post("/forgot-password", forgotLimiter, validateSchema(forgotPasswordSchema), forgotPasswordController);
router.post("/reset-password", resetLimiter, validateSchema(resetPasswordSchema), resetPasswordController);

// ── Google OAuth ──
// gmail.modify нужен для архивации/удаления/звёздочек; остальные права прежние
const GOOGLE_SCOPES = [
  "profile",
  "email",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/calendar",
];

router.post("/google/connect", authMiddleware, googleConnectController);
router.get("/google", (req, res, next) => {
  // state есть только у "подключить Google" из приложения и подписан сервером
  const state = readLinkState(req.query.state) ? String(req.query.state) : undefined;

  passport.authenticate("google", {
    scope: GOOGLE_SCOPES,
    accessType: "offline",
    prompt: "consent",
    session: false,
    ...(state ? { state } : {}),
  })(req, res, next);
});
router.get("/google-callback", googleCallback);

// ── Gmail / Drive / Calendar ──
router.get("/gmail", authMiddleware, validateQuery(gmailListQuerySchema), getGmailController);
router.post("/gmail/send", authMiddleware, validateSchema(sendGmailSchema), sendGmailMessageController);
router.post("/gmail/:id/modify", authMiddleware, validateSchema(gmailModifySchema), modifyGmailMessageController);
router.get("/gmail/:id", authMiddleware, getGmailMessageController);
router.get("/drive", authMiddleware, getDriveController);
router.get("/calendar", authMiddleware, validateQuery(calendarRangeQuerySchema), getCalendarController);
router.post("/calendar", authMiddleware, validateSchema(calendarEventSchema), postCalendarController);
router.patch("/calendar/:id", authMiddleware, validateSchema(calendarEventSchema), updateCalendarController);
router.delete("/calendar/:id", authMiddleware, deleteCalendarController);

export default router;
