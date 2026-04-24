"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import { useTutorialContext } from "./TutorialProvider";
import type { TutorialPlacement } from "./steps";

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PADDING = 8; // spotlight padding around target element
const TOOLTIP_WIDTH = 300;
const TOOLTIP_OFFSET = 14; // gap between spotlight edge and tooltip

function getTooltipPosition(
  rect: Rect,
  placement: TutorialPlacement,
  isMobile: boolean
): { top: number; left: number } {
  if (isMobile) {
    // Always bottom-center on mobile
    return {
      top: rect.top + rect.height + PADDING + TOOLTIP_OFFSET,
      left: Math.max(12, window.innerWidth / 2 - TOOLTIP_WIDTH / 2),
    };
  }

  const spotTop = rect.top - PADDING;
  const spotBottom = rect.top + rect.height + PADDING;
  const spotLeft = rect.left - PADDING;
  const spotRight = rect.left + rect.width + PADDING;
  const spotCenterX = rect.left + rect.width / 2;
  const spotCenterY = rect.top + rect.height / 2;

  switch (placement) {
    case "bottom":
      return {
        top: spotBottom + TOOLTIP_OFFSET,
        left: Math.max(12, spotCenterX - TOOLTIP_WIDTH / 2),
      };
    case "top":
      return {
        top: spotTop - TOOLTIP_OFFSET - 160, // approx tooltip height
        left: Math.max(12, spotCenterX - TOOLTIP_WIDTH / 2),
      };
    case "right":
      return {
        top: spotCenterY - 80,
        left: spotRight + TOOLTIP_OFFSET,
      };
    case "left":
      return {
        top: spotCenterY - 80,
        left: Math.max(12, spotLeft - TOOLTIP_WIDTH - TOOLTIP_OFFSET),
      };
  }
}

function SpotlightCutout({ rect }: { rect: Rect }) {
  const pad = PADDING;
  return (
    <div
      className="absolute rounded-xl pointer-events-none"
      style={{
        top: rect.top - pad + window.scrollY,
        left: rect.left - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
        boxShadow: "0 0 0 9999px rgba(0,0,0,0.72)",
        zIndex: 1,
      }}
    />
  );
}

