"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  title: string;
  audioUrl: string;
};

function formatTime(value: number): string {
  if (!Number.isFinite(value)) {
    return "00:00";
  }

  const minutes = Math.floor(value / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(value % 60)
    .toString()
    .padStart(2, "0");

  return `${minutes}:${seconds}`;
}

export function AudioPlayer({ title, audioUrl }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const onTime = () => setCurrentTime(audio.currentTime);
    const onLoaded = () => setDuration(audio.duration || 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);

    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
    };
  }, []);

  useEffect(() => {
    if (!("mediaSession" in navigator)) {
      return;
    }

    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist: "출근길"
    });

    navigator.mediaSession.setActionHandler("play", () => {
      audioRef.current?.play();
    });
    navigator.mediaSession.setActionHandler("pause", () => {
      audioRef.current?.pause();
    });
    navigator.mediaSession.setActionHandler("seekbackward", () => {
      const audio = audioRef.current;
      if (!audio) {
        return;
      }
      audio.currentTime = Math.max(0, audio.currentTime - 5);
    });
    navigator.mediaSession.setActionHandler("seekforward", () => {
      const audio = audioRef.current;
      if (!audio) {
        return;
      }
      audio.currentTime = Math.min(audio.duration || audio.currentTime + 5, audio.currentTime + 5);
    });
  }, [title]);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    if (audio.paused) {
      audio.play();
      return;
    }

    audio.pause();
  }

  function seekBy(seconds: number) {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const nextTime = Math.max(0, Math.min(audio.currentTime + seconds, audio.duration || Infinity));
    audio.currentTime = nextTime;
  }

  return (
    <div className="audio-box">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />
      <strong>듣기</strong>
      <p className="item-meta">
        {formatTime(currentTime)} / {formatTime(duration)}
      </p>
      <div className="audio-controls">
        <button className="btn secondary" onClick={() => seekBy(-5)} type="button">
          -5초
        </button>
        <button className="btn primary" onClick={togglePlay} type="button">
          {isPlaying ? "정지" : "재생"}
        </button>
        <button className="btn secondary" onClick={() => seekBy(5)} type="button">
          +5초
        </button>
      </div>
    </div>
  );
}
