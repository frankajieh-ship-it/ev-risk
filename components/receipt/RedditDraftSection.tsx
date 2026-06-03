/**
 * RedditDraftSection — On-demand Reddit post generator
 *
 * Renders a "Generate Reddit Draft" button. On click, calls
 * POST /api/receipt/:id/generate/reddit_draft and displays the result.
 * Idempotent: if already generated, shows cached content immediately.
 */

"use client";

import { useState, useCallback } from "react";
import { MessageSquare, Copy, CheckCircle, Loader2, RefreshCw } from "lucide-react";
import { useEventTracking } from "@/hooks/useEventTracking";
import type { RedditDraft } from "@/types/receipt";

interface RedditDraftSectionProps {
  receiptId: string;
  initialDraft?: RedditDraft | null;
  initialStatus?: string; // "not_requested" | "ready" | "running" | "failed"
}

export default function RedditDraftSection({
  receiptId,
  initialDraft,
  initialStatus,
}: RedditDraftSectionProps) {
  const { trackEvent } = useEventTracking();
  const [status, setStatus] = useState<string>(
    initialDraft ? "ready" : (initialStatus ?? "not_requested")
  );
  const [draft, setDraft] = useState<RedditDraft | null>(initialDraft ?? null);
  const [copied, setCopied] = useState(false);

  const generate = useCallback(async () => {
    trackEvent("section_generate_clicked", { receipt_id: receiptId, section_name: "reddit_draft" });
    setStatus("running");
    const t0 = Date.now();

    try {
      const res = await fetch(`/api/receipt/${receiptId}/generate/reddit_draft`, {
        method: "POST",
      });
      const json = await res.json();

      if (json.success && json.data) {
        setDraft(json.data as RedditDraft);
        setStatus("ready");
        trackEvent("section_generate_succeeded", {
          receipt_id: receiptId,
          section_name: "reddit_draft",
          latency_ms: Date.now() - t0,
        });
      } else {
        setStatus("failed");
        trackEvent("section_generate_failed", {
          receipt_id: receiptId,
          section_name: "reddit_draft",
          reason: json.error ?? "unknown",
        });
      }
    } catch (err) {
      setStatus("failed");
      trackEvent("section_generate_failed", {
        receipt_id: receiptId,
        section_name: "reddit_draft",
        reason: err instanceof Error ? err.message : "network_error",
      });
    }
  }, [receiptId, trackEvent]);

  const copyText = useCallback(async () => {
    if (!draft) return;
    const text = renderDraftText(draft);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    trackEvent("section_copy_clicked", { receipt_id: receiptId, section_name: "reddit_draft" });
    setTimeout(() => setCopied(false), 2000);
  }, [draft, receiptId, trackEvent]);

  return (
    <div className="mt-4 rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-orange-500" />
          <span className="text-sm font-semibold text-gray-800">Reddit Draft</span>
          {status === "ready" && (
            <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Ready</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {status === "ready" && draft && (
            <button
              onClick={copyText}
              className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
            >
              {copied ? (
                <><CheckCircle className="w-3.5 h-3.5 text-green-500" /> Copied</>
              ) : (
                <><Copy className="w-3.5 h-3.5" /> Copy</>
              )}
            </button>
          )}
          {status === "failed" && (
            <button
              onClick={generate}
              className="flex items-center gap-1.5 text-xs text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retry
            </button>
          )}
        </div>
      </div>

      <div className="px-4 py-3">
        {status === "not_requested" && (
          <button
            onClick={generate}
            className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-orange-700 bg-orange-50 hover:bg-orange-100 rounded-lg border border-orange-200 transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
            Generate Reddit Draft
          </button>
        )}

        {status === "running" && (
          <div className="flex items-center justify-center gap-2 py-3 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Generating draft...
          </div>
        )}

        {status === "failed" && (
          <p className="text-sm text-red-600 py-2">
            Generation failed. Try again in a moment.
          </p>
        )}

        {status === "ready" && draft && (
          <div className="space-y-3 text-sm text-gray-700">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Title</p>
              <p className="font-medium text-gray-900">{draft.title}</p>
            </div>

            {Array.isArray(draft.body_facts) && draft.body_facts.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Facts</p>
                <ul className="space-y-1">
                  {draft.body_facts.map((fact, i) => (
                    <li key={i} className="text-gray-700">{fact}</li>
                  ))}
                </ul>
              </div>
            )}

            {Array.isArray(draft.body_uncertainty) && draft.body_uncertainty.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">What I couldn&apos;t confirm</p>
                <ul className="space-y-1">
                  {draft.body_uncertainty.map((u, i) => (
                    <li key={i} className="text-gray-600 italic">{u}</li>
                  ))}
                </ul>
              </div>
            )}

            {Array.isArray(draft.body_next_steps) && draft.body_next_steps.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Next steps</p>
                <ul className="space-y-1">
                  {draft.body_next_steps.map((s, i) => (
                    <li key={i} className="text-gray-700">{s}</li>
                  ))}
                </ul>
              </div>
            )}

            {Array.isArray(draft.questions) && draft.questions.length > 0 && (
              <div className="bg-orange-50 rounded-lg px-3 py-2">
                <p className="text-xs font-semibold text-orange-700 uppercase tracking-wide mb-1">Question</p>
                {draft.questions.map((q, i) => (
                  <p key={i} className="text-orange-900 font-medium">{q}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function renderDraftText(draft: RedditDraft): string {
  const parts: string[] = [draft.title, ""];

  if (draft.body_facts?.length) {
    parts.push(...draft.body_facts, "");
  }
  if (draft.body_uncertainty?.length) {
    parts.push("What I couldn't confirm:", ...draft.body_uncertainty, "");
  }
  if (draft.body_next_steps?.length) {
    parts.push(...draft.body_next_steps, "");
  }
  if (draft.questions?.length) {
    parts.push(...draft.questions);
  }

  return parts.join("\n").trim();
}
