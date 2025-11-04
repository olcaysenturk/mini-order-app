"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export default function VideoHero() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const vidRef = useRef<HTMLVideoElement | null>(null);

  // SSR -> CSR: portal için hazır mıyız?
  useEffect(() => setMounted(true), []);

  // ESC ile kapat
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (open && e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Açılınca oynat, kapanınca sıfırla
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"; // scroll kilit
      setTimeout(() => vidRef.current?.play().catch(() => {}), 50);
    } else {
      document.body.style.overflow = "";
      vidRef.current?.pause();
      try {
        if (vidRef.current) vidRef.current.currentTime = 0;
      } catch {}
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // --- Thumbnail + Play ---
  return (
    <div className="relative">
      <div className="relative rounded-3xl border border-neutral-200 bg-white/70 backdrop-blur-md shadow-xl overflow-hidden z-40">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-200">
          <div aria-hidden className="size-3 rounded-full bg-red-400" />
          <div aria-hidden className="size-3 rounded-full bg-yellow-400" />
          <div aria-hidden className="size-3 rounded-full bg-green-400" />
          <div className="ml-3 text-xs text-neutral-500">Tanıtım Videosu</div>
        </div>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group relative w-full text-left top-1.5"
          aria-label="Tanıtım videosunu oynat"
        >
          <div className="aspect-[16/10] w-full bg-white leading-none">
            <img
              src="/assets/video/video.png"
              alt=""
              className="block h-full w-full object-cover"
              loading="lazy"
              decoding="async"
            />
          </div>

          <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-black/10 to-transparent" />

          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="flex items-center gap-3 rounded-full border border-white/60 bg-white/80 px-4 py-2 shadow-md backdrop-blur transition group-hover:scale-[1.02]">
              <span aria-hidden className="grid place-items-center size-8 rounded-full bg-neutral-900 text-white">
                <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
              <span className="text-sm font-medium text-neutral-900">Videoyu İzle</span>
              <span className="text-xs text-neutral-500">• 1:12</span>
            </div>
          </div>
        </button>
      </div>

      {/* Glow */}
      <div aria-hidden className="absolute -inset-6 rounded-[28px] bg-gradient-to-r from-indigo-500/10 to-emerald-500/10 blur-2xl" />

      {/* --- MODAL (PORTAL) --- */}
      {mounted && open &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Perdexa tanıtım videosu"
            onMouseDown={(e) => {
              // backdrop tıklamasıyla kapat (içerikte tıklama kapatmaz)
              if (e.currentTarget === e.target) setOpen(false);
            }}
          >
            {/* Backdrop */}
            <div aria-hidden className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

            {/* İçerik */}
            <div className="relative z-10 w-full max-w-5xl">
              <div className="relative overflow-hidden rounded-2xl border border-neutral-800 bg-black shadow-2xl">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="absolute right-3 top-3 z-10 inline-flex items-center justify-center rounded-full bg-white/10 p-2 text-white hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                  aria-label="Videoyu kapat"
                >
                  <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
                    <path d="M18.3 5.71 12 12.01l-6.29-6.3-1.42 1.42 6.3 6.29-6.3 6.29 1.42 1.42 6.29-6.3 6.29 6.3 1.42-1.42-6.3-6.29 6.3-6.29z" />
                  </svg>
                </button>

                <video
                  ref={vidRef}
                  src="/assets/video/perdexa-demo.mp4"
                  className="aspect-video w-full"
                  controls
                  playsInline
                  preload="metadata"
                  poster="/assets/video/video.png"
                />
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
