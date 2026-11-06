'use client';

/* ============================================================
   零依赖音效：WebAudio 现场合成，不需要任何音频文件。
   首次用户交互时才创建 AudioContext（浏览器自动播放策略）。
   ============================================================ */

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** 单音：给定频率、起止时间偏移、音量 */
function tone(
  audio: AudioContext,
  freq: number,
  startAt: number,
  duration: number,
  volume: number,
  type: OscillatorType = 'sine'
) {
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t0 = audio.currentTime + startAt;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(audio.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

/** 答对：轻快的「叮咚嘟」上行三音（C5-E5-G5）+ 高八度泛音点缀 */
export function playCorrectChime() {
  const audio = getCtx();
  if (!audio) return;
  tone(audio, 523.25, 0, 0.14, 0.16);
  tone(audio, 659.25, 0.09, 0.14, 0.16);
  tone(audio, 783.99, 0.18, 0.24, 0.2);
  tone(audio, 1567.98, 0.18, 0.18, 0.05, 'triangle');
}

/** 音效开关（localStorage 持久化） */
const STORAGE_KEY = 'dicta…ound';

export function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  return window.localStorage.getItem(STORAGE_KEY) !== 'off';
}

export function setSoundEnabled(enabled: boolean) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
}
