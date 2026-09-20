import { NextFunction, Request, Response } from "express";
import { apiErrors } from "../utils/apiErrors";
import jwt from "jsonwebtoken";
import { access_secret } from "../utils/generateTokens";
import { IPayload } from "../types/types";

export const authMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const [scheme, token] = (req.headers.authorization ?? "").split(" ");

  if (scheme !== "Bearer" || !token) throw apiErrors.unauthorized("Unauthorized");

  try {
    req.user = jwt.verify(token, access_secret) as IPayload;
  } catch {
    throw apiErrors.unauthorized("Invalid or expired token");
  }

  next();
};
