import z from "zod";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address"));

// bcrypt учитывает только первые 72 байта пароля
const newPassword = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters");

const name = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters")
  .max(80, "Name must be at most 80 characters");

export const authSchema = z.object({
  email,
  password: newPassword,
  name,
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password"),
});

export const updateProfileSchema = z.object({
  name,
});

export const forgotPasswordSchema = z.object({
  email,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10, "This reset link is invalid"),
  password: newPassword,
});
