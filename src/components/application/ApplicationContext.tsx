"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

interface ApplicationContextValue {
  isOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
}

const ApplicationContext = createContext<ApplicationContextValue | null>(null);

export function ApplicationProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const openModal = useCallback(() => setIsOpen(true), []);
  const closeModal = useCallback(() => setIsOpen(false), []);

  return (
    <ApplicationContext.Provider value={{ isOpen, openModal, closeModal }}>
      {children}
    </ApplicationContext.Provider>
  );
}

export function useApplicationModal() {
  const ctx = useContext(ApplicationContext);
  if (!ctx) {
    throw new Error("useApplicationModal must be used within an ApplicationProvider");
  }
  return ctx;
}
