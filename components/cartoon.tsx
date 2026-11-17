'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { RefObject } from 'react';

/* ============================================================
   共享卡通组件 —— 手绘 + 粗描边 + 硬阴影风格
   首页与练习页共用，保证视觉语言一致。
   ============================================================ */

export function StarDoodle({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3l2.4 5.2 5.6.7-4.2 3.9 1.1 5.6L12 15.7 7.1 18.4l1.1-5.6L4 8.9l5.6-.7z" />
    </svg>
  );
}

export function Mascot({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      {/* 水面 */}
      <ellipse cx="50" cy="82" rx="44" ry="12" fill="#8ED3F4" stroke="#2B2B45" strokeWidth="4" />
      <path d="M18 82 Q 34 78 50 82 Q 66 78 82 82" fill="none" stroke="#2B2B45" strokeWidth="3" strokeLinecap="round" />

      {/* 喷水（出水口） */}
      <path d="M54 44 Q 58 38 60 34 Q 62 38 58 42" fill="none" stroke="#B3E5FC" strokeWidth="3" strokeLinecap="round" />
      <circle cx="60" cy="34" r="2" fill="#B3E5FC" />
      <circle cx="58" cy="42" r="1.5" fill="#B3E5FC" />

      {/* 鲸鱼身体 */}
      <path
        d="M30 62 Q 30 42 50 40 Q 70 42 70 62 Q 70 72 50 74 Q 30 72 30 62 Z"
        fill="#63C1FE"
        stroke="#2B2B45"
        strokeWidth="4"
        strokeLinejoin="round"
      />

      {/* 白肚子 */}
      <ellipse cx="50" cy="64" rx="14" ry="9" fill="#FFFFFF" stroke="#2B2B45" strokeWidth="3" />

      {/* 尾巴 */}
      <path d="M70 58 Q 88 52 84 68 Q 76 62 70 66" fill="none" stroke="#63C1FE" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M70 58 Q 88 52 84 68 Q 76 62 70 66" fill="none" stroke="#2B2B45" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

      {/* 胸鳍 */}
      <ellipse cx="38" cy="60" rx="6" ry="3" fill="#4CAFDD" stroke="#2B2B45" strokeWidth="3" />

      {/* 眼睛 */}
      <circle cx="44" cy="50" r="3" fill="#FFFFFF" stroke="#2B2B45" strokeWidth="2" />
      <circle cx="45" cy="49.5" r="1.5" fill="#2B2B45" />
      <circle cx="45.5" cy="49" r="0.6" fill="#FFFFFF" />

      {/* 小嘴 */}
      <path d="M42 56 Q 46 58 50 56" fill="none" stroke="#2B2B45" strokeWidth="2.5" strokeLinecap="round" />

      {/* 脸颊 */}
      <ellipse cx="36" cy="54" rx="2.5" ry="2" fill="#FFB2C1" opacity="0.9" />
      <ellipse cx="60" cy="54" rx="2.5" ry="2" fill="#FFB2C1" opacity="0.9" />
    </svg>
  );
}



/** 数字滚动（count-up + 末尾减速），交卷页揭晓战绩用 */
export function CountUp({
  to,
  duration = 900,
  suffix = '',
  className,
}: {
  to: number;
  duration?: number;
  suffix?: string;
  className?: string;
}) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      // easeOutCubic：起步快，结尾缓，最后一下稳稳落在目标值
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(to * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [to, duration]);

  return <span className={className}>{display}{suffix}</span>;
}

/**
 * D 手绘描线：一条黄色的手绘波浪线，用 SVG 描边动画「写」出来。
 * 盖在答对的单词下面，像老师随手划的对勾线。
 */
export function Squiggle({
  active = true,
  delay = 0,
  color = '#FFB200',
}: {
  active?: boolean;
  delay?: number;
  color?: string;
}) {
  if (!active) return null;
  return (
    <motion.svg
      viewBox="0 0 100 8"
      preserveAspectRatio="none"
      className="pointer-events-none absolute -bottom-1 left-0 h-[7px] w-full overflow-visible"
      aria-hidden
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={{
        pathLength: { duration: 0.45, delay, ease: 'easeInOut' },
        opacity: { duration: 0.05, delay },
      }}
    >
      <motion.path
        d="M2 5 Q 9 1.5, 16 4.6 T 30 4.4 T 44 4.8 T 58 4.2 T 72 5 T 86 4.2 T 98 4.8"
        fill="none"
        stroke={color}
        strokeWidth={3.2}
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.45, delay, ease: 'easeInOut' }}
      />
    </motion.svg>
  );
}