export function TutorialSpotlight() {
  const { active, step, currentStepDef, totalSteps, next, dismiss } =
    useTutorialContext();
  const pathname = usePathname();
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const pulseCleanupRef = useRef<(() => void) | null>(null);

  const findTarget = useCallback(() => {
    if (!currentStepDef) return;
    const el = document.querySelector(
      `[data-tutorial="${currentStepDef.target}"]`
    ) as HTMLElement | null;
    if (!el) {
      setTargetRect(null);
      return;
    }

    // Scroll element into view
    el.scrollIntoView({ behavior: "smooth", block: "center" });

    // Wait for scroll to settle before measuring
    setTimeout(() => {
      const rect = el.getBoundingClientRect();
      setTargetRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    }, 350);

    // Add pulse ring
    el.classList.add(
      "ring-2",
      "ring-[#00d97e]",
      "ring-offset-2",
      "ring-offset-transparent",
      "rounded-xl",
      "transition-shadow"
    );
    pulseCleanupRef.current = () => {
      el.classList.remove(
        "ring-2",
        "ring-[#00d97e]",
        "ring-offset-2",
        "ring-offset-transparent",
        "rounded-xl",
        "transition-shadow"
      );
    };
  }, [currentStepDef]);

  // Recalculate on step change, pathname change, or resize
  useEffect(() => {
    if (!active || !currentStepDef) return;

    // Only show spotlight if current step's page matches
    const stepPage = currentStepDef.page;
    const onCorrectPage =
      stepPage === pathname ||
      (stepPage !== "/" && pathname.startsWith(stepPage));

    if (!onCorrectPage) {
      // Defer setState to avoid synchronous setState-in-effect lint error
      const t = setTimeout(() => setTargetRect(null), 0);
      return () => clearTimeout(t);
    }

    // Cleanup previous pulse
    if (pulseCleanupRef.current) {
      pulseCleanupRef.current();
      pulseCleanupRef.current = null;
    }

    // Defer initial state updates to satisfy react-hooks/set-state-in-effect
    const initTimer = setTimeout(() => {
      setIsMobile(window.innerWidth < 640);
      findTarget();
    }, 0);

    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
      findTarget();
    };
    window.addEventListener("resize", handleResize);
    return () => {
      clearTimeout(initTimer);
      window.removeEventListener("resize", handleResize);
      if (pulseCleanupRef.current) {
        pulseCleanupRef.current();
        pulseCleanupRef.current = null;
      }
    };
  }, [active, step, pathname, findTarget, currentStepDef]);

  if (!active || !currentStepDef) return null;

  // Don't render overlay if we're on the wrong page for this step
  const stepPage = currentStepDef.page;
  const onCorrectPage =
    stepPage === pathname ||
    (stepPage !== "/" && pathname.startsWith(stepPage));
  if (!onCorrectPage) return null;

  const tooltipPos =
    targetRect
      ? getTooltipPosition(targetRect, currentStepDef.placement, isMobile)
      : { top: window.innerHeight / 2 - 100, left: window.innerWidth / 2 - TOOLTIP_WIDTH / 2 };

  return (
    <AnimatePresence>
      <motion.div
        key={`tutorial-overlay-${step}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9998] pointer-events-none"
        aria-hidden="true"
      >
        {/* Overlay backdrop — only rendered if we have a target */}
        {targetRect && <SpotlightCutout rect={targetRect} />}

        {/* Clickable overlay (outside spotlight) to skip */}
        <div
          className="absolute inset-0 pointer-events-auto"
          style={{ zIndex: 0 }}
        />
      </motion.div>

      {/* Tooltip card — rendered outside the overlay so it's always interactive */}
      <motion.div
        key={`tutorial-tooltip-${step}`}
        initial={{ opacity: 0, y: 8, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 4, scale: 0.98 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="fixed z-[9999] pointer-events-auto"
        style={{
          top: tooltipPos.top,
          left: tooltipPos.left,
          width: TOOLTIP_WIDTH,
        }}
      >
        <div className="bg-[#161b22] border border-white/[0.12] rounded-2xl p-4 shadow-2xl shadow-black/60">
          {/* Step counter */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-[#00d97e]">
              Step {step + 1} of {totalSteps}
            </span>
            <button
              onClick={dismiss}
              className="text-white/30 hover:text-white/60 transition-colors text-xs"
              aria-label="Skip tutorial"
            >
              Skip
            </button>
          </div>

          {/* Progress bar */}
          <div className="h-0.5 bg-white/[0.08] rounded-full mb-3 overflow-hidden">
            <div
              className="h-full bg-[#00d97e] rounded-full transition-all duration-300"
              style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
            />
          </div>

          {/* Content */}
          <h4 className="text-sm font-semibold text-white mb-1.5 leading-snug">
            {currentStepDef.title}
          </h4>
          <p className="text-xs text-white/60 leading-relaxed mb-4">
            {currentStepDef.body}
          </p>

          {/* Actions */}
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={dismiss}
              className="text-xs text-white/30 hover:text-white/50 transition-colors"
            >
              Don&apos;t show again
            </button>
            <button
              onClick={next}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#00d97e] text-black text-xs font-semibold hover:bg-[#00c270] transition-colors"
            >
              {currentStepDef.cta ?? "Next →"}
            </button>
          </div>
        </div>

        {/* Caret pointer */}
        {targetRect && !isMobile && (
          <CaretPointer placement={currentStepDef.placement} />
        )}
      </motion.div>
    </AnimatePresence>
  );
}

function CaretPointer({ placement }: { placement: TutorialPlacement }) {
  const base = "absolute w-0 h-0 border-solid";
  const caretColor = "#161b22";
  const borderColor = "rgba(255,255,255,0.12)";

  if (placement === "bottom") {
    return (
      <div className={`${base} -top-2 left-1/2 -translate-x-1/2`}>
        <div
          style={{
            width: 0,
            height: 0,
            borderLeft: "8px solid transparent",
            borderRight: "8px solid transparent",
            borderBottom: `10px solid ${borderColor}`,
          }}
        />
        <div
          style={{
            width: 0,
            height: 0,
            borderLeft: "7px solid transparent",
            borderRight: "7px solid transparent",
            borderBottom: `9px solid ${caretColor}`,
            position: "absolute",
            top: 2,
            left: -7,
          }}
        />
      </div>
    );
  }
  if (placement === "top") {
    return (
      <div className={`${base} -bottom-2 left-1/2 -translate-x-1/2`}>
        <div
          style={{
            width: 0,
            height: 0,
            borderLeft: "8px solid transparent",
            borderRight: "8px solid transparent",
            borderTop: `10px solid ${borderColor}`,
          }}
        />
        <div
          style={{
            width: 0,
            height: 0,
            borderLeft: "7px solid transparent",
            borderRight: "7px solid transparent",
            borderTop: `9px solid ${caretColor}`,
            position: "absolute",
            bottom: 2,
            left: -7,
          }}
        />
      </div>
    );
  }
  if (placement === "right") {
    return (
      <div className={`${base} top-8 -left-2`}>
        <div
          style={{
            width: 0,
            height: 0,
            borderTop: "8px solid transparent",
            borderBottom: "8px solid transparent",
            borderRight: `10px solid ${borderColor}`,
          }}
        />
        <div
          style={{
            width: 0,
            height: 0,
            borderTop: "7px solid transparent",
            borderBottom: "7px solid transparent",
            borderRight: `9px solid ${caretColor}`,
            position: "absolute",
            top: -7,
            left: 2,
          }}
        />
      </div>
    );
  }
  if (placement === "left") {
    return (
      <div className={`${base} top-8 -right-2`}>
        <div
          style={{
            width: 0,
            height: 0,
            borderTop: "8px solid transparent",
            borderBottom: "8px solid transparent",
            borderLeft: `10px solid ${borderColor}`,
          }}
        />
        <div
          style={{
            width: 0,
            height: 0,
            borderTop: "7px solid transparent",
            borderBottom: "7px solid transparent",
            borderLeft: `9px solid ${caretColor}`,
            position: "absolute",
            top: -7,
            right: 2,
          }}
        />
      </div>
    );
  }
  return null;
}
