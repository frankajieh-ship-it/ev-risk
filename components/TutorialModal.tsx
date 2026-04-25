"use client";

import { useState, useRef, useEffect } from "react";
import { X, Play, HelpCircle } from "lucide-react";

interface TutorialModalProps {
  /** If true, show a persistent floating "?" button. Default true. */
  showTrigger?: boolean;
}

export default function TutorialModal({ showTrigger = true }: TutorialModalProps) {
  const [open, setOpen] = useState(false);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasShownTooltip = useRef(false);

  // Auto-show tooltip once after 4s if user hasn't interacted yet
  useEffect(() => {
    if (!showTrigger || hasShownTooltip.current) return;
    const t = setTimeout(() => {
      setTooltipVisible(true);
      hasShownTooltip.current = true;
      // Auto-dismiss after 5s
      setTimeout(() => setTooltipVisible(false), 5000);
    }, 4000);
    return () => clearTimeout(t);
  }, [showTrigger]);

  const handleOpen = () => {
    setOpen(true);
    setTooltipVisible(false);
    setPlaying(false);
  };

  const handleClose = () => {
    setOpen(false);
    setPlaying(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  const handlePlay = () => {
    setPlaying(true);
    videoRef.current?.play();
  };

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <>
      {/* Floating trigger button */}
      {showTrigger && (
        <div className="fixed bottom-24 right-4 z-40 flex flex-col items-end gap-2">
          {/* Tooltip bubble */}
          {tooltipVisible && (
            <div className="relative max-w-[180px] bg-[#1a2332] border border-white/10 rounded-xl px-3 py-2 text-xs text-white/70 shadow-lg animate-fade-in">
              New here? Watch how OFFO works →
              <button
                onClick={() => setTooltipVisible(false)}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20"
                aria-label="Dismiss tooltip"
              >
                <X className="w-2.5 h-2.5 text-white/60" />
              </button>
            </div>
          )}

          <button
            onClick={handleOpen}
            className="w-10 h-10 rounded-full bg-[#1a2332] border border-white/10 flex items-center justify-center shadow-lg hover:border-white/20 hover:bg-[#1e2a3e] transition-colors"
            aria-label="How does OFFO work?"
          >
            <HelpCircle className="w-5 h-5 text-white/50" />
          </button>
        </div>
      )}

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        >
          <div className="relative w-full max-w-2xl bg-[#0d1117] rounded-2xl border border-white/[0.08] shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-[#00d97e] mb-0.5">Tutorial</p>
                <h3 className="text-base font-semibold text-white">How OFFO works in 60 seconds</h3>
              </div>
              <button
                onClick={handleClose}
                className="w-8 h-8 rounded-lg bg-white/[0.06] flex items-center justify-center hover:bg-white/10 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4 text-white/60" />
              </button>
            </div>

            {/* Video */}
            <div className="relative bg-black">
              <video
                ref={videoRef}
                src="/tutorial-1.mp4"
                className="w-full aspect-video object-cover"
                controls={playing}
                playsInline
                preload="metadata"
                onPlay={() => setPlaying(true)}
              />
              {!playing && (
                <button
                  onClick={handlePlay}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/50 hover:bg-black/40 transition-colors group"
                  aria-label="Play tutorial"
                >
                  <div className="w-14 h-14 rounded-full bg-[#00d97e] flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                    <Play className="w-6 h-6 text-[#0d1117] fill-[#0d1117] ml-0.5" />
                  </div>
                  <span className="text-sm font-semibold text-white/80">Watch tutorial</span>
                </button>
              )}
            </div>

            {/* Footer CTA */}
            <div className="px-5 py-4 border-t border-white/[0.06] flex items-center justify-between">
              <p className="text-xs text-white/30">Paste any listing URL — no sign-up required</p>
              <button
                onClick={handleClose}
                className="text-xs font-semibold text-[#00d97e] hover:text-[#00c970] transition-colors"
              >
                Got it, let me try →
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
