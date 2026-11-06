'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useSpring, useTransform } from 'framer-motion';
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
      <ellipse cx="50" cy="88" rx="27" ry="5" fill="#2B2B45" opacity="0.12" />
      <path
        d="M50 12c21 0 34 13 34 33 0 21-14 36-34 36S16 66 16 45c0-20 13-33 34-33z"
        fill="#FFE066"
        stroke="#2B2B45"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path d="M50 13V7" stroke="#2B2B45" strokeWidth="4" strokeLinecap="round" />
      <path
        d="M50 2l1.6 3.2 3.4.5-2.5 2.4.6 3.4L50 10l-3.1 1.5.6-3.4-2.5-2.4 3.4-.5z"
        fill="#FF8A80"
        stroke="#2B2B45"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <ellipse cx="35" cy="34" rx="9" ry="6" fill="#FFF9C9" opacity="0.85" />
      <circle cx="37" cy="49" r="7.5" fill="#FFFFFF" stroke="#2B2B45" strokeWidth="3" />
      <circle cx="63" cy="49" r="7.5" fill="#FFFFFF" stroke="#2B2B45" strokeWidth="3" />
      <circle cx="39" cy="50" r="3.2" fill="#2B2B45" />
      <circle cx="65" cy="50" r="3.2" fill="#2B2B45" />
      <circle cx="40.5" cy="48.5" r="1.1" fill="#FFFFFF" />
      <circle cx="66.5" cy="48.5" r="1.1" fill="#FFFFFF" />
      <ellipse cx="25" cy="61" rx="5" ry="3" fill="#FF9F9F" opacity="0.8" />
      <ellipse cx="75" cy="61" rx="5" ry="3" fill="#FF9F9F" opacity="0.8" />
      <path
        d="M43 62c3.5 5.5 10.5 5.5 14 0"
        fill="none"
        stroke="#2B2B45"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path d="M19 62c-4 5-5 10-3 14" fill="none" stroke="#2B2B45" strokeWidth="4" strokeLinecap="round" />
      <path d="M81 62c4 5 5 10 3 14" fill="none" stroke="#2B2B45" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

/**
 * F 视差漂浮：鼠标移动时，背景装饰按「景深」分层缓慢漂移。
 * 近处的 emoji 漂移多、远处的光斑漂移少，形成低成本空间感。
 */
export function BackgroundDecor() {
  // mouse: -0.5 .. 0.5（相对视口中心）
  const mouse = useRef({ x: 0, y: 0 });
  const springX = useSpring(0, { stiffness: 50, damping: 20 });
  const springY = useSpring(0, { stiffness: 50, damping: 20 });

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      mouse.current = {
        x: event.clientX / window.innerWidth - 0.5,
        y: event.clientY / window.innerHeight - 0.5,
      };
      springX.set(mouse.current.x);
      springY.set(mouse.current.y);
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [springX, springY]);

  const layer = (depth: number) => ({
    x: useTransform(springX, (v) => v * depth),
    y: useTransform(springY, (v) => v * depth),
  });
  const near = layer(28);
  const mid = layer(16);
  const far = layer(8);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="paper-dots absolute inset-0 opacity-50" />
      <motion.div style={far} className="absolute inset-0">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-lemon/50 blur-3xl" />
        <div className="absolute -right-20 top-16 h-80 w-80 rounded-full bg-cloud/40 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-grape/30 blur-3xl" />
      </motion.div>
      <motion.div style={mid} className="absolute inset-0">
        <StarDoodle className="absolute right-[3%] top-10 h-10 w-10 text-ink/10" />
        <StarDoodle className="absolute bottom-16 left-[2%] h-6 w-6 text-ink/10" />
      </motion.div>
      <motion.div style={near} className="absolute inset-0">
        <span className="absolute left-[5%] top-44 hidden -rotate-12 animate-float-slow text-4xl opacity-60 md:block">
          📚
        </span>
        <span
          className="absolute right-[6%] top-1/3 hidden rotate-12 animate-float-slow text-4xl opacity-60 md:block"
          style={{ animationDelay: '-2s' }}
        >
          ✏️
        </span>
        <span className="absolute bottom-28 left-[9%] hidden animate-float text-3xl opacity-50 md:block">
          ⭐
        </span>
        <span
          className="absolute bottom-44 right-[10%] hidden animate-float text-3xl opacity-50 lg:block"
          style={{ animationDelay: '-1s' }}
        >
          💡
        </span>
      </motion.div>
    </div>
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

const CONFETTI_COLORS = ['#FF8A80', '#FFD166', '#8ED3F4', '#B9A7FF', '#7DD3A0', '#FFB3C1'];

type CannonSpec = { originX: number; originY: number; angle: number; spread: number; count: number };

const CONFETTI_CANNONS: CannonSpec[] = [
  // 左下角礼炮，朝右上喷
  { originX: 0.04, originY: 0.96, angle: 62, spread: 34, count: 26 },
  // 右下角礼炮，朝左上喷
  { originX: 0.96, originY: 0.96, angle: 118, spread: 34, count: 26 },
  // 顶部中央小礼炮，向两侧撒
  { originX: 0.5, originY: 0.12, angle: 90, spread: 80, count: 18 },
];

type ConfettiPiece = {
  x0: number;
  y0: number;
  vx: number;
  vy: number;
  gravity: number;
  delay: number;
  size: number;
  color: string;
  round: boolean;
  spin: number;
};

