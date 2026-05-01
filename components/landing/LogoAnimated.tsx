"use client";

/**
 * LogoAnimated
 *
 * Plays the OFFO logo animation video once per browser session,
 * then crossfades to the static logo image.
 *
 * On subsequent navigations within the same session, shows only
 * the static logo (no re-play).
 */

import { useRef, useState, useEffect } from "react";
import Image from "next/image";

const SESSION_KEY = "offo_logo_played";

interface LogoAnimatedProps {
  className?: string;
}

export default function LogoAnimated({ className = "w-24 sm:w-28 md:w-36 lg:w-44 h-auto" }: LogoAnimatedProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Has the video already played this session?
  const [skipAnim, setSkipAnim] = useState(true); // start hidden until hydrated
  const [videoVisible, setVideoVisible] = useState(false);
  const [logoVisible, setLogoVisible] = useState(false);

  useEffect(() => {
    const alreadyPlayed = sessionStorage.getItem(SESSION_KEY);
    if (alreadyPlayed) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSkipAnim(true);
       
      setLogoVisible(true);
    } else {
       
      setSkipAnim(false);
       
      setVideoVisible(true);
    }
  }, []);

  const handleVideoEnded = () => {
    sessionStorage.setItem(SESSION_KEY, "1");
    // Fade out video, fade in logo
    setVideoVisible(false);
    setTimeout(() => setLogoVisible(true), 150);
  };

  const handleVideoError = () => {
    // Fallback: just show static logo
    sessionStorage.setItem(SESSION_KEY, "1");
    setVideoVisible(false);
    setLogoVisible(true);
  };

  return (
    <div className={`relative ${className}`}>
      {/* Video — plays once, shown on top while animating */}
      {!skipAnim && videoVisible && (
        <div className="overflow-hidden">
          <video
            ref={videoRef}
            src="/offo-logo-animation.mp4"
            autoPlay
            muted
            playsInline
            onEnded={handleVideoEnded}
            onError={handleVideoError}
            className="w-[125%] h-auto block"
            style={{ marginLeft: "-5%", marginRight: "-20%" }}
          />
        </div>
      )}

      {/* Static logo — shown after video ends */}
      {(!videoVisible || skipAnim) && (
        <Image
          src="/offo-logo.jpg"
          alt="OFFO"
          width={200}
          height={103}
          priority
          className={`w-full h-auto block transition-opacity duration-500 ${logoVisible ? "opacity-100" : "opacity-0"}`}
        />
      )}
    </div>
  );
}
