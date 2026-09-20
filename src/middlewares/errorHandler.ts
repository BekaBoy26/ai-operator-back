import { NextFunction, Request, Response } from "express";
import { CustomApiError } from "../utils/apiErrors";

// pg-ошибки клиента превращаем в понятные 4xx вместо "Internal Server Error"
const PG_CLIENT_ERRORS: Record<string, [number, string]> = {
  "23505": [409, "This record already exists"],
  "23503": [400, "A related record does not exist"],
  "23502": [400, "A required field is missing"],
  "23514": [400, "One of the values is not allowed"],
  "22P02": [400, "One of the values has an invalid format"],
  "22007": [400, "Invalid date"],
  "22008": [400, "Invalid date"],
  "22003": [400, "A number is out of range"],
  "22001": [400, "One of the values is too long"],
};

const normalize = (error: any): { status: number; message: string; code?: string } => {
  if (error instanceof CustomApiError) {
    return {
      status: error.status,
      message: error.message,
      ...(error.code ? { code: error.code } : {}),
    };
  }

  if (error?.name === "MulterError") {
    return error.code === "LIMIT_FILE_SIZE"
      ? { status: 413, message: "The image is too large (max 5 MB)" }
      : { status: 400, message: "Invalid file upload" };
  }

  // ошибки body-parser: битый JSON, слишком большое тело
  if (typeof error?.type === "string" && error.type.startsWith("entity.")) {
    return error.type === "entity.too.large"
      ? { status: 413, message: "Request body is too large" }
      : { status: 400, message: "Request body is not valid JSON" };
  }

  const pgMapped = typeof error?.code === "string" ? PG_CLIENT_ERRORS[error.code] : undefined;
  if (pgMapped) return { status: pgMapped[0], message: pgMapped[1] };

  return { status: 500, message: "Internal Server Error" };
};

export const errorHandler = (
  error: any,
  req: Request,
  res: Response,
  _next: NextFunction,
) => {
  const { status, message, code } = normalize(error);

  // раньше 500-е не логировались вообще
  if (status >= 500) {
    console.error(`[error] ${req.method} ${req.path}`, error);
  }

  if (res.headersSent) return;

  res.status(status).json({ message, ...(code ? { code } : {}) });
};

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.path}` });
};
