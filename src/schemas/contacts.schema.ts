import z from "zod";

const optionalText = (max: number) => z.string().max(max, "This value is too long").nullable().optional();

export const createContactSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120, "Name is too long"),
  email: z
    .union([z.literal(""), z.email("Enter a valid email address")])
    .nullable()
    .optional(),
  phone: optionalText(40),
  company: optionalText(120),
  notes: optionalText(5000),
});

export const updateContactSchema = createContactSchema
  .partial()
  .refine((body) => Object.values(body).some((value) => value !== undefined), "Nothing to update");
