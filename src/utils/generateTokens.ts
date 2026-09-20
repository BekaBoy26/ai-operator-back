import crypto from "crypto";
import jwt from "jsonwebtoken";
import { IPayload } from "../types/types";

const MIN_SECRET_LENGTH = 32;

const readSecret = (name: string) => {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is not set. Add it to backend/.env`);
  }

  if (value.length < MIN_SECRET_LENGTH) {
    const message = `${name} is too short (${value.length} chars). Use at least ${MIN_SECRET_LENGTH} random characters, e.g. node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`;
    if (process.env.NODE_ENV === "production") throw new Error(message);
    console.warn(`[security] ${message}`);
  }

  return value;
};

export const access_secret = readSecret("ACCESS_TOKEN_SECRET");
export const refresh_secret = readSecret("REFRESH_TOKEN_SECRET");

export const ACCESS_TTL = "15m";
export const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const hashToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

export const generateTokens = (payload: IPayload) => {
  const accessToken = jwt.sign(payload, access_secret, { expiresIn: ACCESS_TTL });
  // jti делает каждый refresh-токен уникальным (хеш хранится в auth_sessions)
  const refreshToken = jwt.sign(payload, refresh_secret, {
    expiresIn: Math.floor(REFRESH_TTL_MS / 1000),
    jwtid: crypto.randomUUID(),
  });

  return { accessToken, refreshToken };
};
