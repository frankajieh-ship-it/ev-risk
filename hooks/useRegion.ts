"use client";

import { useState, useEffect, useCallback } from "react";
import { type Region, detectRegion, REGION_CONFIGS } from "@/lib/region";

const STORAGE_KEY = "offo_region";
const COOKIE_KEY = "offo_region";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, maxAge: number) {
  document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${maxAge}; path=/; samesite=lax`;
}

export function useRegion() {
  const [region, setRegionState] = useState<Region>("US");

  useEffect(() => {
    // Priority: cookie (server-set via middleware) > localStorage > auto-detect
    const cookieRegion = getCookie(COOKIE_KEY) as Region | null;
    const storedRegion = localStorage.getItem(STORAGE_KEY) as Region | null;

    if (cookieRegion && REGION_CONFIGS[cookieRegion]) {
      setRegionState(cookieRegion);
      localStorage.setItem(STORAGE_KEY, cookieRegion);
    } else if (storedRegion && REGION_CONFIGS[storedRegion]) {
      setRegionState(storedRegion);
    } else {
      const detected = detectRegion();
      setRegionState(detected);
      localStorage.setItem(STORAGE_KEY, detected);
    }
  }, []);

  const setRegion = useCallback((r: Region) => {
    setRegionState(r);
    localStorage.setItem(STORAGE_KEY, r);
    setCookie(COOKIE_KEY, r, 365 * 24 * 60 * 60);
  }, []);

  const config = REGION_CONFIGS[region];

  return { region, setRegion, config };
}
