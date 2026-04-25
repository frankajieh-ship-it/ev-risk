"use client";

import { useState, useRef } from "react";
import { Play } from "lucide-react";

export default function TutorialVideoSection() {
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handlePlay = () => {
    setPlaying(true);
    videoRef.current?.play();
  };

  return (
    <section className="py-12 md:py-16 bg-[#0d1117]">
      <div className="max-w-3xl mx-auto px-4">
        <div className="text-center mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-[#00d97e] mb-2">
            See it in action
          </p>
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
            How OFFO works in 60 seconds
          </h2>
          <p className="text-sm text-white/40">
            Paste a listing URL, get a full risk receipt — no sign-up needed.
          </p>
        </div>

        <div className="relative rounded-2xl overflow-hidden border border-white/[0.08] bg-black shadow-2xl">
          <video
            ref={videoRef}
            src="/tutorial-1.mp4"
            className="w-full aspect-video object-cover"
            controls={playing}
            playsInline
            preload="metadata"
            onPlay={() => setPlaying(true)}
            onPause={() => {}}
          />

          {/* Play overlay — shown until user hits play */}
          {!playing && (
            <button
              onClick={handlePlay}
              className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/50 hover:bg-black/40 transition-colors group"
              aria-label="Play tutorial video"
            >
              <div className="w-16 h-16 rounded-full bg-[#00d97e] flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                <Play className="w-7 h-7 text-[#0d1117] fill-[#0d1117] ml-1" />
              </div>
              <span className="text-sm font-semibold text-white/80">Watch the tutorial</span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