const CONFETTI_COLORS = [
  '#FF8A80',
  '#FFD166',
  '#8ED3F4',
  '#B9A7FF',
  '#7DD3A0',
  '#FFB3C1',
  '#FFB26B',
  '#FFF0A8',
];

/** 礼炮：角度按「度」算，90 为正上方；spread 是左右各偏多少度 */
type CannonSpec = {
  x: number;
  y: number;
  angle: number;
  spread: number;
  speed: number; // 相对 max(视口宽, 900) 的初速系数
  count: number;
};

const CONFETTI_CANNONS: CannonSpec[] = [
  // 左下角，朝右上扇形喷
  { x: -0.02, y: 0.97, angle: 50, spread: 19, speed: 0.8, count: 30 },
  // 右下角，朝左上扇形喷
  { x: 1.02, y: 0.97, angle: 130, spread: 19, speed: 0.8, count: 30 },
];

/** 生成 n 角星路径，尖角朝上 */
function starPath(cx: number, cy: number, outer: number, inner: number, points: number) {
  const coords: string[] = [];
  for (let i = 0; i < points * 2; i += 1) {
    const r = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI / points) * i - Math.PI / 2;
    coords.push(`${(cx + Math.cos(angle) * r).toFixed(2)} ${(cy + Math.sin(angle) * r).toFixed(2)}`);
  }
  return `M${coords.join(' L')} Z`;
}

// 造型都用 SVG 画，小尺寸下也有清晰轮廓，还能描一条墨线融入卡通风格
const STAR_PATH = starPath(10, 10, 9.2, 4, 5); // 五角星
const SPARKLE_PATH = starPath(10, 10, 9.2, 3.2, 4); // 四角闪光
const TRIANGLE_PATH = 'M10 2 L18.8 17.6 L1.2 17.6 Z';
const RIBBON_PATH =
  'M3 4 C5 7 8 1 10 4 C12 7 15 1 17 4 L17 12 C15 9 12 15 10 12 C8 9 5 15 3 12 Z';
const RIBBON_CREASE = 'M4 8 C6 11 8 5 10 8 C12 11 14 5 16 8';

type PieceShape = 'rect' | 'ribbon' | 'dot' | 'star' | 'triangle' | 'sparkle';

/** 一条彩带的完整轨迹：位置、翻面、自转都已经采样成关键帧 */
type ConfettiPiece = {
  xs: number[];
  ys: number[];
  scaleYs: number[];
  spins: number[];
  fadeStart: number;
  duration: number;
  delay: number;
  width: number;
  height: number;
  radius: string;
  path?: string;
  color: string;
  highlight: boolean;
};

// 轨迹采样点：7 帧足以让抛物线看起来连续，又不会给 framer-motion 太多负担
const CONFETTI_FRAMES = 7;
const CONFETTI_TIMES = Array.from({ length: CONFETTI_FRAMES }, (_, i) => i / (CONFETTI_FRAMES - 1));

/**
 * 用真实斜抛运动生成每一片彩带的轨迹（受重力 + 少量侧风），
 * 再逐帧采样成关键帧。每片的角度、初速、重力、翻面频率都不同，
 * 所以喷出来是一大片散开的扇形，而不是几条平行线。
 */
