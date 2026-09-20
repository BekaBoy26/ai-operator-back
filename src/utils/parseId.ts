import { apiErrors } from "./apiErrors";

export const parseId = (value: string) => {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw apiErrors.badRequest("Invalid id");
  }

  return id;
};
