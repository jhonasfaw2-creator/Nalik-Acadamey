"use client";

import { useApplicationForm } from "@/components/ApplicationFormProvider";
import Hero from "@/sections/Hero";
import About from "@/sections/About";
import Courses from "@/sections/Courses";
import Founders from "@/sections/Founders";
import OurWork from "@/sections/OurWork";
import Collaborations from "@/sections/Collaborations";
import Contact from "@/sections/Contact";

export default function HomePage() {
  const { openForm, openFormWithCourse } = useApplicationForm();

  return (
    <main>
      <Hero onApplyClick={openForm} />
      <About onApplyClick={openForm} />
      <Courses onApplyWithCourse={openFormWithCourse} />
      <Founders onApplyClick={openForm} />
      <OurWork onApplyClick={openForm} />
      <Collaborations />
      <Contact onApplyClick={openForm} />
    </main>
  );
}
