"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Media } from "@/lib/types";
import { mediaUrl } from "@/lib/utils";

/** Muted, looping hero video with a visible pause control; never autoplays under reduced motion. */
export function HeroVideo({ video, poster }: { video: Media; poster: Media | null }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }, []);

  const toggle = () => {
    const el = ref.current;
    if (!el) return;
    if (el.paused) {
      void el.play();
      setPlaying(true);
    } else {
      el.pause();
      setPlaying(false);
    }
  };

  return (
    <>
      <video ref={ref} className="absolute inset-0 h-full w-full object-cover" src={video.url} poster={mediaUrl(poster, "lg")} muted loop playsInline preload="metadata" aria-hidden />
      <button type="button" onClick={toggle} className="absolute right-5 bottom-5 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full border border-ivory/50 text-ivory" aria-label={playing ? "Pause background video" : "Play background video"}>
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
    </>
  );
}
