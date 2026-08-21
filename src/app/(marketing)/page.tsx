import { Hero } from "@/components/sections/Hero";
import { AboutNalik } from "@/components/sections/AboutNalik";
import { WhatWeTeach } from "@/components/sections/WhatWeTeach";
import { FeaturedCourses } from "@/components/sections/FeaturedCourses";
import { CareerPath } from "@/components/sections/CareerPath";
import { FounderStory } from "@/components/sections/FounderStory";
import { OurWork } from "@/components/sections/OurWork";
import { LearningProcess } from "@/components/sections/LearningProcess";
import { ContactSection } from "@/components/sections/ContactSection";
import { FinalCTA } from "@/components/sections/FinalCTA";

export default function HomePage() {
  return (
    <main>
      <Hero />
      <AboutNalik />
      <WhatWeTeach />
      <FeaturedCourses />
      <CareerPath />
      <FounderStory />
      <OurWork />
      <LearningProcess />
      <ContactSection />
      <FinalCTA />
    </main>
  );
}