function buildConfettiPieces(run: number): ConfettiPiece[] {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const pieces: ConfettiPiece[] = [];

  // 确定性伪随机：同样一次庆祝轨迹稳定，但每次 run 都换一种撒法
  let seed = ((run * 2654435761) ^ 0x9e3779b9) >>> 0;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  const addPiece = (
    x0: number,
    y0: number,
    vx: number,
    vy: number,
    gravity: number,
    duration: number,
    delay: number,
    wind: number
  ) => {
    const kindRoll = rnd();
    const kind: PieceShape =
      kindRoll < 0.34
        ? 'rect'
        : kindRoll < 0.54
          ? 'ribbon'
          : kindRoll < 0.66
            ? 'star'
            : kindRoll < 0.78
              ? 'triangle'
              : kindRoll < 0.88
                ? 'sparkle'
                : 'dot';

    // 偶尔来一片明显更大的，制造近大远小的层次
    const sizeMul = rnd() < 0.14 ? 1.35 : 1;
    const size = (9 + rnd() * 6) * sizeMul;
    const starSize = (15 + rnd() * 7) * sizeMul;
    const width =
      kind === 'dot'
        ? size
        : kind === 'ribbon'
          ? (20 + rnd() * 9) * sizeMul
          : kind === 'rect'
            ? size * 0.7 + rnd() * 2
            : starSize;
    const height =
      kind === 'dot'
        ? size
        : kind === 'ribbon'
          ? (11 + rnd() * 5) * sizeMul
          : kind === 'triangle'
            ? starSize * 0.9
            : kind === 'star' || kind === 'sparkle'
              ? starSize
              : size * 1.1 + rnd() * 3;
    const path =
      kind === 'star'
        ? STAR_PATH
        : kind === 'sparkle'
          ? SPARKLE_PATH
          : kind === 'triangle'
            ? TRIANGLE_PATH
            : kind === 'ribbon'
              ? RIBBON_PATH
              : undefined;

    const flips = 1.1 + rnd() * 2.3; // 翻面次数
    const phase = rnd() * Math.PI * 2;
    const spinDir = rnd() < 0.5 ? -1 : 1;
    const spin = spinDir * (140 + rnd() * 460);
    // 自转曲线：幂次让有的越转越快、有的越转越慢，绝不全场同速
    const spinPower = 0.55 + rnd() * 1.15;
    const wobble = 6 + rnd() * 14;
    // 不要把纸片压得太扁，否则星星在半程里看起来就是一根横线
    const flutterMin = 0.5 + rnd() * 0.25;

    const xs: number[] = [];
    const ys: number[] = [];
    const scaleYs: number[] = [];
    const spins: number[] = [];

    for (let f = 0; f < CONFETTI_FRAMES; f += 1) {
      const p = f / (CONFETTI_FRAMES - 1);
      const t = p * duration;
      xs.push(x0 + vx * t + 0.5 * wind * t * t);
      ys.push(y0 + vy * t + 0.5 * gravity * t * t);
      // 翻面：纵向被压扁再展开，像纸片在空中打转
      const flutter = Math.abs(Math.cos(phase + p * Math.PI * flips));
      scaleYs.push(flutterMin + (1 - flutterMin) * flutter);
      spins.push(spin * Math.pow(p, spinPower) + Math.sin(phase + p * Math.PI * flips) * wobble);
    }

    pieces.push({
      xs,
      ys,
      scaleYs,
      spins,
      fadeStart: 0.76 + rnd() * 0.12,
      duration,
      delay,
      width,
      height,
      radius: kind === 'dot' ? '9999px' : kind === 'rect' ? '2px' : '0',
      path,
      color: CONFETTI_COLORS[Math.floor(rnd() * CONFETTI_COLORS.length)],
      highlight: kind === 'ribbon',
    });
  };

  // 两门角炮：横向扇形展开
  for (const cannon of CONFETTI_CANNONS) {
    for (let i = 0; i < cannon.count; i += 1) {
      const angle = cannon.angle + (rnd() * 2 - 1) * cannon.spread;
      const rad = (angle * Math.PI) / 180;
      const speed = cannon.speed * Math.max(vw, 900) * (0.7 + rnd() * 0.45);
      addPiece(
        cannon.x * vw + (rnd() - 0.5) * 18,
        cannon.y * vh + (rnd() - 0.5) * 8,
        Math.cos(rad) * speed,
        -Math.sin(rad) * speed,
        vh * (1.15 + rnd() * 0.5),
        1.45 + rnd() * 0.75,
        rnd() * 0.18,
        (rnd() * 2 - 1) * 70
      );
    }
  }

  // 顶部飘落：补满画面中上部的空白，慢慢晃下来
  for (let i = 0; i < 30; i += 1) {
    addPiece(
      (0.05 + rnd() * 0.9) * vw,
      -30 - rnd() * 40,
      (rnd() * 2 - 1) * 90,
      80 + rnd() * 140,
      vh * (0.55 + rnd() * 0.35),
      1.6 + rnd() * 0.5,
      rnd() * 0.6,
      (rnd() * 2 - 1) * 30
    );
  }

  return pieces;
}

