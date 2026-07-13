"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { CheckCircle, XCircle, AlertCircle, Camera, ChevronDown, Lock, Zap } from "lucide-react";
import { REQUIRED_ANGLES } from "@/lib/photo-due-diligence-types";
import type { PhotoAnalysisResult, DamageFinding } from "@/lib/photo-due-diligence-types";

interface Props {
  receiptId: string;
  photoUrls: string[];
  /** Called when user clicks a damage finding — highlights that photo index in the carousel */
  onHighlightPhoto?: (index: number) => void;
  isUnlocked?: boolean;
  isStarterUnlocked?: boolean;
  paymentsEnabled?: boolean;
  onPaywallClick?: () => void;
}

type JobStatus = "pending" | "processing" | "done" | "failed";

const SEVERITY_STYLES: Record<DamageFinding["severity"], { dot: string; label: string }> = {
  minor:    { dot: "bg-yellow-400",  label: "Minor"    },
  moderate: { dot: "bg-orange-400",  label: "Moderate" },
  severe:   { dot: "bg-red-400",     label: "Severe"   },
};

export default function PhotoDueDiligenceCard({ receiptId, photoUrls, onHighlightPhoto, isUnlocked, isStarterUnlocked, paymentsEnabled, onPaywallClick }: Props) {
  // Start as pending — component only renders when photos are present
  const [status, setStatus] = useState<JobStatus>("pending");
  const [jobId, setJobId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<PhotoAnalysisResult | null>(null);
  const [open, setOpen] = useState(true);
  const enqueuedDataCountRef = useRef(0);
  const enqueuedScrapedCountRef = useRef(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const enqueuedRef = useRef(false);
  const pollCountRef = useRef(0);
  const MAX_POLLS = 200; // 10 minutes at 3s intervals

  const enqueueAnalysis = useCallback(async (urls: string[]) => {
    // Send raw URLs (local paths or CDN https://) to enqueue — the background
    // function fetches them server-side via /api/img proxy. Do NOT convert to
    // base64 here: 20 images at 1024px JPEG would be ~40MB, blowing Netlify's
    // 6MB request body limit. Filter out any data: URIs (user-uploaded photos
    // captured inline by canvas — those can't be fetched server-side anyway).
    const rawUrls = urls
      .slice(0, 20)
      .filter((u) => typeof u === "string" && !u.startsWith("data:") && u.length > 0);

    if (rawUrls.length === 0) return;

    // Defer state resets out of effect body to avoid lint setState-in-effect error
    setTimeout(() => {
      setStatus("pending");
      setAnalysis(null);
      setJobId(null);
    }, 0);
    fetch("/api/receipt/photo-analysis/enqueue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receipt_id: receiptId, photo_urls: rawUrls }),
    })
      .then((r) => r.json())
      .then((data: { job_id?: string; status?: string; photo_analysis?: PhotoAnalysisResult }) => {
        if (data.job_id) {
          setJobId(data.job_id);
          if (data.status === "done" && data.photo_analysis) {
            setAnalysis(data.photo_analysis);
            setStatus("done");
          } else {
            setStatus((data.status as JobStatus) || "pending");
          }
        }
      })
      .catch(() => setStatus("failed"));
  }, [receiptId]);

  // Enqueue on mount (idempotent). Initialize ref counts so re-enqueue effect
  // can correctly detect when new photos are added after initial analysis.
  useEffect(() => {
    if (photoUrls.length === 0 || enqueuedRef.current) return;
    enqueuedRef.current = true;
    enqueuedDataCountRef.current = photoUrls.filter(u => u.startsWith("data:")).length;
    enqueuedScrapedCountRef.current = photoUrls.filter(u => !u.startsWith("data:")).length;
    enqueueAnalysis(photoUrls);
  }, [receiptId, photoUrls, enqueueAnalysis]);

  // Re-enqueue when photos change — either user-uploaded (data: URLs) or new scraped photos
  useEffect(() => {
    const dataCount = photoUrls.filter(u => u.startsWith("data:")).length;
    const scrapedCount = photoUrls.filter(u => !u.startsWith("data:")).length;
    const dataGrew = dataCount > enqueuedDataCountRef.current;
    const scrapedGrew = scrapedCount > enqueuedScrapedCountRef.current;
    if ((dataGrew || scrapedGrew) && enqueuedRef.current) {
      enqueuedDataCountRef.current = dataCount;
      enqueuedScrapedCountRef.current = scrapedCount;
      pollCountRef.current = 0;
      enqueueAnalysis(photoUrls);
    }
  }, [photoUrls, enqueueAnalysis]);

  // Poll for completion
  useEffect(() => {
    if (!jobId || status === "done" || status === "failed") return;

    pollRef.current = setInterval(() => {
      pollCountRef.current += 1;
      if (pollCountRef.current >= MAX_POLLS) {
        clearInterval(pollRef.current!);
        setStatus("failed");
        return;
      }
      fetch(`/api/receipt/photo-analysis/status?job_id=${jobId}`)
        .then((r) => r.json())
        .then((data: { status?: string; photo_analysis?: PhotoAnalysisResult }) => {
          // Apply partial results in real-time — every poll tick that has data updates the UI
          if (data.photo_analysis) setAnalysis(data.photo_analysis);
          if (data.status === "done") {
            clearInterval(pollRef.current!);
            setStatus("done");
          } else if (data.status === "failed") {
            clearInterval(pollRef.current!);
            setStatus("failed");
          } else {
            setStatus((data.status as JobStatus) || "processing");
          }
        })
        .catch(() => {});
    }, 3_000);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [jobId, status]);

  if (photoUrls.length === 0) {
    return (
      <div className="border-b border-white/[0.08] bg-[#0d1117] px-5 py-2.5">
        <div className="flex items-center gap-2">
          <Camera className="w-3.5 h-3.5 text-white/20" />
          <span className="text-xs font-semibold text-white/20 uppercase tracking-widest">Photo Analysis</span>
          <span className="text-xs text-white/15 ml-1">— drag listing photos above to begin</span>
        </div>
      </div>
    );
  }

  // Paywall gate — photos present but user hasn't paid starter tier ($3.99+)
  const isLocked = paymentsEnabled && !isStarterUnlocked;
  if (isLocked) {
    return (
      <div className="border-b border-white/[0.08] bg-[#0d1117]">
        <div className="px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <Lock className="w-3.5 h-3.5 text-white/30" />
            <span className="text-xs font-semibold text-white/30 uppercase tracking-widest">Photo Analysis</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/[0.06] text-white/30">
              {photoUrls.length} photo{photoUrls.length !== 1 ? "s" : ""} ready
            </span>
          </div>
          {/* Blurred preview rows */}
          <div className="space-y-1.5 mb-4 select-none pointer-events-none">
            {REQUIRED_ANGLES.slice(0, 4).map((angle) => (
              <div key={angle.id} className="flex items-center gap-2 blur-sm opacity-40">
                <span className="w-3.5 h-3.5 rounded-full bg-white/10 flex-shrink-0" />
                <span className="text-sm text-white/50">{angle.label}</span>
              </div>
            ))}
          </div>
          <button
            onClick={onPaywallClick}
            className="flex items-center gap-2 text-xs font-semibold text-[#00d97e] hover:text-[#00c970] transition-colors"
          >
            <Zap className="w-3.5 h-3.5" />
            Unlock photo analysis — $3.99
          </button>
        </div>
      </div>
    );
  }

  // Find photo index for a given url (for highlight callback)
  const indexForUrl = (url: string) => {
    const i = photoUrls.indexOf(url);
    return i >= 0 ? i : 0;
  };

  return (
    <div className="border-b border-white/[0.08] bg-[#0d1117]">
      {/* Header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Camera className="w-3.5 h-3.5 text-white/40" />
          <span className="text-xs font-semibold text-white/40 uppercase tracking-widest">
            Photo Analysis
          </span>
          {status === "done" && analysis && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/[0.06] text-white/50 font-medium">
              {analysis.coverage.coverage_score}% coverage
            </span>
          )}
          {(status === "pending" || status === "processing") && (
            <span className="flex items-center gap-1 text-xs text-white/40">
              <span className="inline-block w-3 h-3 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
              {analysis?.photos.length
                ? `Analysed ${analysis.photos.length} of ${photoUrls.length}…`
                : "Analysing…"}
            </span>
          )}
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-white/30 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="px-5 pb-4 space-y-4">
          {/* Coverage checklist */}
          <div>
            <p className="text-xs font-medium text-white/50 mb-2">Due Diligence Coverage</p>
            <div className="grid grid-cols-1 gap-1">
              {REQUIRED_ANGLES.map((angle) => {
                const present = analysis?.coverage.present.includes(angle.id);
                const loading = status === "pending" || status === "processing";

                return (
                  <div key={angle.id} className="flex items-center gap-2">
                    {loading ? (
                      <span className="w-3.5 h-3.5 rounded-full bg-white/10 animate-pulse flex-shrink-0" />
                    ) : present ? (
                      <CheckCircle className="w-3.5 h-3.5 text-[#00d97e] flex-shrink-0" />
                    ) : (
                      <XCircle className={`w-3.5 h-3.5 flex-shrink-0 ${angle.required ? "text-orange-400" : "text-white/25"}`} />
                    )}
                    <span className={`text-sm ${loading ? "text-white/30" : present ? "text-white/70" : angle.required ? "text-orange-300/80" : "text-white/30"}`}>
                      {angle.label}
                    </span>
                    {!loading && !present && (
                      <span className="text-xs text-white/30 ml-auto">Not shown</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Damage findings */}
          {status === "done" && analysis && analysis.total_findings > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-3.5 h-3.5 text-orange-400" />
                <p className="text-xs font-medium text-white/50">
                  Condition Findings
                </p>
                {analysis.severe_findings > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 font-medium">
                    {analysis.severe_findings} severe
                  </span>
                )}
              </div>
              <ul className="space-y-2">
                {analysis.photos
                  .flatMap((p) =>
                    p.findings.map((f) => ({ ...f, photoUrl: p.url, angle: p.angle_id }))
                  )
                  .map((finding, i) => {
                    const sev = SEVERITY_STYLES[finding.severity];
                    return (
                      <li
                        key={i}
                        className={`flex items-start gap-2 text-sm text-white/70 ${onHighlightPhoto ? "cursor-pointer hover:text-white/90 transition-colors" : ""}`}
                        onClick={() => onHighlightPhoto?.(indexForUrl(finding.photoUrl))}
                      >
                        <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${sev.dot}`} />
                        <span className="flex-1">
                          <span className="text-white/40 text-xs mr-1">{sev.label}</span>
                          {finding.description}
                        </span>
                        {finding.affects_value && (
                          <span className="text-xs text-orange-400/80 whitespace-nowrap mt-0.5">↓ value</span>
                        )}
                      </li>
                    );
                  })}
              </ul>
              {analysis.photos.flatMap((p) => p.findings).filter((f) => f.affects_value).length > 0 && (
                <p className="text-xs text-white/30 mt-2">
                  Tap a finding to view that photo
                </p>
              )}
            </div>
          )}

          {status === "done" && analysis && analysis.total_findings === 0 && (
            <p className="text-sm text-[#00d97e]/80 flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5" />
              No visible damage detected
            </p>
          )}

          {status === "failed" && (
            <p className="text-sm text-white/40 italic">Photo analysis unavailable — try again later.</p>
          )}
        </div>
      )}
    </div>
  );
}
