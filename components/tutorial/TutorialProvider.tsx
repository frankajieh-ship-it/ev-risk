"use client";

import { createContext, useContext } from "react";
import { useTutorial } from "@/hooks/useTutorial";
import { TutorialSpotlight } from "./TutorialSpotlight";

type TutorialContextValue = ReturnType<typeof useTutorial>;

const TutorialContext = createContext<TutorialContextValue | null>(null);

export function useTutorialContext(): TutorialContextValue {
  const ctx = useContext(TutorialContext);
  if (!ctx) throw new Error("useTutorialContext must be used inside TutorialProvider");
  return ctx;
}

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const tutorial = useTutorial();

  return (
    <TutorialContext.Provider value={tutorial}>
      {children}
      {tutorial.mounted && tutorial.active && <TutorialSpotlight />}
    </TutorialContext.Provider>
  );
}
