/**
 * Seed the Turso production database with initial content.
 * Run: TURSO_URL=... TURSO_AUTH_TOKEN=... node scripts/seed-turso.mjs
 */

const TURSO_URL = process.env.TURSO_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_URL || !TURSO_TOKEN) {
  console.error("Set TURSO_URL and TURSO_AUTH_TOKEN env vars");
  process.exit(1);
}

const API_URL = TURSO_URL.replace("libsql://", "https://");

async function execute(sql) {
  const res = await fetch(`${API_URL}/v2/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TURSO_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ requests: [{ type: "execute", stmt: { sql } }] }),
  });
  const data = await res.json();
  if (data.results?.[0]?.type !== "ok") {
    console.error("Failed:", sql.substring(0, 60), data);
    return false;
  }
  return true;
}

const contentEntries = [
  { key: "hero", value: {"badge":"Nalik Academy — Creative Learning","heading":"Edit Your Vision.","headingHighlight":"Create Your Future.","description":"Master video editing, motion graphics, and creative technology with hands-on courses designed to launch your career in the creative industry.","ctaPrimary":"Explore Courses","ctaPrimaryLink":"/#courses","ctaSecondary":"Start Learning","video":"/videos/hero.mp4","poster":"/images/general/hero-poster.jpg"} },
  { key: "about", value: {"label":"About the Academy","title":"A New Academy.","titleHighlight":"Focused","description":"Nalik Academy is a new, focused video-editing academy built around one belief: that real skill comes from hands-on practice, not theory alone.","description2":"Created by an experienced editor and content creator, the academy trains students in DaVinci Resolve and Adobe Premiere Pro — the tools professionals actually use. Every lesson is designed around editing, storytelling, and the skills that matter in the creator economy.","video":"/videos/about.mp4","poster":"/images/general/about-poster.jpg","videoLabel":"Nalik Academy — Behind the Edit","cta":"Explore Programs","ctaLink":"/#courses","pillar1Label":"Editing","pillar1Desc":"Precision cuts, pacing, and timeline craft.","pillar2Label":"Storytelling","pillar2Desc":"Narrative structure that connects with audiences.","pillar3Label":"Creator Skills","pillar3Desc":"Workflows built for the modern content landscape."} },
  { key: "what_we_teach", value: {"eyebrow":"What We Teach","heading":"Turn Creativity Into a Skill.","subtitle":"The core disciplines every editor needs to master.","item1Title":"Video Editing","item1Desc":"Precision cuts, pacing, and timeline craft that shape raw footage into a compelling story.","item2Title":"Motion Graphics","item2Desc":"Dynamic animations, text effects, and visual elements that bring energy to every frame.","item3Title":"Color Grading","item3Desc":"Cinematic color correction and grading techniques that set the mood and tone of your work.","item4Title":"Audio & Sound","item4Desc":"Sound design, mixing, and audio cleanup that give your edits a polished, professional finish."} },
  { key: "featured_courses", value: {"eyebrow":"Our Programs","heading":"Learn. Create. Master.","subtitle":"Two focused programs designed to take you from beginner to professional editor.","viewAll":"View All Courses"} },
  { key: "founder", value: {"label":"The Founder","title":"Learn From Someone","titleHighlight":"Done It.","description":"Built by a professional video editor and content creator who has worked behind the scenes for established Ethiopian digital creators and TikTok creators — turning raw footage into compelling stories that reach real audiences.","description2":"This academy exists to pass on the exact skills, workflows, and creative thinking that power professional content — without the guesswork.","video":"/videos/founder.mp4","cta":"Meet the Founder","highlight1":"Video Editing","highlight2":"Storytelling","highlight3":"Content Creation","highlight4":"Industry Connections"} },
  { key: "our_work", value: {"title":"Work That","titleHighlight":"Inspires.","subtitle":"A look at the projects we have created. Real edits, built for real audiences."} },
  { key: "career_path", value: {"title":"Your Path to","titleHighlight":"Work-Ready","subtitle":"Nalik Academy focuses on developing strong video-editing skills and preparing students for career opportunities in the creative industry.","note":"High-performing students may have opportunities to be connected with potential first clients through the academy\u2019s network. This is an opportunity, not a guarantee.","step1Label":"Learn","step1Desc":"Master the fundamentals of video editing, motion design, and creative storytelling through structured lessons.","step2Label":"Practice","step2Desc":"Reinforce your skills with hands-on exercises and real-world editing challenges that build muscle memory.","step3Label":"Build Your Skills","step3Desc":"Develop a polished portfolio of professional-quality edits that showcase your creative and technical range.","step4Label":"Become Work-Ready","step4Desc":"Graduate with the confidence, workflows, and industry knowledge to take on freelance or team-based editing work."} },
  { key: "learning_process", value: {"title":"How You","titleHighlight":"Learn","subtitle":"A structured, skill-focused journey from first lesson to portfolio-ready editor.","note":"Built for skill. Every step is designed to develop your craft \u2014 no shortcuts, just focused, practical learning that prepares you for real creative work.","step1Label":"Choose Your Program","step1Desc":"Select a program that aligns with your goals \u2014 from DaVinci Resolve to Adobe Premiere Pro \u2014 and start with a clear roadmap.","step2Label":"Learn the Skills","step2Desc":"Follow structured lessons covering editing fundamentals, motion design, color grading, and creative storytelling.","step3Label":"Practice & Create","step3Desc":"Apply what you learn through hands-on projects, real footage, and exercises that build professional muscle memory.","step4Label":"Build Your Career","step4Desc":"Develop a portfolio of polished work and gain the confidence to pursue freelance or team-based editing opportunities."} },
  { key: "contact", value: {"title":"Let\u2019s Create Something Great.","subtitle":"Have questions about our programs? Ready to start your creative journey? Get in touch \u2014 we\u2019d love to hear from you.","phone":"+251 9XX XXX XXX","whatsapp":"+251911234567","whatsappMessage":"Hello! I\u2019m interested in Nalik Academy.","email":"info@nalikacademy.com","location":"Addis Ababa, Ethiopia","instagram":"https://instagram.com/nalikacademy","tiktok":"https://tiktok.com/@nalikacademy","facebook":"https://facebook.com/nalikacademy","formRecipientEmail":""} },
  { key: "final_cta", value: {"heading":"Ready to Start Editing?","description":"Develop professional video-editing skills and bring your creative vision to life with hands-on training from industry experts.","cta":"Join Nalik Academy","video":"/videos/hero.mp4","poster":"/images/general/editing-workspace.jpg"} },
  { key: "footer", value: {"facebook":"https://facebook.com/nalikacademy","instagram":"https://instagram.com/nalikacademy","youtube":"https://youtube.com/nalikacademy","telegram":"https://t.me/nalikacademy"} },
];

const portfolioItems = [
  { title: "Cinematic Brand", description: "Cinematic edit blending narrative pacing with visual storytelling.", videoSrc: "/videos/cinmatic vedio.mp4", sortOrder: 0 },
  { title: "Brand Focus", description: "Brand-focused content crafted for social media impact.", videoSrc: "/videos/brand focused.mp4", sortOrder: 1 },
  { title: "Showcase Reel", description: "A fast-paced reel showcasing editing rhythm and motion.", videoSrc: "/videos/shortshow.mp4", sortOrder: 2 },
  { title: "Content Edit", description: "Engaging short-form content built for viral reach.", videoSrc: "/videos/showcase.mp4", sortOrder: 3 },
];

async function seed() {
  console.log("Seeding Turso database...");

  for (let i = 0; i < contentEntries.length; i++) {
    const { key, value } = contentEntries[i];
    const id = `seed-${key}`;
    const sql = `INSERT OR REPLACE INTO "WebsiteContent" ("id", "key", "value", "updatedAt") VALUES ('${id}', '${key}', '${JSON.stringify(value).replace(/'/g, "''")}', datetime('now'))`;
    const ok = await execute(sql);
    console.log(`  ${ok ? "✓" : "✗"} ${key}`);
  }

  // Clear and re-seed portfolio
  await execute(`DELETE FROM "OurWork"`);
  for (let i = 0; i < portfolioItems.length; i++) {
    const item = portfolioItems[i];
    const id = `seed-portfolio-${i}`;
    const sql = `INSERT INTO "OurWork" ("id", "title", "description", "videoSrc", "posterImage", "sortOrder", "createdAt", "updatedAt") VALUES ('${id}', '${item.title.replace(/'/g, "''")}', '${item.description.replace(/'/g, "''")}', '${item.videoSrc.replace(/'/g, "''")}', '', ${item.sortOrder}, datetime('now'), datetime('now'))`;
    const ok = await execute(sql);
    console.log(`  ${ok ? "✓" : "✗"} portfolio: ${item.title}`);
  }

  console.log("\nDone! Database seeded with all content.");
}

seed().catch(console.error);
