import { Request } from "express";
import { apiErrors } from "./apiErrors";

// id пользователя из проверенного JWT (authMiddleware уже отработал)
export const userIdOf = (req: Request) => {
  if (!req.user) throw apiErrors.unauthorized("Unauthorized");
  return req.user.id;
};
