"use client";

import { createContext, useContext, useCallback, useState, type ReactNode } from "react";
import ApplicationForm from "@/components/ApplicationForm";

interface ApplicationFormContextValue {
  formOpen: boolean;
  preselectedCourse: string;
  openForm: () => void;
  openFormWithCourse: (courseValue: string) => void;
  closeForm: () => void;
}

const ApplicationFormContext = createContext<ApplicationFormContextValue | undefined>(undefined);

export function ApplicationFormProvider({ children }: { children: ReactNode }) {
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
    <ApplicationFormContext.Provider value={{ formOpen, preselectedCourse, openForm, openFormWithCourse, closeForm }}>
      {children}
      <ApplicationForm open={formOpen} onClose={closeForm} preselectedCourse={preselectedCourse} />
    </ApplicationFormContext.Provider>
  );
}

export function useApplicationForm() {
  const ctx = useContext(ApplicationFormContext);
  if (!ctx) throw new Error("useApplicationForm must be used within ApplicationFormProvider");
  return ctx;
}
