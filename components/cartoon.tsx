'use client';

import { motion } from 'framer-motion';

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

export function BackgroundDecor() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="paper-dots absolute inset-0 opacity-50" />
      <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-lemon/50 blur-3xl" />
      <div className="absolute -right-20 top-16 h-80 w-80 rounded-full bg-cloud/40 blur-3xl" />
      <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-grape/30 blur-3xl" />
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
      <StarDoodle className="absolute right-[3%] top-10 h-10 w-10 text-ink/10" />
      <StarDoodle className="absolute bottom-16 left-[2%] h-6 w-6 text-ink/10" />
    </div>
  );
}

export function Confetti({ run, active = true }: { run: number; active?: boolean }) {
  if (!active || run === 0) return null;

  const pieces = Array.from({ length: 20 }, (_, index) => ({
    left: (index * 37 + 11) % 100,
    delay: (index % 7) * 0.045,
    rotate: (index % 2 === 0 ? 1 : -1) * (120 + index * 23),
    color: ['#FF8A80', '#FFD166', '#8ED3F4', '#B9A7FF', '#7DD3A0'][index % 5],
    size: 6 + (index % 3) * 3,
  }));

  return (
    <div key={run} className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {pieces.map((piece, index) => (
        <motion.span
          key={index}
          initial={{ y: '120%', opacity: 1, rotate: 0 }}
          animate={{ y: '-30%', opacity: 0, rotate: piece.rotate }}
          transition={{
            duration: 1.5 + (index % 5) * 0.16,
            delay: piece.delay,
            ease: 'easeOut',
          }}
          className="absolute rounded-[2px]"
          style={{
            left: `${piece.left}%`,
            width: piece.size,
            height: piece.size,
            backgroundColor: piece.color,
          }}
        />
      ))}
    </div>
  );
}

export function KeyCap({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-md border-2 border-ink/20 bg-white px-1.5 py-0.5 text-[10px] font-black text-ink/55">
      {children}
    </kbd>
  );
}
