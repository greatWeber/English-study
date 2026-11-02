'use client';

import { useEffect, useRef, useState } from 'react';

type WordAudioProps = {
  word: string;
  /** 1=英音 2=美音，默认美音 */
  type?: 1 | 2;
  size?: number;
  className?: string;
};

/**
 * 单词真人发音：有道词典接口返回 mp3（仅支持单词，不支持句子）。
 * 接口不可达时静默失败，不打断页面。
 */
export function WordAudio({ word, type = 2, size = 15, className = '' }: WordAudioProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);

  // 换词时重置状态，避免上一次播放残留
  useEffect(() => {
    setPlaying(false);
  }, [word]);

  // 卸载时停止并释放
  useEffect(
    () => () => {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audioRef.current = null;
      }
    },
    []
  );

  const play = () => {
    if (!word) return;
    if (!audioRef.current) {
      const audio = new Audio();
      audio.preload = 'none';
      audio.addEventListener('ended', () => setPlaying(false));
      audio.addEventListener('error', () => setPlaying(false));
      audioRef.current = audio;
    }
    const audio = audioRef.current;
    audio.src = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=${type}`;
    setPlaying(true);
    audio.play().catch(() => setPlaying(false));
  };

  return (
    <button
      type="button"
      onClick={play}
      aria-label={`播放 ${word} 的发音`}
      title={playing ? '播放中…' : '播放发音'}
      className={`shrink-0 rounded-lg p-1 text-cartoon-blue transition-colors hover:bg-cartoon-blue/10 ${
        playing ? 'animate-pulse' : ''
      } ${className}`}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" stroke="none" />
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      </svg>
    </button>
  );
}
