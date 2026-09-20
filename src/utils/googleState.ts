import jwt from "jsonwebtoken";
import { hashToken, refresh_secret } from "./generateTokens";

// подпись state отдельным ключом: такой токен нельзя выдать за access-токен
const stateSecret = hashToken(`${refresh_secret}:google-link-state`);

export interface ILinkState {
  userId: number;
  returnTo: string;
}

// возвращаем только относительные пути своего фронта
export const safeReturnTo = (value: unknown) =>
  typeof value === "string" && /^\/(?!\/)[\w\-/.?=&%]*$/.test(value) ? value : "/";

export const signLinkState = (state: ILinkState) =>
  jwt.sign({ purpose: "google-link", ...state }, stateSecret, { expiresIn: "10m" });

export const readLinkState = (raw: unknown): ILinkState | null => {
  if (typeof raw !== "string" || !raw) return null;

  try {
    const decoded = jwt.verify(raw, stateSecret) as jwt.JwtPayload;
    if (decoded.purpose !== "google-link" || typeof decoded.userId !== "number") return null;
    return { userId: decoded.userId, returnTo: safeReturnTo(decoded.returnTo) };
  } catch {
    return null;
  }
};
