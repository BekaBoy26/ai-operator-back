import z from "zod";

export const taskStatusSchema = z.enum(["todo", "in_progress", "done"]);
export const taskPrioritySchema = z.enum(["low", "medium", "high"]);

// "" и null = без срока
const dueDate = z
  .union([z.literal(""), z.iso.date("Use the YYYY-MM-DD date format")])
  .nullable()
  .optional();

export const createTaskSchema = z.object({
  title: z.string().trim().min(2, "Title must be at least 2 characters").max(200, "Title is too long"),
  description: z.string().max(5000, "Description is too long").nullable().optional(),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  due_date: dueDate,
});

// PATCH: можно прислать любые поля, остальные не трогаются
export const updateTaskSchema = createTaskSchema
  .partial()
  .refine((body) => Object.values(body).some((value) => value !== undefined), "Nothing to update");

export const updateTaskStatusSchema = z.object({
  status: taskStatusSchema,
});
