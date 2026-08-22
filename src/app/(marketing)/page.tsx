import dynamic from "next/dynamic";
import { Hero } from "@/components/sections/Hero";

// Below-fold sections: dynamically imported for JS code-splitting.
// Server still renders the HTML for SEO; the client hydrates when the chunk loads.
const AboutNalik = dynamic(() =>
  import("@/components/sections/AboutNalik").then((m) => m.AboutNalik)
);
const WhatWeTeach = dynamic(() =>
  import("@/components/sections/WhatWeTeach").then((m) => m.WhatWeTeach)
);
const FeaturedCourses = dynamic(() =>
  import("@/components/sections/FeaturedCourses").then(
    (m) => m.FeaturedCourses
  )
);
const CareerPath = dynamic(() =>
  import("@/components/sections/CareerPath").then((m) => m.CareerPath)
);
const FounderStory = dynamic(() =>
  import("@/components/sections/FounderStory").then((m) => m.FounderStory)
);
const OurWork = dynamic(() =>
  import("@/components/sections/OurWork").then((m) => m.OurWork)
);
const LearningProcess = dynamic(() =>
  import("@/components/sections/LearningProcess").then(
    (m) => m.LearningProcess
  )
);
const ContactSection = dynamic(() =>
  import("@/components/sections/ContactSection").then(
    (m) => m.ContactSection
  )
);
const FinalCTA = dynamic(() =>
  import("@/components/sections/FinalCTA").then((m) => m.FinalCTA)
);

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