/** 全屏礼花：左右两门角炮扇形喷射 + 顶部彩带飘落 */
export function Confetti({ run, active = true }: { run: number; active?: boolean }) {
  const [done, setDone] = useState(false);
  const pieces = useRef<ConfettiPiece[] | null>(null);

  // 每次 run 变化重新放一轮
  useEffect(() => {
    pieces.current = null;
    setDone(false);
    const timer = setTimeout(() => setDone(true), 3000);
    return () => clearTimeout(timer);
  }, [run]);

  if (!active || run === 0 || done) return null;
  if (!pieces.current) pieces.current = buildConfettiPieces(run);

  return (
    <div key={run} className="pointer-events-none fixed inset-0 z-[90] overflow-hidden">
      {pieces.current.map((piece, index) => (
        <motion.span
          key={index}
          initial={{ x: piece.xs[0], y: piece.ys[0], opacity: 0, scaleY: 1, rotate: 0 }}
          animate={{
            x: piece.xs,
            y: piece.ys,
            scaleY: piece.scaleYs,
            rotate: piece.spins,
            opacity: [0, 1, 1, 0],
          }}
          transition={{
            x: { duration: piece.duration, delay: piece.delay, times: CONFETTI_TIMES, ease: 'linear' },
            y: { duration: piece.duration, delay: piece.delay, times: CONFETTI_TIMES, ease: 'linear' },
            rotate: { duration: piece.duration, delay: piece.delay, times: CONFETTI_TIMES, ease: 'linear' },
            scaleY: {
              duration: piece.duration,
              delay: piece.delay,
              times: CONFETTI_TIMES,
              ease: 'easeInOut',
            },
            opacity: {
              duration: piece.duration,
              delay: piece.delay,
              times: [0, 0.08, piece.fadeStart, 1],
              ease: 'linear',
            },
          }}
          className="absolute left-0 top-0 block"
          style={{
            width: piece.width,
            height: piece.height,
            borderRadius: piece.path ? undefined : piece.radius,
            backgroundColor: piece.path ? undefined : piece.color,
            // SVG 图形用跟随轮廓的投影；矩形/圆片用更便宜的硬阴影
            filter: piece.path ? 'drop-shadow(1.5px 1.5px 0 rgba(43,43,69,0.2))' : undefined,
            boxShadow: piece.path ? undefined : '1.5px 1.5px 0 rgba(43,43,69,0.22)',
          }}
        >
          {piece.path && (
            <svg
              viewBox="0 0 20 20"
              preserveAspectRatio="none"
              width="100%"
              height="100%"
              className="block overflow-visible"
              aria-hidden
            >
              <path
                d={piece.path}
                fill={piece.color}
                stroke="#2B2B45"
                strokeWidth="1.1"
                strokeLinejoin="round"
              />
              {piece.highlight && (
                <path
                  d={RIBBON_CREASE}
                  fill="none"
                  stroke="rgba(255,255,255,0.8)"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
              )}
            </svg>
          )}
        </motion.span>
      ))}
    </div>
  );
}

/* ---------- 印章几何：故意不是标准圆，收笔处留一点手绘缺口 ---------- */
const STAMP_RING =
  'M51 7 C67 6.5 83 16 89 31 C94.5 45 91 63 79 76 C67.5 88.5 47 93 32 86.5 C17 80 9 63 11 46 C13 29 30 8.5 51 7';

/** 印章周围的放射火花：角度、长短、粗细刻意不齐，避免「均匀刻度线」的机械感 */
const STAMP_SPARKS = Array.from({ length: 10 }, (_, i) => {
  const angle = -90 + i * 36 + (((i * 17) % 11) - 5);
  const rad = (angle * Math.PI) / 180;
  const inner = 50 + ((i * 7) % 5);
  const length = i % 3 === 0 ? 13 : 7 + ((i * 5) % 6);
  return {
    x1: 50 + Math.cos(rad) * inner,
    y1: 50 + Math.sin(rad) * inner,
    x2: 50 + Math.cos(rad) * (inner + length),
    y2: 50 + Math.sin(rad) * (inner + length),
    strokeWidth: i % 2 === 0 ? 3.4 : 2.4,
    delay: 0.46 + (i % 5) * 0.045,
    duration: 0.3 + (i % 3) * 0.06,
    color: i % 4 === 0 ? '#FFB200' : i % 4 === 1 ? '#15803D' : '#34D399',
  };
});

/** 圆环外的小闪光，两三个就够，位置错开避免对称 */
const STAMP_TWINKLES = [
  { cx: 15, cy: 23, size: 7.5, color: '#FFB200', delay: 0.62 },
  { cx: 88, cy: 65, size: 5.5, color: '#34D399', delay: 0.74 },
];

