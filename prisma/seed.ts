import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ── Website Content (key-value for text sections) ────
  const content: { section: string; key: string; value: string }[] = [
    // Hero
    { section: "hero", key: "badge", value: "Professional Media Training" },
    { section: "hero", key: "title", value: "Master the Art of Visual Storytelling" },
    { section: "hero", key: "description", value: "Learn filmmaking, video editing, and media production from industry professionals. Transform your creative passion into a career." },
    { section: "hero", key: "video", value: "/assets/hero/hero.mp4" },
    // About
    { section: "about", key: "badge", value: "About Us" },
    { section: "about", key: "title", value: "Nalik Academy is where aspiring editors become professionals." },
    { section: "about", key: "paragraph1", value: "We are a hands-on media production academy based in Ethiopia, focused on training the next generation of video editors, graphic designers, and visual storytellers. Our courses are built around real-world projects — not theory alone." },
    { section: "about", key: "paragraph2", value: "Whether you are a complete beginner or looking to sharpen your skills, our structured programs take you from fundamentals to professional-level output using the same tools the industry relies on every day." },
    { section: "about", key: "video", value: "/assets/About/about.mp4" },
    // What We Teach
    { section: "what-we-teach", key: "badge", value: "What We Teach" },
    { section: "what-we-teach", key: "title", value: "Practical skills. Professional tools. Real projects." },
    { section: "what-we-teach", key: "description", value: "Every course at Nalik Academy is built around the software professionals actually use. You learn by doing — not by watching lectures." },
    { section: "what-we-teach", key: "tool1_name", value: "Adobe Premiere Pro" },
    { section: "what-we-teach", key: "tool1_desc", value: "Industry-standard video editing. From timeline basics to advanced multicam workflows, color correction, and export settings for any platform." },
    { section: "what-we-teach", key: "tool2_name", value: "Adobe Photoshop" },
    { section: "what-we-teach", key: "tool2_desc", value: "Essential for thumbnail design, title cards, image retouching, and visual assets that complement your video projects." },
    { section: "what-we-teach", key: "tool3_name", value: "Adobe Illustrator" },
    { section: "what-we-teach", key: "tool3_desc", value: "Vector graphics for logos, lower thirds, motion graphics elements, and scalable design assets used across all media." },
    { section: "what-we-teach", key: "tool4_name", value: "DaVinci Resolve" },
    { section: "what-we-teach", key: "tool4_desc", value: "Professional-grade color grading and post-production. Used on major films and increasingly adopted for editing and audio finishing." },
    // Our Programs
    { section: "our-programs", key: "badge", value: "Our Programs" },
    { section: "our-programs", key: "title", value: "What you get when you join Nalik Academy." },
    { section: "our-programs", key: "description", value: "Every program is designed to take you from beginner to confident creator — with practical skills you can use immediately." },
    { section: "our-programs", key: "item1_title", value: "Hands-On Video Editing" },
    { section: "our-programs", key: "item1_text", value: "Edit real projects from day one. Learn timeline workflow, transitions, multicam editing, and export settings for YouTube, TV, and cinema using Adobe Premiere Pro and DaVinci Resolve." },
    { section: "our-programs", key: "item2_title", value: "Graphic Design Foundations" },
    { section: "our-programs", key: "item2_text", value: "Create professional thumbnails, title cards, logos, and social media assets. Master Adobe Photoshop for image editing and Illustrator for scalable vector design." },
    { section: "our-programs", key: "item3_title", value: "Color Grading & Finishing" },
    { section: "our-programs", key: "item3_text", value: "Go beyond basic corrections. Learn professional color grading workflows in DaVinci Resolve — the same tool used on major Hollywood productions." },
    { section: "our-programs", key: "item4_title", value: "Portfolio-Ready Output" },
    { section: "our-programs", key: "item4_text", value: "Every course ends with a portfolio project. You graduate with real work to show employers or clients, not just a certificate of attendance." },
    // How It Works
    { section: "how-it-works", key: "badge", value: "How It Works" },
    { section: "how-it-works", key: "title", value: "Four simple steps to get started." },
    { section: "how-it-works", key: "step1_title", value: "Choose Your Course" },
    { section: "how-it-works", key: "step1_text", value: "Browse our programs and pick the one that matches your goals — video editing, graphic design, or color grading." },
    { section: "how-it-works", key: "step2_title", value: "Submit Your Application" },
    { section: "how-it-works", key: "step2_text", value: "Fill out the short application form with your details, experience level, and motivation. Takes less than two minutes." },
    { section: "how-it-works", key: "step3_title", value: "Get Contacted" },
    { section: "how-it-works", key: "step3_text", value: "Our team reviews your application and reaches out to discuss next steps, scheduling, and any questions you have." },
    { section: "how-it-works", key: "step4_title", value: "Start Learning" },
    { section: "how-it-works", key: "step4_text", value: "Jump into hands-on classes with real projects. Build your skills week by week and leave with a professional portfolio." },
    // How You Learn
    { section: "how-you-learn", key: "badge", value: "How You Learn" },
    { section: "how-you-learn", key: "title", value: "A learning experience built around practice, not theory." },
    { section: "how-you-learn", key: "description", value: "From day one, you are editing, designing, and creating. That is how real skills are built." },
    { section: "how-you-learn", key: "step1_title", value: "Learn by Doing" },
    { section: "how-you-learn", key: "step1_text", value: "No long lectures. Every class is hands-on — you edit footage, design graphics, and build projects from the first session." },
    { section: "how-you-learn", key: "step2_title", value: "Work on Real Projects" },
    { section: "how-you-learn", key: "step2_text", value: "Practice with the same types of content professionals create daily — promos, social media videos, title sequences, and more." },
    { section: "how-you-learn", key: "step3_title", value: "Get Personal Feedback" },
    { section: "how-you-learn", key: "step3_text", value: "Instructors review your work one-on-one, point out what to improve, and guide you toward professional-level output." },
    { section: "how-you-learn", key: "step4_title", value: "Build Your Portfolio" },
    { section: "how-you-learn", key: "step4_text", value: "Leave the academy with a collection of polished projects ready to show employers, clients, or use for freelancing." },
    // Founders
    { section: "founders", key: "badge", value: "Meet the Founders" },
    { section: "founders", key: "name", value: "Nalik Academy" },
    { section: "founders", key: "role", value: "Founding Team" },
    { section: "founders", key: "bio", value: "A team of passionate media professionals dedicated to training the next generation of storytellers in Ethiopia. With years of hands-on experience in film, television, and digital content creation, we built Nalik Academy to bridge the gap between talent and opportunity in the creative industry." },
    { section: "founders", key: "image", value: "/assets/logo.jpeg" },
    // Contact
    { section: "contact", key: "badge", value: "Get in Touch" },
    { section: "contact", key: "title", value: "Ready to start your creative journey?" },
    { section: "contact", key: "description", value: "Have questions about our courses, schedules, or the application process? Reach out — we are happy to help." },
    { section: "contact", key: "phone", value: "+251 911 223 344" },
    { section: "contact", key: "whatsapp", value: "+251 911 223 344" },
    { section: "contact", key: "email", value: "info@nalikacademy.com" },
    { section: "contact", key: "location", value: "Addis Ababa, Ethiopia" },
    { section: "contact", key: "facebook", value: "https://facebook.com/nalikacademy" },
    { section: "contact", key: "instagram", value: "https://instagram.com/nalikacademy" },
    { section: "contact", key: "youtube", value: "https://youtube.com/@nalikacademy" },
    { section: "contact", key: "telegram", value: "https://t.me/nalikacademy" },
    // Footer
    { section: "footer", key: "tagline", value: "Professional media production training — filmmaking, video editing, and visual storytelling." },
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
      id: "adobe-illustrator-photoshop",
      title: "Adobe Illustrator + Photoshop",
      description: "Learn to create logos, thumbnails, social media assets, and print-ready designs from scratch.",
      price: "6,000 Birr",
      discountPrice: "4,800 Birr",
      discountLabel: "Opening Offer — 20% off",
      sortOrder: 1,
      published: true,
    },
    {
      id: "davinci-resolve",
      title: "DaVinci Resolve",
      description: "Professional color grading, editing, and audio finishing used on Hollywood productions.",
      price: "8,000 Birr",
      discountPrice: "6,500 Birr",
      discountLabel: "Opening Offer — 19% off",
      sortOrder: 2,
      published: true,
    },
    {
      id: "adobe-premiere",
      title: "Adobe Premiere",
      description: "Master professional video editing from timeline basics to advanced multicam workflows and export settings.",
      price: "8,000 Birr",
      discountPrice: "6,500 Birr",
      discountLabel: "Opening Offer — 19% off",
      sortOrder: 3,
      published: true,
    },
  ];

  for (const course of courses) {
    await prisma.course.upsert({
      where: { id: course.id },
      update: course,
      create: course,
    });
  }

  // ── Projects (Our Work) ──────────────────────────────
  const projects = [
    { id: "promo-reel-2024", title: "Promo Reel 2024", description: "A showcase of our academy's promotional content.", category: "Promotional", sortOrder: 1, published: true },
    { id: "student-showcase", title: "Student Showcase", description: "Highlighting the best work from our students.", category: "Documentary", sortOrder: 2, published: true },
    { id: "brand-story", title: "Brand Story", description: "Visual storytelling for brand identity.", category: "Commercial", sortOrder: 3, published: true },
    { id: "behind-the-scenes", title: "Behind the Scenes", description: "A look inside the Nalik Academy experience.", category: "Behind the Scenes", sortOrder: 4, published: true },
  ];

  for (const project of projects) {
    await prisma.project.upsert({
      where: { id: project.id },
      update: project,
      create: project,
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
