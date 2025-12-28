/**
 * Performance Optimization Helpers
 *
 * Purpose: Mobile-first performance optimizations
 * Focus: Reduce bundle size, defer heavy loads, optimize rendering
 */

import { debugLog, debugWarn, debugMeasure } from "./debug";

/**
 * Lazy load component with error boundary
 *
 * Usage:
 * const HeavyChart = lazyLoad(() => import('./HeavyChart'));
 */
export function lazyLoad<T extends React.ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>,
  componentName?: string
) {
  const name = componentName || "LazyComponent";

  debugLog(`📦 Lazy loading: ${name}`);

  return React.lazy(async () => {
    const endMeasure = debugMeasure(`Lazy load: ${name}`);

    try {
      const module = await importFunc();
      endMeasure();
      return module;
    } catch (error) {
      endMeasure();
      debugWarn(`Failed to lazy load ${name}:`, error);
      throw error;
    }
  });
}

/**
 * Detect if user is on mobile device
 */
export function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;

  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

/**
 * Detect if user is on slow connection
 */
export function isSlowConnection(): boolean {
  if (typeof navigator === "undefined" || !("connection" in navigator)) {
    return false;
  }

  const conn = (navigator as any).connection;
  if (!conn) return false;

  // Effective types: "slow-2g", "2g", "3g", "4g"
  const slowTypes = ["slow-2g", "2g"];
  return slowTypes.includes(conn.effectiveType);
}

/**
 * Defer execution until browser is idle
 *
 * Uses requestIdleCallback if available, falls back to setTimeout
 */
export function runWhenIdle(callback: () => void, options?: { timeout?: number }) {
  if (typeof window === "undefined") {
    callback();
    return;
  }

  if ("requestIdleCallback" in window) {
    (window as any).requestIdleCallback(callback, options);
  } else {
    setTimeout(callback, 1);
  }
}

/**
 * Preload critical images
 *
 * Helps avoid layout shifts from late-loading images
 */
export function preloadImage(src: string, priority: "high" | "low" = "low") {
  if (typeof document === "undefined") return;

  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "image";
  link.href = src;

  if (priority === "high") {
    link.setAttribute("fetchpriority", "high");
  }

  document.head.appendChild(link);

  debugLog("🖼️ Preloading image:", src, { priority });
}

/**
 * Measure React component render time
 *
 * Usage:
 * const { startMeasure, endMeasure } = useRenderMeasure("MyComponent");
 * startMeasure();
 * // render logic
 * endMeasure();
 */
import { useCallback, useRef } from "react";

export function useRenderMeasure(componentName: string) {
  const startTimeRef = useRef<number>(0);

  const startMeasure = useCallback(() => {
    startTimeRef.current = performance.now();
  }, []);

  const endMeasure = useCallback(() => {
    if (startTimeRef.current === 0) return;

    const duration = performance.now() - startTimeRef.current;
    debugLog(`⏱️ ${componentName} render:`, `${duration.toFixed(2)}ms`);

    startTimeRef.current = 0;
  }, [componentName]);

  return { startMeasure, endMeasure };
}

/**
 * Optimize bundle by code splitting
 *
 * Example usage:
 * const ReportChart = optimizeBundle(() => import("./ReportChart"), {
 *   ssr: false,
 *   loading: () => <Spinner />,
 * });
 */
import dynamic from "next/dynamic";
import type { DynamicOptions, Loader } from "next/dynamic";

export function optimizeBundle<P = {}>(
  loader: Loader<P>,
  options?: DynamicOptions<P>
) {
  debugLog("🔧 Code splitting:", loader.name || "anonymous");

  return dynamic(loader, {
    ssr: options?.ssr ?? false,
    loading: options?.loading,
  });
}

/**
 * Detect and log heavy re-renders
 *
 * Usage: Add to component to track excessive re-renders
 */
export function useReRenderDetector(
  componentName: string,
  threshold: number = 10
) {
  const renderCountRef = useRef(0);
  const lastLogRef = useRef(Date.now());

  React.useEffect(() => {
    renderCountRef.current += 1;

    const now = Date.now();
    const timeSinceLastLog = now - lastLogRef.current;

    // Log if exceeded threshold within 1 second
    if (renderCountRef.current > threshold && timeSinceLastLog < 1000) {
      debugWarn(
        `⚠️ Excessive re-renders detected in ${componentName}:`,
        `${renderCountRef.current} renders in ${timeSinceLastLog}ms`
      );

      // Reset
      renderCountRef.current = 0;
      lastLogRef.current = now;
    }
  });
}

/**
 * Memoize expensive calculations with debug logging
 */
import * as React from "react";

export function useMemoWithLogging<T>(
  factory: () => T,
  deps: React.DependencyList,
  label: string
): T {
  return React.useMemo(() => {
    const endMeasure = debugMeasure(`useMemo: ${label}`);
    const result = factory();
    endMeasure();
    return result;
  }, deps);
}

/**
 * Performance budget checker
 *
 * Warns when bundle size or runtime exceeds limits
 */
export interface PerformanceBudget {
  maxBundleSize?: number; // KB
  maxRenderTime?: number; // ms
  maxMemoryUsage?: number; // MB
}

export function checkPerformanceBudget(budget: PerformanceBudget) {
  if (typeof window === "undefined") return;

  // Check render time (from FCP)
  const perfEntries = performance.getEntriesByType("paint");
  const fcp = perfEntries.find((entry) => entry.name === "first-contentful-paint");

  if (fcp && budget.maxRenderTime && fcp.startTime > budget.maxRenderTime) {
    debugWarn(
      "⚠️ Performance budget exceeded: Render time",
      `${fcp.startTime.toFixed(2)}ms > ${budget.maxRenderTime}ms`
    );
  }

  // Check memory (if available)
  if (
    "memory" in performance &&
    budget.maxMemoryUsage
  ) {
    const memoryMB = ((performance as any).memory.usedJSHeapSize / 1024 / 1024).toFixed(2);
    if (parseFloat(memoryMB) > budget.maxMemoryUsage) {
      debugWarn(
        "⚠️ Performance budget exceeded: Memory usage",
        `${memoryMB}MB > ${budget.maxMemoryUsage}MB`
      );
    }
  }
}

/**
 * Batch state updates to prevent excessive re-renders
 *
 * Usage:
 * const batchUpdate = useBatchUpdate();
 * batchUpdate(() => {
 *   setState1(val1);
 *   setState2(val2);
 *   setState3(val3);
 * });
 */
import { unstable_batchedUpdates } from "react-dom";

export function useBatchUpdate() {
  return React.useCallback((callback: () => void) => {
    unstable_batchedUpdates(callback);
  }, []);
}
