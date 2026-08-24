import { z } from "zod";

export const COURSES = [
  {
    value: "Adobe Illustrator + Photoshop",
    label: "Adobe Illustrator + Photoshop",
    price: "6,000 Birr",
    discountPrice: "4,800 Birr",
    discountLabel: "Opening Offer — 20% off",
    description:
      "Learn to create logos, thumbnails, social media assets, and print-ready designs from scratch.",
    image: "/assets/courses/adobe and photo shop.avif",
  },
  {
    value: "DaVinci Resolve",
    label: "DaVinci Resolve",
    price: "8,000 Birr",
    discountPrice: "6,500 Birr",
    discountLabel: "Opening Offer — 19% off",
    description:
      "Professional color grading, editing, and audio finishing used on Hollywood productions.",
    image: "/assets/courses/davinci resolve.jpeg",
  },
  {
    value: "Adobe Premiere",
    label: "Adobe Premiere",
    price: "8,000 Birr",
    discountPrice: "6,500 Birr",
    discountLabel: "Opening Offer — 19% off",
    description:
      "Master professional video editing from timeline basics to advanced multicam workflows and export settings.",
    image: "/assets/courses/adobe-logo-icon-set-vector-white-background_981536-451.avif",
  },
];

export const applicationSchema = z.object({
  fullName: z
    .string()
    .min(2, "Full name must be at least 2 characters")
    .max(100, "Full name must be at most 100 characters"),
  email: z.string().email("Please enter a valid email address"),
  phone: z
    .string()
    .min(1, "Phone number is required")
    .min(8, "Phone number must be at least 8 digits"),
  age: z
    .number({ invalid_type_error: "Age is required" })
    .int("Age must be a whole number")
    .min(10, "You must be at least 10 years old")
    .max(99, "Please enter a valid age"),
  courseSelection: z.string().min(1, "Please select a course"),
  previousExperience: z
    .string()
    .min(1, "Please describe your experience level"),
  motivation: z
    .string()
    .min(10, "Please tell us a bit more about your motivation")
    .max(500, "Motivation must be at most 500 characters"),

});

export type ApplicationInput = z.infer<typeof applicationSchema>;

export const contactSchema = z.object({
  key: z.string().min(1),
  value: z.string().min(1),
});

export type ContactInput = z.infer<typeof contactSchema>;
