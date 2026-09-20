import { NextFunction, Request, Response } from "express";
import { apiErrors } from "../utils/apiErrors";

interface IRateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
}

// простой лимитер в памяти: хватает для одного инстанса
export const rateLimit = ({ windowMs, max, message }: IRateLimitOptions) => {
  const hits = new Map<string, { count: number; resetAt: number }>();

  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key);
  }, windowMs);
  cleanup.unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = `${req.ip}:${req.baseUrl}${req.path}`;
    const entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count++;

    if (entry.count > max) {
      res.setHeader("Retry-After", Math.ceil((entry.resetAt - now) / 1000));
      return next(
        apiErrors.limit(message ?? "Too many attempts. Please try again later."),
      );
    }

    next();
  };
};
