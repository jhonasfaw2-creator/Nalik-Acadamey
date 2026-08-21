/**
 * Course catalog for the Featured Courses section.
 * Each course is displayed as a card on the public homepage.
 *
 * To add or change courses, edit the array below — no component changes needed.
 */

export interface Course {
  slug: string;
  title: string;
  description: string;
  level: string;
  duration: string;
  image: string;
  /** Alt text for the course image. */
  imageAlt: string;
  /** Primary tag shown on the card badge. */
  tag: string;
}

export const COURSES: Course[] = [
  {
    slug: "davinci-resolve",
    title: "DaVinci Resolve",
    description:
      "Master the industry-standard editor for cutting, color, audio, and VFX — all in one application.",
    level: "Beginner to Advanced",
    duration: "60 days",
    image: "/images/courses/davinci-resolve.svg",
    imageAlt: "DaVinci Resolve Studio logo",
    tag: "Editing & Color",
  },
  {
    slug: "adobe-premiere-pro",
    title: "Adobe Premiere Pro",
    description:
      "Learn the professional editing workflow used by filmmakers, content creators, and production studios worldwide.",
    level: "Beginner to Intermediate",
    duration: "60 days",
    image: "/images/courses/adobe-premiere-pro.svg",
    imageAlt: "Adobe Premiere Pro logo",
    tag: "Editing & Production",
  },
];
