"use client";

import { useState, useEffect, useCallback } from "react";
import { type Region, detectRegion, REGION_CONFIGS } from "@/lib/region";

const STORAGE_KEY = "offo_region";

export function useRegion() {
  const [region, setRegionState] = useState<Region>("US");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Region | null;
    if (stored && REGION_CONFIGS[stored]) {
      setRegionState(stored);
    } else {
      const detected = detectRegion();
      setRegionState(detected);
      localStorage.setItem(STORAGE_KEY, detected);
    }
  }, []);

  const setRegion = useCallback((r: Region) => {
    setRegionState(r);
    localStorage.setItem(STORAGE_KEY, r);
  }, []);

  const config = REGION_CONFIGS[region];

  return { region, setRegion, config };
}