/** 用三角函数把「角度 + 初速」换算成两阶段位移动画的关键帧 */
function buildConfettiPieces(): ConfettiPiece[] {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const pieces: ConfettiPiece[] = [];

  for (const cannon of CONFETTI_CANNONS) {
    for (let i = 0; i < cannon.count; i += 1) {
      // 确定性伪随机（避免 SSR 水合不一致）
      const seed = (cannon.originX * 997 + i * 131 + cannon.angle) % 1;
      const angleDeg = cannon.angle + (seed * 2 - 1) * cannon.spread;
      const power = (0.55 + ((i * 37) % 45) / 100) * Math.max(vw, 900);
      const rad = (angleDeg * Math.PI) / 180;
      pieces.push({
        x0: cannon.originX * vw,
        y0: cannon.originY * vh,
        vx: Math.cos(rad) * power,
        vy: -Math.sin(rad) * power,
        gravity: vh * (1.4 + ((i * 53) % 40) / 100),
        delay: ((i * 17) % 10) * 0.02,
        size: 7 + (i % 3) * 4,
        color: CONFETTI_COLORS[(i + cannon.angle) % CONFETTI_COLORS.length],
        round: i % 4 === 0,
        spin: (i % 2 === 0 ? 1 : -1) * (180 + ((i * 71) % 360)),
      });
    }
  }
  return pieces;
}

/** 全屏礼花：屏幕两角 + 顶部三门礼炮斜向喷射，彩带上天后受重力落下 */
export function Confetti({ run, active = true }: { run: number; active?: boolean }) {
  const [done, setDone] = useState(false);
  const pieces = useRef<ConfettiPiece[] | null>(null);

  // 每次 run 变化重新放一轮
  useEffect(() => {
    pieces.current = null;
    setDone(false);
    const timer = setTimeout(() => setDone(true), 2400);
    return () => clearTimeout(timer);
  }, [run]);

  if (!active || run === 0 || done) return null;
  if (!pieces.current) pieces.current = buildConfettiPieces();

  return (
    <div
      key={run}
      className="pointer-events-none fixed inset-0 z-[90] overflow-hidden"
      onAnimationEnd={() => undefined}
    >
      {pieces.current.map((piece, index) => (
        <motion.span
          key={index}
          initial={{ x: piece.x0, y: piece.y0, opacity: 1, rotate: 0, scale: 1 }}
          animate={{
            // 阶段 1：喷到最高点（水平减速、垂直减速 = 上抛）
            x: [piece.x0, piece.x0 + piece.vx * 0.55, piece.x0 + piece.vx * 0.85],
            y: [piece.y0, piece.y0 + piece.vy * 0.45, piece.y0 + piece.vy * 0.45 + piece.gravity * 0.35],
            opacity: [1, 1, 0],
            rotate: [0, piece.spin * 0.6, piece.spin],
          }}
          transition={{
            duration: 1.7 + (index % 6) * 0.12,
            delay: piece.delay,
            ease: ['easeOut', 'linear'],
            times: [0, 0.45, 1],
          }}
          className="absolute left-0 top-0"
          style={{
            width: piece.round ? piece.size : piece.size * 0.55,
            height: piece.round ? piece.size : piece.size * 1.7,
            backgroundColor: piece.color,
            borderRadius: piece.round ? '9999px' : '2px',
            boxShadow: '1px 1px 0 rgba(43,43,69,0.35)',
          }}
        />
      ))}
    </div>
  );
}

/** 老师批改式手绘打勾：圆环沿路径描出来，勾勾接力一笔写出，最后整体淡出 */
export function WinStamp({ run }: { run: number }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (run === 0) return;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 1500);
    return () => clearTimeout(timer);
  }, [run]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={run}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.06, transition: { duration: 0.28, ease: 'easeOut' } }}
          className="pointer-events-none absolute inset-0 z-40 grid place-items-center"
        >
          <motion.svg
            viewBox="0 0 100 100"
            initial={{ scale: 0.86, rotate: -8, opacity: 0 }}
            animate={{ scale: 1, rotate: -5, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            className="h-36 w-36 overflow-visible md:h-44 md:w-44"
          >
            {/* 圆环：从正上方起笔顺时针描一圈，收笔留一点缺口的手绘感 */}
            <motion.circle
              cx="50"
              cy="50"
              r="43"
              fill="none"
              stroke="rgb(34,197,94)"
              strokeWidth="5.5"
              strokeLinecap="round"
              transform="rotate(-90 50 50)"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 0.97, opacity: 1 }}
              transition={{
                pathLength: { duration: 0.62, ease: [0.45, 0, 0.35, 1] },
                opacity: { duration: 0.1 },
              }}
            />
            {/* 淡绿底色：描完圆后轻染进来 */}
            <motion.circle
              cx="50"
              cy="50"
              r="43"
              fill="rgba(34,197,94,0.09)"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.3 }}
            />
            {/* 勾勾：短撇 + 长挑，一笔写完 */}
            <motion.path
              d="M29 52 L44 66 L71 34"
              fill="none"
              stroke="rgb(21,128,61)"
              strokeWidth="7.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 0.58, duration: 0.34, ease: [0.2, 0.6, 0.3, 1] }}
            />
          </motion.svg>
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
