import { CookieOptions, Response } from "express";
import { REFRESH_TTL_MS } from "./generateTokens";

const COOKIE_NAME = "refreshToken";

const sameSite = (): CookieOptions["sameSite"] => {
  const value = process.env.COOKIE_SAMESITE;
  return value === "none" || value === "strict" ? value : "lax";
};

const baseOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production" || sameSite() === "none",
  sameSite: sameSite(),
  path: "/auth",
});

export const setRefreshCookie = (res: Response, token: string) => {
  res.cookie(COOKIE_NAME, token, { ...baseOptions(), maxAge: REFRESH_TTL_MS });
};

export const clearRefreshCookie = (res: Response) => {
  res.clearCookie(COOKIE_NAME, baseOptions());
  // cookie, выставленная старой версией (path=/), тоже должна исчезнуть
  res.clearCookie(COOKIE_NAME, { httpOnly: true, path: "/" });
};
