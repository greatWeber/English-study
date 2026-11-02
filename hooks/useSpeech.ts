'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const PREFERRED_VOICES = [
  'Google US English',
  'Samantha',
  'Aria',
  'Zira',
  'Google UK English Female',
];

/**
 * 浏览器内置语音朗读（Web Speech API）：
 * - macOS/Chrome 使用系统本地语音，离线可用
 * - onboundary 事件回调当前读到的词序号，供逐词高亮
 * - Safari 等不支持 boundary 的浏览器只朗读不高亮，不影响功能
 */
export function useSpeech() {
  const supported =
    typeof window !== 'undefined' && 'speechSynthesis' in window;
  const [playing, setPlaying] = useState(false);
  const [wordIndex, setWordIndex] = useState(-1);
  const sessionRef = useRef(0);
  // 语音列表要等 voiceschanged 才有内容（Chrome 首次 getVoices() 是空数组）
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const retryRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!supported) return;
    const sync = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
      // 若正有一次朗读在等语音列表，列表到了就补发
      const pending = retryRef.current;
      if (pending && voicesRef.current.length > 0) {
        retryRef.current = null;
        pending();
      }
    };
    sync();
    window.speechSynthesis.addEventListener('voiceschanged', sync);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', sync);
  }, [supported]);

  const stop = useCallback(() => {
    sessionRef.current += 1;
    retryRef.current = null;
    if (supported) window.speechSynthesis.cancel();
    setPlaying(false);
    setWordIndex(-1);
  }, [supported]);

  const pickVoice = (): SpeechSynthesisVoice | undefined => {
    const voices = voicesRef.current.length
      ? voicesRef.current
      : window.speechSynthesis.getVoices();
    const en = voices.filter((v) => v.lang?.toLowerCase().startsWith('en'));
    // Google 语音走服务器合成，离线/网络受限时会静默失败 → 本地语音优先
    const local = en.filter((v) => v.localService);
    const pool = local.length > 0 ? local : en;
    return (
      PREFERRED_VOICES.map((name) => pool.find((v) => v.name.includes(name))).find(
        (v): v is SpeechSynthesisVoice => !!v
      ) ?? pool[0]
    );
  };

  /** 朗读 text；词序号与 splitDictation 的单词顺序一致 */
  const speak = useCallback(
    (text: string, rate = 1) => {
      if (!supported) return;
      const trimmed = text.trim();
      if (!trimmed) return;

      const run = () => {
        const session = ++sessionRef.current;
        // 注意：空闲时调 cancel() 会连带吞掉紧随其后的 speak()（Chrome bug），只在有内容时打断
        if (window.speechSynthesis.speaking || window.speechSynthesis.paused) {
          window.speechSynthesis.cancel();
        }
        if (window.speechSynthesis.paused) window.speechSynthesis.resume();

        const utterance = new SpeechSynthesisUtterance(trimmed);
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
          const head = Math.max(0, Math.min(event.charIndex ?? 0, trimmed.length));
          // 按「单词正则」计数（跳过独立标点），与页面渲染的词序号一致
          const before = trimmed.slice(0, head);
          const count = before.match(/[A-Za-z0-9]+(?:['’‘-][A-Za-z0-9]+)*/g)?.length ?? 0;
          setWordIndex(count);
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

        // 兜底：600ms 后仍没真正开始（无声卡死），安静重试一次
        window.setTimeout(() => {
          if (session === sessionRef.current && !window.speechSynthesis.speaking) {
            setPlaying(false);
            const retry = new SpeechSynthesisUtterance(trimmed);
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
      };

      // 语音列表还没就绪（Chrome 冷启动）：等 voiceschanged 到达后再读，最多等 1.5s
      if (voicesRef.current.length === 0 && window.speechSynthesis.getVoices().length === 0) {
        let done = false;
        const go = () => {
          if (done) return;
          done = true;
          retryRef.current = null;
          run();
        };
        retryRef.current = go;
        window.setTimeout(go, 1500);
        return;
      }
      run();
    },
    [supported]
  );

  // 组件卸载时停止朗读
  useEffect(() => stop, [stop]);

  return { supported, playing, wordIndex, speak, stop };
}
