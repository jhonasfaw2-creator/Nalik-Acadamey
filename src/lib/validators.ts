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
