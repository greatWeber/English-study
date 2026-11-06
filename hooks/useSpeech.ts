'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const PREFERRED_VOICES = [
  'Google US English',
  'Samantha',
  'Aria',
  'Zira',
  'Google UK English Female',
];

/** 与 splitDictation 相同的分词正则，保证高亮词序一致 */
const WORD_RE = /[A-Za-z0-9]+(?:['’‘-][A-Za-z0-9]+)*/g;

type TtsMark = { text: string; offsetMs: number; durationMs: number };

/** 按单词正则把字符偏移换算成词序号 */
function wordIndexAt(text: string, charIndex: number): number {
  const before = text.slice(0, Math.max(0, Math.min(charIndex, text.length)));
  return before.match(WORD_RE)?.length ?? 0;
}

/**
 * 句子朗读：优先用服务端微软神经网络语音（/api/tts，自然有感情 + 精确逐词时间戳），
 * 失败时自动回落到浏览器内置 Web Speech API（离线可用但机械）。
 */
export function useSpeech() {
  const supported = typeof window !== 'undefined';
  const [playing, setPlaying] = useState(false);
  const [wordIndex, setWordIndex] = useState(-1);
  const sessionRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // 服务端合成连续失败后不再反复尝试（比如断网时）
  const serverBrokenRef = useRef(false);

  // ---- 回落：浏览器内置语音（Web Speech API）----
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const wsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  useEffect(() => {
    if (!wsSupported) return;
    const sync = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };
    sync();
    window.speechSynthesis.addEventListener('voiceschanged', sync);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', sync);
  }, [wsSupported]);

  const stopWs = useCallback(() => {
    if (!wsSupported) return;
    // 空闲时调 cancel() 会吞掉后续 speak()（Chrome bug），只在有内容时打断
    if (window.speechSynthesis.speaking || window.speechSynthesis.paused) {
      window.speechSynthesis.cancel();
    }
  }, [wsSupported]);

  const pickVoice = (): SpeechSynthesisVoice | undefined => {
    const voices =
      voicesRef.current.length && wsSupported
        ? voicesRef.current
        : wsSupported
          ? window.speechSynthesis.getVoices()
          : [];
    const en = voices.filter((v) => v.lang?.toLowerCase().startsWith('en'));
    // Google 语音走云端，离线/网络受限会静默失败 → 本地语音优先
    const local = en.filter((v) => v.localService);
    const pool = local.length > 0 ? local : en;
    return (
      PREFERRED_VOICES.map((name) => pool.find((v) => v.name.includes(name))).find(
        (v): v is SpeechSynthesisVoice => !!v
      ) ?? pool[0]
    );
  };

  const speakViaWebSpeech = useCallback(
    (text: string, rate: number, session: number) => {
      if (!wsSupported) {
        setPlaying(false);
        return;
      }
      stopWs();

      const utterance = new SpeechSynthesisUtterance(text);
      const voice = pickVoice();
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      } else {
        utterance.lang = 'en-US';
      }
      utterance.rate = rate;

      utterance.onstart = () => {
        if (session === sessionRef.current) setPlaying(true);
      };
      utterance.onboundary = (event) => {
        if (session !== sessionRef.current) return;
        setWordIndex(wordIndexAt(text, event.charIndex ?? 0));
      };
      utterance.onend = () => {
        if (session !== sessionRef.current) return;
        setPlaying(false);
        setWordIndex(-1);
      };
      utterance.onerror = () => {
        if (session !== sessionRef.current) return;
        setPlaying(false);
        setWordIndex(-1);
      };

      setWordIndex(-1);
      setPlaying(true);
      window.speechSynthesis.speak(utterance);

      // 兜底：600ms 后仍没真正开始（无声卡死），用最简设置重试一次
      window.setTimeout(() => {
        if (session === sessionRef.current && !window.speechSynthesis.speaking) {
          setPlaying(false);
          const retry = new SpeechSynthesisUtterance(text);
          retry.lang = 'en-US';
          retry.rate = rate;
          retry.onend = () => {
            if (session === sessionRef.current) {
              setPlaying(false);
              setWordIndex(-1);
            }
          };
          retry.onerror = () => {
            if (session === sessionRef.current) {
              setPlaying(false);
              setWordIndex(-1);
            }
          };
          window.speechSynthesis.cancel();
          setPlaying(true);
          window.speechSynthesis.speak(retry);
        }
      }, 600);
    },
    [wsSupported, stopWs]
  );

  // ---- 主路径：服务端神经语音 ----
  const speakViaServer = useCallback(
    async (text: string, rate: number, session: number) => {
      const res = await fetch(`/api/tts?text=${encodeURIComponent(text)}&rate=${rate}`);
      if (!res.ok) throw new Error(`tts ${res.status}`);

      const marksHeader = res.headers.get('X-Tts-Marks');
      let marks: TtsMark[] = [];
      try {
        marks = marksHeader ? JSON.parse(decodeURIComponent(marksHeader)) : [];
      } catch {
        marks = [];
      }

      const blob = await res.blob();
      if (session !== sessionRef.current) return; // 期间被 stop / 换了句子
      const url = URL.createObjectURL(blob);

      const audio = new Audio(url);
      audioRef.current?.pause();
      audioRef.current = audio;

      audio.addEventListener('timeupdate', () => {
        if (session !== sessionRef.current) return;
        const tMs = audio.currentTime * 1000;
        if (marks.length > 0) {
          // 精确时间戳：找最后一个已开始的词
          let idx = -1;
          for (let i = 0; i < marks.length; i++) {
            if (marks[i].offsetMs <= tMs + 60) idx = i;
            else break;
          }
          setWordIndex(idx);
        } else {
          // 没时间戳时按播放进度估算
          if (audio.duration && isFinite(audio.duration)) {
            const charIndex = Math.floor((audio.currentTime / audio.duration) * text.length);
            setWordIndex(wordIndexAt(text, charIndex));
          }
        }
      });
      const finish = () => {
        URL.revokeObjectURL(url);
        if (session !== sessionRef.current) return;
        setPlaying(false);
        setWordIndex(-1);
      };
      audio.addEventListener('ended', finish);
      audio.addEventListener('error', () => {
        URL.revokeObjectURL(url);
        if (session !== sessionRef.current) return;
        // 播放失败退回内置语音
        speakViaWebSpeech(text, rate, session);
      });

      setWordIndex(-1);
      setPlaying(true);
      await audio.play();
    },
    [speakViaWebSpeech]
  );

  /** 朗读 text；词序号与 splitDictation 的单词顺序一致 */
  const speak = useCallback(
    (text: string, rate = 1) => {
      const trimmed = text.trim();
      if (!trimmed || !supported) return;

      const session = ++sessionRef.current;
      audioRef.current?.pause();
      stopWs();

      if (serverBrokenRef.current) {
        speakViaWebSpeech(trimmed, rate, session);
        return;
      }

      speakViaServer(trimmed, rate, session).catch(() => {
        if (session !== sessionRef.current) return;
        serverBrokenRef.current = true;
        speakViaWebSpeech(trimmed, rate, session);
      });
    },
    [supported, stopWs, speakViaServer, speakViaWebSpeech]
  );

  const stop = useCallback(() => {
    sessionRef.current += 1;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    stopWs();
    setPlaying(false);
    setWordIndex(-1);
  }, [stopWs]);

  // 组件卸载时停止朗读
  useEffect(
    () => () => {
      sessionRef.current += 1;
      if (audioRef.current) audioRef.current.pause();
      if (wsSupported && (window.speechSynthesis.speaking || window.speechSynthesis.paused)) {
        window.speechSynthesis.cancel();
      }
    },
    [wsSupported]
  );

  return { supported, playing, wordIndex, speak, stop };
}
