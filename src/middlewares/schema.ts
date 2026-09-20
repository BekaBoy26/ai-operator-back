import { NextFunction, Request, Response } from "express";
import z from "zod";

export const validateSchema = (schema: z.ZodType) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body ?? {});

    if (!result.success) {
      // файл (если был) лежит только в памяти запроса — чистить нечего, в Cloudinary ничего не ушло
      const errors = result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }));

      return res.status(400).json({
        message: errors[0]?.message ?? "Invalid request",
        code: "validation_error",
        errors,
      });
    }

    req.body = result.data;

    next();
  };
};

// query-параметры: результат кладём в res.locals.query
export const validateQuery = (schema: z.ZodType) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);

    if (!result.success) {
      return res.status(400).json({
        message: result.error.issues[0]?.message ?? "Invalid request",
        code: "validation_error",
      });
    }

    res.locals.query = result.data;
    next();
  };
};
