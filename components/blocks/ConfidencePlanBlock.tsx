"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ConfidencePlan, ConfidenceAction } from "@/types/v2";

interface ConfidencePlanBlockProps {
  confidencePlan: ConfidencePlan;
  vehicle?: { make: string; model: string; year: number };
  trackEvent: (name: string, data?: Record<string, unknown>) => void;
}

const MODULE_COLORS: Record<string, { bg: string; text: string }> = {
  battery: { bg: "bg-blue-100", text: "text-blue-700" },
  warranty: { bg: "bg-purple-100", text: "text-purple-700" },
  recall: { bg: "bg-orange-100", text: "text-orange-700" },
  platform: { bg: "bg-gray-100", text: "text-gray-700" },
};

function CopyButton({
  text,
  actionId,
  trackEvent,
}: {
  text: string;
  actionId: string;
  trackEvent: ConfidencePlanBlockProps["trackEvent"];
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      trackEvent("confidence_action_copy", {
        action_id: actionId,
        content_type: "seller_message",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      trackEvent("confidence_action_copy", {
        action_id: actionId,
        content_type: "seller_message",
      });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors bg-white border-gray-200 hover:bg-gray-50 text-gray-700"
    >
      {copied ? (
        <>
          <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-green-600">Copied!</span>
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copy
        </>
      )}
    </button>
  );
}

function ModulePills({ modules }: { modules: ConfidenceAction["required_for_modules"] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {modules.map((mod) => {
        const colors = MODULE_COLORS[mod] ?? { bg: "bg-gray-100", text: "text-gray-700" };
        return (
          <span
            key={mod}
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}
          >
            {mod}
          </span>
        );
      })}
    </div>
  );
}

function ProgressBar({ current, potential }: { current: number; potential: number }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-gray-700">Report confidence</span>
        <span className="text-gray-500">
          {current}% <span className="text-gray-400">→</span> {potential}%
        </span>
      </div>
      <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
        {/* Potential (ghost) */}
        <div
          className="absolute inset-y-0 left-0 bg-green-100 rounded-full border border-green-200 border-dashed"
          style={{ width: `${potential}%` }}
        />
        {/* Current (solid) */}
        <div
          className="absolute inset-y-0 left-0 bg-green-500 rounded-full transition-all duration-500"
          style={{ width: `${current}%` }}
        />
      </div>
    </div>
  );
}

function ActionCard({
  action,
  index,
  defaultExpanded,
  trackEvent,
}: {
  action: ConfidenceAction;
  index: number;
  defaultExpanded: boolean;
  trackEvent: ConfidencePlanBlockProps["trackEvent"];
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full text-left p-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs font-bold flex items-center justify-center">
            {index + 1}
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 text-sm">{action.title}</p>
            <p className="text-xs text-green-600 font-medium">
              +{action.expected_confidence_gain_pct}% confidence
            </p>
          </div>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${expanded ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
              {/* Unlocks modules */}
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-400 font-medium mb-1">
                  Unlocks
                </p>
                <ModulePills modules={action.required_for_modules} />
              </div>

              {/* Why it matters */}
              <p className="text-xs text-gray-600 leading-relaxed">
                {action.why_it_matters}
              </p>

              {/* How to get */}
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-400 font-medium mb-1">
                  How to get it
                </p>
                <ul className="space-y-1">
                  {action.how_to_get.map((step, i) => (
                    <li key={i} className="text-xs text-gray-600 flex gap-2">
                      <span className="text-gray-400 flex-shrink-0">&#x2022;</span>
                      {step}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Seller message template */}
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs uppercase tracking-wide text-gray-400 font-medium">
                    Send to seller
                  </p>
                  <CopyButton
                    text={action.message_templates.seller}
                    actionId={action.id}
                    trackEvent={trackEvent}
                  />
                </div>
                <p className="text-xs text-gray-600 italic leading-relaxed">
                  &ldquo;{action.message_templates.seller}&rdquo;
                </p>
              </div>

              {/* Dealer template if exists */}
              {action.message_templates.dealer && (
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs uppercase tracking-wide text-gray-400 font-medium">
                      Send to dealer
                    </p>
                    <CopyButton
                      text={action.message_templates.dealer}
                      actionId={`${action.id}_dealer`}
                      trackEvent={trackEvent}
                    />
                  </div>
                  <p className="text-xs text-gray-600 italic leading-relaxed">
                    &ldquo;{action.message_templates.dealer}&rdquo;
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ConfidencePlanBlock({
  confidencePlan,
  trackEvent,
}: ConfidencePlanBlockProps) {
  if (confidencePlan.actions.length === 0) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
        Get to {confidencePlan.potential_pct}% confidence
      </h3>

      <ProgressBar
        current={confidencePlan.current_pct}
        potential={confidencePlan.potential_pct}
      />

      <div className="space-y-3">
        {confidencePlan.actions.map((action, i) => (
          <ActionCard
            key={action.id}
            action={action}
            index={i}
            defaultExpanded={i === 0}
            trackEvent={trackEvent}
          />
        ))}
      </div>
    </div>
  );
}
