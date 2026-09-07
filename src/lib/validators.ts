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
  age: z.coerce.number().int("Age must be a whole number").min(10, "Age must be 10–99").max(99, "Age must be 10–99"),
  courseId: z.string().min(1, "Course is required"),
  scheduleId: z.string().min(1, "Schedule group and session are required"),
  previousExperience: z.string().max(2000).optional(),
  motivation: z.string().max(2000).optional(),
});

// Server-side validation for admin schedule create/update. Sessions are
// shared across courses, so the admin picks a group (A/B) and a session name;
// days are derived from the group and seats are fixed at 15 per session.
export const scheduleSchema = z.object({
  id: z.string().optional(),
  group: z.enum(["A", "B"], { message: "Schedule group must be A or B" }),
  session: z
    .enum(["Morning Session", "Afternoon Session", "Evening Session"], {
      message: "Session must be Morning, Afternoon, or Evening",
    })
    .or(z.string().trim().min(1, "Session is required").max(120)),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Start time must be HH:MM"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "End time must be HH:MM"),
  maxSeats: z.number().int("Max seats must be a whole number").min(1).max(1000).default(15),
  active: z.boolean().default(true),
});