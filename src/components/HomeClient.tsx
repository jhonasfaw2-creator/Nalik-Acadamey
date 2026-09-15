"use client";

import { useState, useCallback } from "react";
import Navbar from "@/components/Navbar";
import Hero from "@/sections/Hero";
import About from "@/sections/About";
import Courses from "@/sections/Courses";
import Founders from "@/sections/Founders";
import OurWork from "@/sections/OurWork";
import { CreatorsAndStreamers, BusinessCollaborators } from "@/sections/Collaborations";
import Contact from "@/sections/Contact";
import Footer from "@/components/Footer";
import ApplicationForm from "@/components/ApplicationForm";

export default function HomeClient() {
  const [formOpen, setFormOpen] = useState(false);
  const [preselectedCourse, setPreselectedCourse] = useState("");

  const openForm = useCallback(() => {
    setPreselectedCourse("");
    setFormOpen(true);
  }, []);

  const openFormWithCourse = useCallback((courseValue: string) => {
    setPreselectedCourse(courseValue);
    setFormOpen(true);
  }, []);

  const closeForm = useCallback(() => {
    setFormOpen(false);
    setPreselectedCourse("");
  }, []);

  return (
    <div id="home">
      <Navbar onApplyClick={openForm} />
      <Hero onApplyClick={openForm} />

      <About />
      <Courses onApplyWithCourse={openFormWithCourse} />
      <Founders />
      <OurWork />
      <CreatorsAndStreamers />
      <BusinessCollaborators />
      <Contact onApplyClick={openForm} />
      <Footer onApplyClick={openForm} />

      <ApplicationForm
        open={formOpen}
        onClose={closeForm}
        preselectedCourse={preselectedCourse}
      />
    </div>
  );
}
