import { z } from "zod";

export const courseSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().min(1, "Description is required").max(2000),
  price: z.number().int().nonnegative(),
  discountPrice: z.number().int().nonnegative().nullable().optional(),
  discountLabel: z.string().max(200).nullable().optional(),
  active: z.boolean().default(true),
  sortOrder: z.number().int().nonnegative().default(0),
});

// Server-side validation for the public registration endpoint. Mirrors the
// client-side checks in ApplicationForm so bad input never reaches Prisma
// (e.g. a NaN age used to produce a 500 instead of a clean 400).
export const registrationSchema = z.object({
  fullName: z.string().trim().min(2, "Full name must be at least 2 characters").max(120),
  email: z.string().trim().email("Please enter a valid email").max(200),
  phone: z.string().trim().min(8, "Phone must be at least 8 digits").max(30),
  whatsapp: z.string().trim().min(8, "WhatsApp must be at least 8 digits").max(30).optional().nullable(),
  age: z.coerce.number().int("Age must be a whole number").min(10, "Age must be 10–99").max(99, "Age must be 10–99"),
  courseId: z.string().min(1, "Course is required"),
  scheduleId: z.string().min(1).optional().nullable(),
  previousExperience: z.string().max(2000).optional(),
  motivation: z.string().max(2000).optional(),
});