import z from "zod";

export const dealStageSchema = z.enum(["new", "in_progress", "won", "lost"]);

export const createDealSchema = z.object({
  title: z.string().trim().min(2, "Title must be at least 2 characters").max(200, "Title is too long"),
  contact_id: z.number("Choose a contact").int().positive("Choose a contact"),
  amount: z
    .number("Amount must be a number")
    .min(0, "Amount can't be negative")
    .max(1e12, "Amount is too large")
    .nullable()
    .optional(),
  stage: dealStageSchema.optional(),
  notes: z.string().max(5000, "Notes are too long").nullable().optional(),
});

// PATCH: amount = null очищает сумму, отсутствие поля её не трогает
export const updateDealSchema = createDealSchema
  .partial()
  .refine((body) => Object.values(body).some((value) => value !== undefined), "Nothing to update");

export const updateDealStageSchema = z.object({
  stage: dealStageSchema,
});