/** 四角星路径，用在印章周围的点缀上 */
function twinklePath(cx: number, cy: number, size: number) {
  const k = size * 0.26;
  return `M${cx} ${cy - size} L${cx + k} ${cy - k} L${cx + size} ${cy} L${cx + k} ${cy + k} L${cx} ${cy + size} L${cx - k} ${cy + k} L${cx - size} ${cy} L${cx - k} ${cy - k} Z`;
}

/**
 * 老师批改式手绘盖章。
 * 节奏刻意「不均匀」：先高空砸下并压扁 → 落点炸开冲击波 → 圆环飞快绕一圈收住 →
 * 最后手写勾「唰」地挑起来，中间没有任何匀速段。
 */
export function WinStamp({ run }: { run: number }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (run === 0) return;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 1650);
    return () => clearTimeout(timer);
  }, [run]);

  // 砸落 + 回弹用同一组 keyframe 时间点，保证旋转、位移、压扁同时发生
  const dropTimes = [0, 0.4, 0.66, 1];
  const dropEase: [number, number, number, number][] = [
    [0.5, 0, 0.9, 0.45], // 下落：越来越快
    [0.18, 1.4, 0.35, 1], // 回弹：过冲
    [0.3, 0, 0.25, 1], // 收住
  ];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={run}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.06, y: -4, transition: { duration: 0.2, ease: [0.55, 0, 1, 1] } }}
          className="pointer-events-none absolute inset-0 z-40 grid place-items-center overflow-visible"
        >
          {/* 外层：入场旋转 + 落点轻微晃动 */}
          <motion.div
            initial={{ opacity: 0, rotate: -24, y: -14 }}
            animate={{ opacity: 1, rotate: [-24, -4.5, -9, -8], y: [-14, 2, -1, 0] }}
            transition={{
              opacity: { duration: 0.05 },
              rotate: { duration: 0.46, times: dropTimes, ease: dropEase },
              y: { duration: 0.46, times: dropTimes, ease: dropEase },
            }}
            style={{ filter: 'drop-shadow(4px 5px 0 rgba(43,43,69,0.22))', mixBlendMode: 'multiply' }}
          >
            {/* 内层：落地瞬间横向压扁、纵向压缩，再弹回原比例 */}
            <motion.svg
              viewBox="0 0 100 100"
              initial={{ scaleX: 1.9, scaleY: 1.9 }}
              animate={{ scaleX: [1.9, 1.14, 0.97, 1], scaleY: [1.9, 0.88, 1.03, 1] }}
              transition={{ duration: 0.46, times: dropTimes, ease: dropEase }}
              className="h-40 w-40 overflow-visible md:h-52 md:w-52"
            >
              {/* 落地冲击波：一圈急促扩散、迅速熄灭的涟漪 */}
              <motion.circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="#16A34A"
                strokeWidth="2.2"
                initial={{ scale: 0.62, opacity: 0 }}
                animate={{ scale: [0.62, 1.5], opacity: [0.5, 0] }}
                transition={{ duration: 0.42, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
                style={{ transformOrigin: '50px 50px' }}
              />
              {/* 淡绿底色：像盖章时洇开的墨，最后才漫上来 */}
              <motion.path
                d={STAMP_RING}
                fill="#34D399"
                initial={{ opacity: 0, scale: 0.72 }}
                animate={{ opacity: 0.18, scale: [0.72, 1.06, 1] }}
                transition={{
                  scale: { duration: 0.42, delay: 0.34, times: [0, 0.6, 1], ease: [0.2, 0.9, 0.3, 1] },
                  opacity: { duration: 0.16, delay: 0.34 },
                }}
                style={{ transformOrigin: '50px 50px' }}
              />
              {/* 主圆环：迅速绕一圈，收笔停在 96%，留下手绘的缺口 */}
              <motion.path
                d={STAMP_RING}
                fill="none"
                stroke="#16A34A"
                strokeWidth="5.5"
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 0.96, opacity: 1 }}
                transition={{
                  pathLength: { duration: 0.34, delay: 0.2, ease: [0.16, 1, 0.3, 1] },
                  opacity: { duration: 0.06, delay: 0.2 },
                }}
              />
              {/* 放射火花：错峰炸出，然后错峰熄灭 */}
              {STAMP_SPARKS.map((spark, index) => (
                <motion.line
                  key={index}
                  x1={spark.x1}
                  y1={spark.y1}
                  x2={spark.x2}
                  y2={spark.y2}
                  stroke={spark.color}
                  strokeWidth={spark.strokeWidth}
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: [0, 1, 1, 0] }}
                  transition={{
                    pathLength: { duration: spark.duration, delay: spark.delay, ease: [0.16, 1, 0.3, 1] },
                    opacity: {
                      duration: spark.duration,
                      delay: spark.delay,
                      times: [0, 0.18, 0.6, 1],
                      ease: [[0.16, 1, 0.3, 1], 'linear', [0.55, 0, 1, 1]],
                    },
                  }}
                />
              ))}
              {/* 勾勾：短撇 + 长挑，先慢后快地「唰」上去，收笔带一点超出的随意感 */}
              <motion.path
                d="M29 51 L45 66 L73 30"
                fill="none"
                stroke="#15803D"
                strokeWidth="7.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ delay: 0.48, duration: 0.26, ease: [0.7, 0, 0.25, 1] }}
              />
              {/* 小字：像印章底部刻的字，勾完才「咚」地落定 */}
              <motion.text
                x="50"
                y="82"
                textAnchor="middle"
                fontFamily="'Chalkboard SE', 'Comic Sans MS', 'Marker Felt', sans-serif"
                fontSize="12.5"
                fontWeight="900"
                letterSpacing="1.2"
                fill="#15803D"
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.85 }}
                transition={{ delay: 0.7, duration: 0.18 }}
              >
                NICE!
              </motion.text>
              {/* 两颗四角星：弹一下，给整体加一点不规则的生气 */}
              {STAMP_TWINKLES.map((star, index) => (
                <motion.path
                  key={index}
                  d={twinklePath(star.cx, star.cy, star.size)}
                  fill={star.color}
                  stroke="#2B2B45"
                  strokeWidth="1.4"
                  strokeLinejoin="round"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: [0, 1.25, 1], opacity: 1 }}
                  transition={{
                    scale: { duration: 0.3, delay: star.delay, times: [0, 0.65, 1], ease: [0.2, 1.4, 0.4, 1] },
                    opacity: { duration: 0.1, delay: star.delay },
                  }}
                  style={{ transformOrigin: `${star.cx}px ${star.cy}px` }}
                />
              ))}
            </motion.svg>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** ⭐ 从句子卡飞向计分器；挂载即飞，落地后自动卸载 */
