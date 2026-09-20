import { NextFunction, Request, Response } from "express";
import z from "zod";
import { removeUpload } from "../utils/files";

export const validateSchema = (schema: z.ZodType) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body ?? {});

    if (!result.success) {
      // multer уже сохранил файл: не оставляем сироту на диске
      if (req.file) removeUpload(`/uploads/${req.file.filename}`);

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
