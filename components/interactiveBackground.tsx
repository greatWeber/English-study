'use client';

/* ============================================================
   可交互背景：鼠标移动会让背景产生动画。
   三种模式可实时切换（左下角小工具条），偏好存 localStorage。
     dots     磁吸点阵 + 柔和色块
     reveal   橡皮擦揭示（鼠标擦开覆盖层，露出底下的涂鸦图案）
     dotsOnly 纯磁吸点阵
   颜色全部沿用现有卡通主题（lemon/orange/mint/cloud/ink）。
   ============================================================ */

import { useCallback, useEffect, useRef, useState } from 'react';

export type BgMode = 'dots' | 'reveal' | 'dotsOnly';

const MODES: { key: BgMode; label: string }[] = [
  { key: 'dots', label: '磁吸点阵' },
  { key: 'reveal', label: '橡皮擦揭示' },
  { key: 'dotsOnly', label: '纯点阵' },
];

const STORAGE_KEY = 'dicta…Mode';
const EVENT_NAME = 'dictation-bg-mode';

/** 同页面多个 BackgroundDecor 实例 + 切换器之间同步模式 */
function readMode(): BgMode {
  if (typeof window === 'undefined') return 'dots';
  const raw = window.localStorage.getItem(STORAGE_KEY);
  return MODES.some((m) => m.key === raw) ? (raw as BgMode) : 'dots';
}

function writeMode(mode: BgMode) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, mode);
  window.dispatchEvent(new CustomEvent<BgMode>(EVENT_NAME, { detail: mode }));
}

function useBgMode(): BgMode {
  const [mode, setMode] = useState<BgMode>('dots');
  useEffect(() => {
    setMode(readMode());
    const onChange = (event: Event) => setMode((event as CustomEvent<BgMode>).detail);
    window.addEventListener(EVENT_NAME, onChange);
    return () => window.removeEventListener(EVENT_NAME, onChange);
  }, []);
  return mode;
}

/* ---------------- 共享：鼠标位置追踪 ---------------- */

type Pointer = { x: number; y: number; active: boolean };

function usePointer() {
  const pointer = useRef<Pointer>({ x: -9999, y: -9999, active: false });
  const onClick = useRef<((x: number, y: number) => void) | null>(null);

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      pointer.current = { x: event.clientX, y: event.clientY, active: true };
    };
    const onLeave = () => {
      pointer.current.active = false;
    };
    const onMouseDown = (event: MouseEvent) => {
      onClick.current?.(event.clientX, event.clientY);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseout', onLeave);
    window.addEventListener('mousedown', onMouseDown);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseout', onLeave);
      window.removeEventListener('mousedown', onMouseDown);
    };
  }, []);

  return { pointer, onClick };
}

/**
 * canvas 尺寸跟随「整个文档」（含滚动区域）+ dpr。
 * onFrame 收到的坐标全部是文档坐标系：w×h 为全页尺寸，scrollY 为当前滚动位置。
 * 页面变高变矮时会自动重置画布（调用方按 sizeRef 检测重绘）。
 */
function useCanvas(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  onFrame: (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    time: number,
    scrollY: number
  ) => void
) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = 0;
    let h = 0;

    /** 与当前文档尺寸对齐；尺寸变了返回 true（画布已被清空） */
    const syncSize = (): boolean => {
      const nextW = window.innerWidth;
      // 背景要覆盖滚动区域：取整页高度（上限 10000px 防超大画布爆内存）
      const nextH = Math.min(document.documentElement.scrollHeight, 10000);
      if (nextW === w && nextH === h) return false;
      w = nextW;
      h = nextH;
      // 页面很高时降 dpr，控制内存
      const dpr = Math.min(window.devicePixelRatio || 1, h > 2600 ? 1 : 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return true;
    };
    syncSize();
    const onResize = () => syncSize();
    window.addEventListener('resize', onResize);

    let raf = 0;
    const start = performance.now();
    const loop = (now: number) => {
      syncSize();
      onFrame(ctx, w, h, (now - start) / 1000, window.scrollY);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, [canvasRef, onFrame]);
}

/* ---------------- 模式①/④：磁吸点阵（canvas） ---------------- */

