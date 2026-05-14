"use client";

import { useState, useRef } from "react";
import { Play, Pause, Headphones } from "lucide-react";

interface PodcastPlayerProps {
  src: string;
  title: string;
  duration?: string;
}

export default function PodcastPlayer({ src, title, duration }: PodcastPlayerProps) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState("0:00");
  const audioRef = useRef<HTMLAudioElement>(null);

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    const el = audioRef.current;
    if (!el || !el.duration) return;
    const pct = (el.currentTime / el.duration) * 100;
    setProgress(pct);
    const m = Math.floor(el.currentTime / 60);
    const s = Math.floor(el.currentTime % 60).toString().padStart(2, "0");
    setCurrentTime(`${m}:${s}`);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = audioRef.current;
    if (!el || !el.duration) return;
    el.currentTime = (Number(e.target.value) / 100) * el.duration;
  };

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#111820] p-5 flex flex-col gap-4">
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => { setPlaying(false); setProgress(0); setCurrentTime("0:00"); }}
        preload="metadata"
      />

      <div className="flex items-center gap-4">
        <button
          onClick={toggle}
          className="w-12 h-12 rounded-full bg-[#00d97e] flex items-center justify-center flex-shrink-0 hover:scale-105 transition-transform shadow-lg"
          aria-label={playing ? "Pause episode" : "Play episode"}
        >
          {playing
            ? <Pause className="w-5 h-5 text-[#0d1117]" />
            : <Play className="w-5 h-5 text-[#0d1117] fill-[#0d1117] ml-0.5" />
          }
        </button>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{title}</p>
          <p className="text-xs text-white/40 mt-0.5">
            {currentTime}
            {duration ? ` / ${duration}` : ""}
          </p>
        </div>

        <Headphones className="w-5 h-5 text-white/20 flex-shrink-0" />
      </div>

      <input
        type="range"
        min={0}
        max={100}
        value={progress}
        onChange={handleSeek}
        className="w-full h-1 accent-[#00d97e] cursor-pointer"
        aria-label="Seek audio"
      />
    </div>
  );
}
