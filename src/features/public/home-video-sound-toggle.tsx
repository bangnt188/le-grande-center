"use client";

import { useState } from "react";
import styles from "./homepage-v2.module.css";

export default function HomeVideoSoundToggle() {
  const [muted, setMuted] = useState(true);
  return <button
    type="button"
    className={styles.filmSound}
    aria-label="Âm thanh video"
    aria-pressed={!muted}
    onClick={event => {
      const video = event.currentTarget.closest("section")?.querySelector("video");
      if (!video) return;
      video.muted = !video.muted;
      setMuted(video.muted);
    }}
  >
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"/>{muted ? <path d="m16 9 6 6m0-6-6 6"/> : <path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>}</svg>
    <span>{muted ? "Bật âm thanh" : "Tắt âm thanh"}</span>
  </button>;
}
