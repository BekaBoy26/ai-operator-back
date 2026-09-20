import z from "zod";

// раньше требовали 10 символов в тексте — короткую заметку было не сохранить
export const createNoteSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200, "Title is too long"),
  content: z.string().trim().min(1, "Content is required").max(50_000, "Content is too long"),
});

export const updateNoteSchema = createNoteSchema
  .partial()
  .refine((body) => Object.values(body).some((value) => value !== undefined), "Nothing to update");