export function StarFlight({
  run,
  fromRef,
  toRef,
  onLanded,
}: {
  run: number;
  fromRef: RefObject<HTMLElement | null>;
  toRef: RefObject<HTMLElement | null>;
  onLanded?: () => void;
}) {
  const [flight, setFlight] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(
    null
  );

  useEffect(() => {
    if (run === 0) {
      setFlight(null); // 落地后清理，否则星星会滞留在终点，和计分器的 ⭐ 重叠成两颗
      return;
    }
    const from = fromRef.current?.getBoundingClientRect();
    const to = toRef.current?.getBoundingClientRect();
    if (!from || !to) {
      onLanded?.();
      return;
    }
    setFlight({
      x0: from.left + from.width / 2,
      y0: from.top + from.height / 2,
      x1: to.left + to.width / 2,
      y1: to.top + to.height / 2,
    });
    // 动画 0.7s 结束即落地：清理飞星 + 触发计分器弹跳。
    // 不能只靠 onAnimationComplete —— run 连续变化时组件按 key 重建，回调可能不触发，
    // 导致旧星星残留、和计分器里的 ⭐ 重叠成两颗
    const timer = setTimeout(() => onLanded?.(), 720);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);

  if (!flight) return null;

  return (
    <motion.div
      key={run}
      initial={{ x: flight.x0 - 14, y: flight.y0 - 14, scale: 0.4, opacity: 0 }}
      animate={{
        x: [flight.x0 - 14, (flight.x0 + flight.x1) / 2, flight.x1 - 14],
        y: [flight.y0 - 14, Math.min(flight.y0, flight.y1) - 120, flight.y1 - 14],
        scale: [0.4, 1.5, 0.9],
        opacity: [0, 1, 1],
        rotate: [0, 200, 360],
      }}
      transition={{ duration: 0.7, ease: 'easeInOut', times: [0, 0.4, 1] }}
      className="pointer-events-none fixed left-0 top-0 z-[95] text-[28px]"
      style={{ filter: 'drop-shadow(2px 2px 0 rgba(43,43,69,0.4))' }}
    >
      ⭐
    </motion.div>
  );
}

export function KeyCap({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-md border-2 border-ink/20 bg-white px-1.5 py-0.5 text-[10px] font-black text-ink/55">
      {children}
    </kbd>
  );
}