type Dot = { ox: number; oy: number; x: number; y: number; vx: number; vy: number };

function MagneticDots({ showBlobs }: { showBlobs: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dotsRef = useRef<Dot[]>([]);
  const { pointer } = usePointer();
  const frameRef = useRef<(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, scrollY: number) => void>(
    () => {}
  );
  // 「磁吸点阵」模式（showBlobs）点更密、磁力更强、点更大；「纯点阵」克制素净
  const gap = showBlobs ? 22 : 38;
  const radius = showBlobs ? 160 : 120;
  const forceScale = showBlobs ? 38 : 20;

  // 重建点阵（resize 时 canvas hook 会更新宽高，这里按面积估算足够）
  const rebuild = useCallback(
    (w: number, h: number) => {
      const dots: Dot[] = [];
      for (let y = gap / 2; y < h; y += gap) {
        for (let x = gap / 2; x < w; x += gap) {
          dots.push({ ox: x, oy: y, x, y, vx: 0, vy: 0 });
        }
      }
      dotsRef.current = dots;
    },
    [gap]
  );

  frameRef.current = (ctx, w, h, time, scrollY) => {
    const dots = dotsRef.current;
    if (dots.length === 0 || dots[dots.length - 1].oy < h - gap * 2 || dots[0].ox > w) {
      rebuild(w, h);
    }

    ctx.clearRect(0, 0, w, h);
    // 鼠标坐标（视口）→ 文档坐标
    const p = pointer.current;
    const px = p.x;
    const py = p.y + scrollY;

    for (const dot of dots) {
      // 被鼠标弹开：方向 = 点→鼠标 反方向，力度随距离衰减
      if (p.active) {
        const dx = dot.x - px;
        const dy = dot.y - py;
        const distSq = dx * dx + dy * dy;
        if (distSq < radius * radius && distSq > 0.01) {
          const dist = Math.sqrt(distSq);
          const force = ((radius - dist) / radius) * forceScale;
          dot.vx += (dx / dist) * force;
          dot.vy += (dy / dist) * force;
        }
      }
      // 弹簧回到归属位 + 阻尼
      dot.vx += (dot.ox - dot.x) * 0.06;
      dot.vy += (dot.oy - dot.y) * 0.06;
      dot.vx *= 0.82;
      dot.vy *= 0.82;
      dot.x += dot.vx;
      dot.y += dot.vy;

      // 位移越大点越橙（被"拨动"的手感反馈）
      const shift = Math.min(1, Math.hypot(dot.x - dot.ox, dot.y - dot.oy) / 18);
      const twinkle = 0.55 + 0.2 * Math.sin(time * 1.6 + dot.ox * 0.05 + dot.oy * 0.07);
      const alpha = twinkle * (0.35 + shift * 0.5);
      ctx.fillStyle = shift > 0.05
        ? `rgba(255, 178, 107, ${alpha})` // cartoon-orange
        : `rgba(43, 43, 69, ${alpha * 0.4})`; // ink
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, (showBlobs ? 2 : 1.4) + shift * 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  useCanvas(canvasRef, useCallback((ctx, w, h, t, scrollY) => frameRef.current(ctx, w, h, t, scrollY), []));

  return (
    <>
      {showBlobs && <AuroraBlobs subtle />}
      <canvas ref={canvasRef} className="absolute inset-0" />
    </>
  );
}

/* ---------------- 柔和色块（给磁吸点阵模式当背景配角） ---------------- */

type Blob = {
  hue: [number, number, number];
  r: number;
  speed: number;
  phaseX: number;
  phaseY: number;
  follow: number;
};

const BLOB_SPECS: Blob[] = [
  { hue: [255, 224, 102], r: 0.34, speed: 0.11, phaseX: 0.0, phaseY: 1.3, follow: 0.06 }, // lemon
  { hue: [255, 178, 107], r: 0.3, speed: 0.14, phaseX: 2.1, phaseY: 4.4, follow: 0.08 }, // orange
  { hue: [141, 227, 197], r: 0.28, speed: 0.09, phaseX: 4.2, phaseY: 0.7, follow: 0.05 }, // mint
  { hue: [207, 198, 255], r: 0.26, speed: 0.12, phaseX: 1.1, phaseY: 3.1, follow: 0.07 }, // grape/cloud
];

function AuroraCanvas({ intensity = 1 }: { intensity?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { pointer } = usePointer();
  const frameRef = useRef<(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, scrollY: number) => void>(
    () => {}
  );

  frameRef.current = (ctx, w, h, time, scrollY) => {
    ctx.clearRect(0, 0, w, h);
    const p = pointer.current;
    // 以滚动视口为中心漂移，并换算到文档坐标
    const viewTop = scrollY;
    const vh = window.innerHeight;
    const base = Math.max(w, vh);

    for (const blob of BLOB_SPECS) {
      // 熔岩灯漂移：两个正弦叠加出圆润的不规则路径
      const cx =
        w * (0.5 + 0.3 * Math.sin(time * blob.speed + blob.phaseX) + 0.08 * Math.sin(time * blob.speed * 2.3 + blob.phaseY)) +
        (p.active ? p.x - w / 2 : 0) * blob.follow;
      const cy =
        viewTop +
        vh * (0.5 + 0.28 * Math.cos(time * blob.speed * 1.2 + blob.phaseY) + 0.07 * Math.cos(time * blob.speed * 1.9 + blob.phaseX)) +
        (p.active ? (p.y - vh / 2) * blob.follow : 0);
      const r = base * blob.r;

      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      const [cr, cg, cb] = blob.hue;
      const peak = (0.22 + 0.05 * Math.sin(time * 0.7 + blob.phaseX)) * intensity;
      gradient.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, ${peak})`);
      gradient.addColorStop(1, `rgba(${cr}, ${cg}, ${cb}, 0)`);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  useCanvas(canvasRef, useCallback((ctx, w, h, t, scrollY) => frameRef.current(ctx, w, h, t, scrollY), []));
  return <canvas ref={canvasRef} className="absolute inset-0" />;
}

/** 轻量色块（给磁吸点阵模式当配角） */
function AuroraBlobs({ subtle }: { subtle?: boolean }) {
  return <AuroraCanvas intensity={subtle ? 0.8 : 1} />;
}

/* ---------------- 模式②：橡皮擦揭示（鼠标擦开奶油覆盖层，露出涂鸦图案） ---------------- */

/** 生成一张可平铺的卡通涂鸦瓦片（星星/波点/波浪线，全部主题色） */
function makeDoodleTile(): HTMLCanvasElement {
  const tile = document.createElement('canvas');
  const size = 110;
  tile.width = size;
  tile.height = size;
  const ctx = tile.getContext('2d');
  if (!ctx) return tile;

  // 手绘星星：ink 描边 + 主题色填充
  const drawStar = (cx: number, cy: number, r: number, rot: number, color: string) => {
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const rad = rot + (Math.PI / 5) * i;
      const rr = i % 2 === 0 ? r : r * 0.45;
      const x = cx + Math.cos(rad) * rr;
      const y = cy + Math.sin(rad) * rr;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(43,43,69,0.55)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
  };
  drawStar(26, 28, 10, -Math.PI / 2, 'rgba(255,224,102,0.95)'); // lemon
  drawStar(82, 74, 7.5, 0.4, 'rgba(141,227,197,0.9)'); // mint
  drawStar(56, 96, 5, 0.9, 'rgba(255,178,107,0.9)'); // orange

  const dot = (x: number, y: number, r: number, color: string) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  };
  dot(76, 20, 3.4, 'rgba(207,198,255,0.95)'); // grape
  dot(14, 70, 3, 'rgba(255,138,128,0.85)'); // coral
  dot(100, 44, 2.6, 'rgba(43,43,69,0.4)'); // ink
  dot(44, 52, 2.2, 'rgba(255,178,107,0.8)');

  // 波浪线
  ctx.strokeStyle = 'rgba(255,178,107,0.75)';
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(10, 48);
  ctx.quadraticCurveTo(18, 40, 26, 48);
  ctx.quadraticCurveTo(34, 56, 42, 48);
  ctx.stroke();

  return tile;
}

function EraserReveal() {
  const baseRef = useRef<HTMLCanvasElement | null>(null);
  const veilRef = useRef<HTMLCanvasElement | null>(null);
  const { pointer } = usePointer();
  const sizeRef = useRef({ w: 0, h: 0 });
  const frameRef = useRef<(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, scrollY: number) => void>(
    () => {}
  );

  // 底层：平铺涂鸦图案（覆盖整个文档，含滚动区域；resize 时重画）
  useEffect(() => {
    const paint = () => {
      const canvas = baseRef.current;
      if (!canvas) return;
      const w = window.innerWidth;
      const h = Math.min(document.documentElement.scrollHeight, 10000);
      const dpr = Math.min(window.devicePixelRatio || 1, h > 2600 ? 1 : 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const pattern = ctx.createPattern(makeDoodleTile(), 'repeat');
      if (pattern) {
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, w, h);
      }
    };
    paint();
    window.addEventListener('resize', paint);
    return () => window.removeEventListener('resize', paint);
  }, []);

  frameRef.current = (ctx, w, h, time, scrollY) => {
    // 尺寸变了（useCanvas 重置画布=全透明）：覆盖层重新糊满奶油色
    if (sizeRef.current.w !== w || sizeRef.current.h !== h) {
      sizeRef.current = { w, h };
      ctx.fillStyle = '#FFF9EC'; // cream
      ctx.fillRect(0, 0, w, h);
    }

    // 覆盖层自我修复：整层快速糊回不透明奶油色（擦过的痕迹约 1 秒复原）。
    // 注意：必须先糊后擦，鼠标下的洞才不会被糊掉。
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgba(255,249,236,0.08)';
    ctx.fillRect(0, 0, w, h);

    // 橡皮：只擦鼠标「当前」所在位置（视口坐标 → 文档坐标）
    const p = pointer.current;
    if (p.active) {
      ctx.globalCompositeOperation = 'destination-out';
      const px = p.x;
      const py = p.y + scrollY;
      const r = 72;
      const g = ctx.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(0.7, 'rgba(0,0,0,0.9)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  useCanvas(veilRef, useCallback((ctx, w, h, t, scrollY) => frameRef.current(ctx, w, h, t, scrollY), []));

  return (
    <>
      <canvas ref={baseRef} className="absolute inset-0" />
      <canvas ref={veilRef} className="absolute inset-0" />
    </>
  );
}


/* ---------------- 对外：BackgroundDecor + 切换器 ---------------- */

export function BackgroundDecor() {
  const mode = useBgMode();
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {mode === 'dots' && <MagneticDots showBlobs />}
      {mode === 'dotsOnly' && <MagneticDots showBlobs={false} />}
      {mode === 'reveal' && <EraserReveal />}
    </div>
  );
}

/** 左下角背景效果切换器（挂 layout 一次即可，全局可见） */
export function BackgroundModeSwitcher() {
  const mode = useBgMode();
  const [collapsed, setCollapsed] = useState(false);

  const pick = (next: BgMode) => writeMode(next);

  return (
    <div className="fixed bottom-5 left-5 z-[96] font-cartoon">
      {collapsed ? (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          title="展开背景效果切换器"
          className="grid h-9 w-9 place-items-center rounded-full border-[3px] border-ink bg-white text-sm shadow-[3px_3px_0_0_#2B2B45] transition-transform hover:-translate-y-0.5"
        >
          🎨
        </button>
      ) : (
        <div className="rounded-2xl border-[3px] border-ink bg-[#FFFDF7] p-2 shadow-[4px_4px_0_0_#2B2B45]">
          <div className="mb-1.5 flex items-center justify-between gap-2 px-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-ink/40">
              背景效果
            </span>
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              aria-label="收起背景切换器"
              className="rounded-md px-1 text-[11px] font-black text-ink/30 hover:bg-ink/5 hover:text-ink/60"
            >
              ─
            </button>
          </div>
          <div className="flex flex-col gap-1">
            {MODES.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => pick(item.key)}
                aria-pressed={mode === item.key}
                className={`rounded-xl border-2 px-2.5 py-1 text-left text-[11px] font-extrabold transition-all ${
                  mode === item.key
                    ? 'border-ink bg-lemon shadow-[2px_2px_0_0_#2B2B45]'
                    : 'border-transparent text-ink/45 hover:bg-ink/5 hover:text-ink/70'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
