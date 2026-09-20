import { Request, Response } from "express";
import {
  forgotPasswordService,
  loginService,
  logoutService,
  profileService,
  refreshService,
  registerService,
  resetPasswordService,
  updateProfileService,
} from "../services/auth.service";
import { apiErrors } from "../utils/apiErrors";
import { clearRefreshCookie, setRefreshCookie } from "../utils/cookies";
import { safeReturnTo, signLinkState } from "../utils/googleState";
import { userIdOf } from "../utils/request";

export const registerController = async (req: Request, res: Response) => {
  const { email, password, name } = req.body;

  // файл лежит в памяти; в Cloudinary он уходит внутри сервиса, после проверки email
  const { user, token } = await registerService({
    email,
    password,
    name,
    avatarFile: req.file,
  });

  setRefreshCookie(res, token.refreshToken);

  res.status(201).json({
    message: "Registered successfully",
    user,
    accessToken: token.accessToken,
  });
};

export const loginController = async (req: Request, res: Response) => {
  const { token, user } = await loginService(req.body);

  setRefreshCookie(res, token.refreshToken);

  res.status(200).json({
    message: "Logged in successfully",
    user,
    accessToken: token.accessToken,
  });
};

export const refreshController = async (req: Request, res: Response) => {
  const tokens = await refreshService(req.cookies?.refreshToken);

  // refresh-токен ротируется — обновляем cookie
  setRefreshCookie(res, tokens.refreshToken);

  res.status(200).json({
    message: "Token refreshed",
    token: tokens.accessToken,
  });
};

export const profileController = async (req: Request, res: Response) => {
  const result = await profileService(userIdOf(req));
  if (!result) throw apiErrors.unauthorized("Unauthorized");

  res.status(200).json({ message: "profile", data: result });
};

export const updateProfileController = async (req: Request, res: Response) => {
  const result = await updateProfileService(userIdOf(req), {
    name: req.body.name,
    avatarFile: req.file,
  });

  res.status(200).json({ message: "Profile updated successfully", data: result });
};

export const logoutController = async (req: Request, res: Response) => {
  await logoutService(req.cookies?.refreshToken);
  clearRefreshCookie(res);

  res.status(200).json({ message: "Logged out" });
};

export const forgotPasswordController = async (req: Request, res: Response) => {
  await forgotPasswordService(req.body.email);

  // ответ не выдаёт, найден ли email
  res.status(200).json({ message: "If that email exists, a reset link has been sent." });
};

export const resetPasswordController = async (req: Request, res: Response) => {
  await resetPasswordService(req.body.token, req.body.password);

  res.status(200).json({ message: "Password updated successfully" });
};

// Возвращает адрес, по которому фронт отправит уже вошедшего пользователя в Google:
// в state зашита подписанная привязка к его аккаунту.
export const googleConnectController = async (req: Request, res: Response) => {
  const state = signLinkState({
    userId: userIdOf(req),
    returnTo: safeReturnTo(req.body?.returnTo),
  });

  res.status(200).json({ url: `/auth/google?state=${encodeURIComponent(state)}` });
};
