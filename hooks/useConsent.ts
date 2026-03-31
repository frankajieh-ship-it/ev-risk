"use client";

import { useState, useEffect } from "react";

export type ConsentState = "granted" | "denied" | null;

const CONSENT_KEY = "offo_cookie_consent";

export function useConsent() {
  const [consent, setConsent] = useState<ConsentState>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(CONSENT_KEY) as ConsentState | null;
      if (stored === "granted" || stored === "denied") {
        setConsent(stored);
      }
    } catch {
      // localStorage unavailable
    }
  }, []);

  const grant = () => {
    try {
      localStorage.setItem(CONSENT_KEY, "granted");
    } catch {}
    setConsent("granted");
  };

  const deny = () => {
    try {
      localStorage.setItem(CONSENT_KEY, "denied");
    } catch {}
    setConsent("denied");
  };

  return { consent, grant, deny };
}
