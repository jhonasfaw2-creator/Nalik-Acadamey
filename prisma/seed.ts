import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ── Website Content (key-value for text sections) ────
  const content: { section: string; key: string; value: string }[] = [
    // Hero
    { section: "hero", key: "badge", value: "Professional Media Training" },
    { section: "hero", key: "title", value: "Master the Art of Visual Storytelling" },
    { section: "hero", key: "description", value: "Learn filmmaking, video editing, and media production through practical training built around real creative work." },
    { section: "hero", key: "video", value: "/assets/hero/hero.mp4" },
    // About
    { section: "about", key: "badge", value: "About Us" },
    { section: "about", key: "title", value: "Nalik Academy is where aspiring editors become professionals." },
    { section: "about", key: "paragraph1", value: "Nalik Academy is a hands-on media production academy based in Ethiopia, focused on training the next generation of video editors, graphic designers, and visual storytellers. Courses are built around real projects, not theory alone." },
    { section: "about", key: "paragraph2", value: "Whether you are a complete beginner or looking to sharpen your skills, our structured programs build you up to professional-level output using the same tools the industry relies on every day." },
    { section: "about", key: "video", value: "/assets/About/about.mp4" },
    // What We Teach
    { section: "what-we-teach", key: "badge", value: "What We Teach" },
    { section: "what-we-teach", key: "title", value: "Practical skills. Professional tools. Real projects." },
    { section: "what-we-teach", key: "description", value: "Every course at Nalik Academy is built around the software professionals actually use. You learn by doing, not by watching lectures." },
    { section: "what-we-teach", key: "tool1_name", value: "Adobe Premiere Pro" },
    { section: "what-we-teach", key: "tool1_desc", value: "Video editing in Premiere Pro. Learn timeline basics, multicam workflows, color correction, and export settings for any platform." },
    { section: "what-we-teach", key: "tool2_name", value: "Adobe Photoshop" },
    { section: "what-we-teach", key: "tool2_desc", value: "Essential for thumbnail design, title cards, image retouching, and visual assets that complement your video projects." },
    { section: "what-we-teach", key: "tool3_name", value: "Adobe Illustrator" },
    { section: "what-we-teach", key: "tool3_desc", value: "Vector graphics for logos, lower thirds, motion graphics elements, and scalable design assets used across all media." },
    { section: "what-we-teach", key: "tool4_name", value: "DaVinci Resolve" },
    { section: "what-we-teach", key: "tool4_desc", value: "Color grading and post-production in DaVinci Resolve, a tool used on major films and increasingly adopted for editing and audio finishing." },
    // Our Programs
    { section: "our-programs", key: "badge", value: "Our Programs" },
    { section: "our-programs", key: "title", value: "What you get when you join Nalik Academy." },
    { section: "our-programs", key: "description", value: "Every program is built to make you a confident creator, with practical skills you can use immediately." },
    { section: "our-programs", key: "item1_title", value: "Hands-On Video Editing" },
    { section: "our-programs", key: "item1_text", value: "Edit real projects from day one. Learn timeline workflow, transitions, multicam editing, and export settings for YouTube, TV, and cinema using Adobe Premiere Pro and DaVinci Resolve." },
    { section: "our-programs", key: "item2_title", value: "Graphic Design Foundations" },
    { section: "our-programs", key: "item2_text", value: "Create professional thumbnails, title cards, logos, and social media assets. Master Adobe Photoshop for image editing and Illustrator for scalable vector design." },
    { section: "our-programs", key: "item3_title", value: "Color Grading & Finishing" },
    { section: "our-programs", key: "item3_text", value: "Learn professional color grading workflows in DaVinci Resolve, the same tool used on major film productions." },
    { section: "our-programs", key: "item4_title", value: "Portfolio-Ready Output" },
    { section: "our-programs", key: "item4_text", value: "Every course ends with a portfolio project. You graduate with real work to show employers or clients." },
    // How You Learn
    { section: "how-you-learn", key: "badge", value: "How You Learn" },
    { section: "how-you-learn", key: "title", value: "A learning experience built around practice, not theory." },
    { section: "how-you-learn", key: "description", value: "From day one, you are editing, designing, and creating. That is how real skills are built." },
    { section: "how-you-learn", key: "step1_title", value: "Learn by Doing" },
    { section: "how-you-learn", key: "step1_text", value: "No long lectures. Every class is hands-on: you edit footage, design graphics, and build projects from the first session." },
    { section: "how-you-learn", key: "step2_title", value: "Work on Real Projects" },
    { section: "how-you-learn", key: "step2_text", value: "Practice with the same types of content professionals create daily: promos, social media videos, title sequences, and more." },
    { section: "how-you-learn", key: "step3_title", value: "Get Personal Feedback" },
    { section: "how-you-learn", key: "step3_text", value: "Instructors review your work one-on-one, point out what to improve, and guide you toward professional-level output." },
    { section: "how-you-learn", key: "step4_title", value: "Build Your Portfolio" },
    { section: "how-you-learn", key: "step4_text", value: "Leave the academy with a collection of polished projects ready to show employers, clients, or use for freelancing." },
    // Founders
    { section: "founders", key: "badge", value: "Meet the founder" },
    { section: "founders", key: "name", value: "" },
    { section: "founders", key: "role", value: "Founder of Nalik Academy" },
    { section: "founders", key: "bio", value: "Before Nalik Academy, he worked as a freelance video editor in Ethiopia. He edited content for creators and social media personalities, including Loft Haron and Shirobaie. The work covered YouTube videos, short form clips, and longer stories, and it taught him how pacing, hooks, sound, and colour decide whether an edit holds attention.\n\nThe academy grew out of that experience. He wanted to teach editing the way he learned it, through real projects and practical decisions instead of theory alone. Students here work on the same kinds of edits he handled as a freelancer, with the same attention to story and finish." },
    { section: "founders", key: "portraitUrl", value: "/assets/natiii.jpg" },
    { section: "founders", key: "specialties", value: JSON.stringify(["Video Editing", "YouTube Editing", "Short Form Editing", "Short Film Editing", "Colour Grading", "Sound Design", "Motion Graphics", "Storytelling and Pacing"]) },
    { section: "founders", key: "featuredClients", value: JSON.stringify(["Loft Haron", "Shirobaie"]) },
    // Contact
    { section: "contact", key: "badge", value: "Get in Touch" },
    { section: "contact", key: "title", value: "Ready to start your creative journey?" },
    { section: "contact", key: "description", value: "Have questions about our courses, schedules, or the application process? Reach out; we are happy to help." },
    { section: "contact", key: "phone", value: "+251 911 223 344" },
    { section: "contact", key: "email", value: "info@nalikacademy.com" },
    { section: "contact", key: "location", value: "Addis Ababa, Ethiopia" },
    { section: "contact", key: "facebook", value: "https://facebook.com/nalikacademy" },
    { section: "contact", key: "instagram", value: "https://instagram.com/nalikacademy" },
    { section: "contact", key: "youtube", value: "https://youtube.com/@nalikacademy" },
    { section: "contact", key: "telegram", value: "https://t.me/nalikacademy" },
    // Footer
    { section: "footer", key: "tagline", value: "Professional media production training: filmmaking, video editing, and visual storytelling." },
  ];

  for (const item of content) {
    await prisma.content.upsert({
      where: { section_key: { section: item.section, key: item.key } },
      update: { value: item.value },
      create: item,
    });
  }

  // ── Courses ──────────────────────────────────────────
  const courses = [
    {
      id: "adobe-premiere-pro",
      title: "Adobe Premiere Pro",
      description: "Professional video editing covering timeline workflow, multicam editing, and export settings.",
      price: 10000,
      discountPrice: null,
      discountLabel: null,
      sortOrder: 1,
    },
    {
      id: "davinci-resolve",
      title: "DaVinci Resolve",
      description: "Professional color grading, editing, and audio finishing used on major film productions.",
      price: 14000,
      discountPrice: null,
      discountLabel: null,
      sortOrder: 2,
    },
    {
      id: "graphic-design",
      title: "Graphic Design",
      description: "Create professional logos, thumbnails, social media assets, and print-ready designs from scratch.",
      price: 6000,
      discountPrice: null,
      discountLabel: null,
      sortOrder: 3,
    },
  ];

  for (const course of courses) {
    await prisma.course.upsert({
      where: { id: course.id },
      update: course,
      create: course,
    });
  }

  // ── Schedules (two groups × three sessions, 15 seats each) ─
  const schedules = [
    // SCHEDULE A: Monday + Wednesday + Friday
    { id: "sched-a-morning", group: "A", days: "Monday, Wednesday, Friday", session: "Morning Session", startTime: "08:00", endTime: "10:00", maxSeats: 15 },
    { id: "sched-a-afternoon", group: "A", days: "Monday, Wednesday, Friday", session: "Afternoon Session", startTime: "14:00", endTime: "16:00", maxSeats: 15 },
    { id: "sched-a-evening", group: "A", days: "Monday, Wednesday, Friday", session: "Evening Session", startTime: "18:00", endTime: "20:00", maxSeats: 15 },
    // SCHEDULE B: Tuesday + Thursday + Saturday
    { id: "sched-b-morning", group: "B", days: "Tuesday, Thursday, Saturday", session: "Morning Session", startTime: "08:00", endTime: "10:00", maxSeats: 15 },
    { id: "sched-b-afternoon", group: "B", days: "Tuesday, Thursday, Saturday", session: "Afternoon Session", startTime: "14:00", endTime: "16:00", maxSeats: 15 },
    { id: "sched-b-evening", group: "B", days: "Tuesday, Thursday, Saturday", session: "Evening Session", startTime: "18:00", endTime: "20:00", maxSeats: 15, enrolled: 15 },
  ];

  for (const schedule of schedules) {
    await prisma.schedule.upsert({
      where: { group_session: { group: schedule.group, session: schedule.session } },
      // `enrolled` is only set when explicitly provided (e.g. to pre-fill a
      // session as full); undefined fields are ignored by Prisma, so other
      // sessions keep their live enrollment counts on re-seed.
      update: { days: schedule.days, startTime: schedule.startTime, endTime: schedule.endTime, maxSeats: schedule.maxSeats, enrolled: schedule.enrolled },
      create: schedule,
    });
  }

  // ── Academy settings (editable via Admin → Settings) ──
  const academySettings: { key: string; value: string }[] = [
    { key: "academy_name", value: "Nalik Academy" },
    { key: "academy_email", value: "info@nalikacademy.com" },
    { key: "academy_phone", value: "+251 911 223 344" },
    { key: "academy_address", value: "Addis Ababa, Ethiopia" },
  ];

  for (const setting of academySettings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: setting,
    });
  }

  console.log("✅ Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });