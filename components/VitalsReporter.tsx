/**
 * Performance Monitoring - Web Vitals Reporter
 *
 * Purpose: Track Core Web Vitals (FCP, LCP, CLS, INP) for performance monitoring
 * Focus: Mobile-first optimization
 *
 * Metrics tracked:
 * - FCP (First Contentful Paint): Time to first content
 * - LCP (Largest Contentful Paint): Time to largest content
 * - CLS (Cumulative Layout Shift): Visual stability
 * - INP (Interaction to Next Paint): Responsiveness
 */

"use client";

import { useEffect, useState } from "react";
import { onCLS, onFCP, onINP, onLCP, onTTFB, type Metric } from "web-vitals";
import { debugLog, debugTable, isDebugEnabled } from "@/lib/debug";

/**
 * Web Vitals thresholds
 *
 * Good/Needs Improvement/Poor based on Chrome recommendations
 */
const VITALS_THRESHOLDS = {
  FCP: { good: 1800, poor: 3000 },
  LCP: { good: 2500, poor: 4000 },
  CLS: { good: 0.1, poor: 0.25 },
  INP: { good: 200, poor: 500 },
  TTFB: { good: 800, poor: 1800 },
};

/**
 * Get rating based on threshold
 */
function getRating(name: string, value: number): "good" | "needs-improvement" | "poor" {
  const threshold = VITALS_THRESHOLDS[name as keyof typeof VITALS_THRESHOLDS];
  if (!threshold) return "good";

  if (value <= threshold.good) return "good";
  if (value <= threshold.poor) return "needs-improvement";
  return "poor";
}

/**
 * Get color based on rating
 */
function getRatingColor(rating: string): string {
  switch (rating) {
    case "good":
      return "#10b981"; // green
    case "needs-improvement":
      return "#f59e0b"; // orange
    case "poor":
      return "#ef4444"; // red
    default:
      return "#6b7280"; // gray
  }
}

/**
 * Send metric to analytics endpoint (future)
 */
function sendToAnalytics(metric: Metric) {
  // Future: POST to /api/vitals
  // For now: just log in debug mode

  const rating = getRating(metric.name, metric.value);
  const color = getRatingColor(rating);

  debugLog(
    `%c📊 WEB_VITAL: ${metric.name}`,
    `color: ${color}; font-weight: bold;`,
    {
      value: `${metric.value.toFixed(2)}ms`,
      rating,
      id: metric.id,
      navigationType: metric.navigationType,
    }
  );
}

/**
 * VitalsReporter Component
 *
 * Tracks Web Vitals when debug mode is enabled
 */
export function VitalsReporter() {
  const [vitals, setVitals] = useState<Record<string, Metric>>({});

  useEffect(() => {
    if (!isDebugEnabled()) return;

    debugLog("🔍 Web Vitals monitoring started");

    // Attach listeners
    onCLS((metric) => {
      sendToAnalytics(metric);
      setVitals((prev) => ({ ...prev, CLS: metric }));
    });

    onFCP((metric) => {
      sendToAnalytics(metric);
      setVitals((prev) => ({ ...prev, FCP: metric }));
    });

    onLCP((metric) => {
      sendToAnalytics(metric);
      setVitals((prev) => ({ ...prev, LCP: metric }));
    });

    onINP((metric) => {
      sendToAnalytics(metric);
      setVitals((prev) => ({ ...prev, INP: metric }));
    });

    onTTFB((metric) => {
      sendToAnalytics(metric);
      setVitals((prev) => ({ ...prev, TTFB: metric }));
    });
  }, []);

  // Show vitals table when vitals are collected (debug mode only)
  useEffect(() => {
    if (!isDebugEnabled()) return;
    if (Object.keys(vitals).length === 0) return;

    // Log table after all initial vitals are collected
    if (vitals.FCP && vitals.LCP && vitals.CLS) {
      const summary = Object.entries(vitals).map(([name, metric]) => ({
        Metric: name,
        Value: `${metric.value.toFixed(2)}${name === "CLS" ? "" : "ms"}`,
        Rating: getRating(name, metric.value),
      }));

      debugTable(summary);
    }
  }, [vitals]);

  // No UI render (internal only)
  return null;
}

/**
 * VitalsDebugOverlay Component
 *
 * Optional: Shows vitals overlay in bottom-left corner (debug mode only)
 */
export function VitalsDebugOverlay() {
  const [vitals, setVitals] = useState<Record<string, Metric>>({});

  useEffect(() => {
    if (!isDebugEnabled()) return;

    onCLS((metric) => setVitals((prev) => ({ ...prev, CLS: metric })));
    onFCP((metric) => setVitals((prev) => ({ ...prev, FCP: metric })));
    onLCP((metric) => setVitals((prev) => ({ ...prev, LCP: metric })));
    onINP((metric) => setVitals((prev) => ({ ...prev, INP: metric })));
    onTTFB((metric) => setVitals((prev) => ({ ...prev, TTFB: metric })));
  }, []);

  if (!isDebugEnabled()) return null;
  if (Object.keys(vitals).length === 0) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 bg-gray-900 text-white p-3 rounded-lg shadow-lg text-xs font-mono max-w-xs">
      <div className="font-bold mb-2 text-blue-400">⚡ Web Vitals</div>
      <div className="space-y-1">
        {Object.entries(vitals).map(([name, metric]) => {
          const rating = getRating(name, metric.value);
          const color =
            rating === "good"
              ? "text-green-400"
              : rating === "needs-improvement"
              ? "text-orange-400"
              : "text-red-400";

          return (
            <div key={name} className="flex justify-between gap-2">
              <span className="text-gray-400">{name}:</span>
              <span className={color}>
                {metric.value.toFixed(2)}
                {name === "CLS" ? "" : "ms"}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 pt-2 border-t border-gray-700 text-xs text-gray-500">
        Add ?debug=0 to hide
      </div>
    </div>
  );
}

/**
 * Performance budget check
 *
 * Logs warnings when vitals exceed thresholds
 */
export function checkPerformanceBudget(vitals: Record<string, Metric>) {
  if (!isDebugEnabled()) return;

  const issues: string[] = [];

  Object.entries(vitals).forEach(([name, metric]) => {
    const rating = getRating(name, metric.value);
    if (rating === "poor") {
      issues.push(
        `${name}: ${metric.value.toFixed(2)}${name === "CLS" ? "" : "ms"} (threshold: ${
          VITALS_THRESHOLDS[name as keyof typeof VITALS_THRESHOLDS]?.good
        })`
      );
    }
  });

  if (issues.length > 0) {
    debugLog(
      "%c⚠️ Performance Budget Exceeded:",
      "color: #f59e0b; font-weight: bold;",
      issues
    );
  }
}
