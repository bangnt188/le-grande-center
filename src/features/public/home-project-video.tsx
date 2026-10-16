"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createVideoPlaybackController } from "@mall/ui/motion";
import { PROJECT_FILM_URL } from "./site-content";
import styles from "./homepage-v2.module.css";

const VISIBILITY_THRESHOLD = 0.15;

export default function HomeProjectVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoId = useId();
  const [sourceAttached, setSourceAttached] = useState(false);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= VISIBILITY_THRESHOLD)) return;
      setSourceAttached(true);
      observer.disconnect();
    }, { threshold: VISIBILITY_THRESHOLD });
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!sourceAttached || !video) return;
    // Core alone owns autoplay, offscreen/tab pauses and reduced-motion changes.
    // A native autoPlay attribute would bypass that policy as soon as src appears.
    const playback = createVideoPlaybackController(video, VISIBILITY_THRESHOLD);
    return () => playback.destroy();
  }, [sourceAttached]);

  return <div className={styles.filmMedia}>
    <video
      ref={videoRef}
      id={videoId}
      src={sourceAttached ? PROJECT_FILM_URL : undefined}
      muted={muted}
      loop
      playsInline
      preload="none"
      width="960"
      height="540"
      aria-label="Phim giới thiệu Le Grande Centre"
    >
      Trình duyệt không hỗ trợ video. <a href={PROJECT_FILM_URL}>Mở phim dự án</a>.
    </video>
    <button
      type="button"
      className={styles.filmSound}
      aria-label="Âm thanh video"
      aria-controls={videoId}
      aria-pressed={!muted}
      onClick={() => {
        const video = videoRef.current;
        if (!video) return;
        const nextMuted = !video.muted;
        video.muted = nextMuted;
        setMuted(nextMuted);
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"/>{muted ? <path d="m16 9 6 6m0-6-6 6"/> : <path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>}</svg>
      <span>{muted ? "Bật âm thanh" : "Tắt âm thanh"}</span>
    </button>
  </div>;
}
