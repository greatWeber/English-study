'use client';

import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';

export type ThemedCaretShape = 'bar' | 'block';

export type ThemedCaretProps = {
  /** 要接管光标的 input / textarea */
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  /** 父级状态机：当前是否可编辑（批改 / 看答案阶段传 false） */
  active: boolean;
  /** 受控值：变化时重算，覆盖「程序赋值」这类不触发 input 事件的情况 */
  value?: string;
  /** bar = 圆角粗竖条；block = 半透明方块盖住待输入的字母 */
  shape?: ThemedCaretShape;
  /** 主色，默认卡通橙 */
  color?: string;
  className?: string;
};

/** 镜像元素需要照抄的样式（少一个，量出来的位置就会偏） */
const MIRROR_PROPS = [
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'fontVariant',
  'fontStretch',
  'letterSpacing',
  'wordSpacing',
  'textTransform',
  'lineHeight',
  'textIndent',
  'whiteSpace',
  'overflowWrap',
  'wordBreak',
  'tabSize',
  'direction',
] as const;

/** 原生 caret-color 的原值，卸载时还原（避免留下「没有光标」的输入框） */
const nativeCaretColor = new WeakMap<HTMLInputElement | HTMLTextAreaElement, string>();

let mirrorEl: HTMLDivElement | null = null;

function ensureMirror(): HTMLDivElement {
  if (mirrorEl) return mirrorEl;
  const el = document.createElement('div');
  el.setAttribute('aria-hidden', 'true');
  el.style.position = 'fixed';
  el.style.top = '0';
  el.style.left = '0';
  el.style.visibility = 'hidden';
  el.style.pointerEvents = 'none';
  el.style.zIndex = '-1';
  el.style.width = 'auto';
  el.style.height = 'auto';
  el.style.margin = '0';
  el.style.padding = '0';
  el.style.border = '0';
  document.body.appendChild(el);
  mirrorEl = el;
  return el;
}

type CaretGeom = {
  /** 光标左边缘（相对输入框边框盒） */
  x: number;
  /** 光标所在行的顶部 */
  y: number;
  /** 该行文字高度 */
  height: number;
  /** block 形态时方块的宽度（下一个字符宽） */
  blockWidth: number;
};

/** 用隐藏镜像 + Range 量出光标该落在哪（支持单行与 textarea 多行） */
function measureCaret(
  input: HTMLInputElement | HTMLTextAreaElement,
  shape: ThemedCaretShape
): CaretGeom | null {
  const mirror = ensureMirror();
  const computed = getComputedStyle(input);
  const mirrorStyle = mirror.style as unknown as Record<string, string>;
  const computedStyle = computed as unknown as Record<string, string>;

  for (const prop of MIRROR_PROPS) mirrorStyle[prop] = computedStyle[prop];

  const padL = parseFloat(computed.paddingLeft) || 0;
  const padR = parseFloat(computed.paddingRight) || 0;
  const padT = parseFloat(computed.paddingTop) || 0;
  const borderL = parseFloat(computed.borderLeftWidth) || 0;
  const borderT = parseFloat(computed.borderTopWidth) || 0;
  const borderR = parseFloat(computed.borderRightWidth) || 0;
  const fontSize = parseFloat(computed.fontSize) || 16;

  // 镜像宽度 = 输入框内容宽，并照抄 text-align，这样居中文本的偏移由布局自己算
  // 注意：Chrome 的 <input> clientWidth 不含 padding（<textarea> 含），不能直接用 clientWidth，
  // 统一用 offsetWidth 反推；textarea 有滚动条时再减掉滚动条宽（clientWidth 本来就排除它）
  const isTextarea = input instanceof HTMLTextAreaElement;
  const padBox = Math.max(0, input.offsetWidth - borderL - borderR);
  const scrollbar = isTextarea ? Math.max(0, padBox - input.clientWidth) : 0;
  mirror.style.width = `${Math.max(0, padBox - padL - padR - scrollbar)}px`;
  mirrorStyle.textAlign = computedStyle.textAlign;

  const raw = input.value ?? '';
  // 空值塞一个零宽空格：Range 在空文本/折叠位置会返回零矩形，拿不到行高
  const text = raw.length > 0 ? raw : '\u200b';
  mirror.textContent = text;
  const node = mirror.firstChild;
  if (!node) return null;

  const len = text.length;
  const pos = Math.max(0, Math.min(input.selectionStart ?? 0, raw.length));
  // 末尾 +1 是为了让 Range 非折叠（零宽空格也算一个字符）
  const end = Math.min(pos + 1, len);

  const before = document.createRange();
  before.setStart(node, 0);
  before.setEnd(node, end);
  const rects = before.getClientRects();
  // 取最后一段矩形：它就在光标所在行，right 即光标 x
  const last = rects.length > 0 ? rects[rects.length - 1] : before.getBoundingClientRect();
  const mirrorBox = mirror.getBoundingClientRect();

  const x = borderL + padL - input.scrollLeft + (last.right - mirrorBox.left);
  const y = borderT + padT - input.scrollTop + (last.top - mirrorBox.top);
  const height = last.height || parseFloat(computed.lineHeight) || fontSize * 1.2;

  let blockWidth = 0;
  if (shape === 'block' && pos < len) {
    const next = document.createRange();
    next.setStart(node, pos);
    next.setEnd(node, Math.min(pos + 1, len));
    blockWidth = next.getBoundingClientRect().width;
  }
  if (shape === 'block' && blockWidth < 1) blockWidth = fontSize * 0.55;

  return { x, y, height, blockWidth };
}

export function ThemedCaret({
  inputRef,
  active,
  value,
  shape = 'bar',
  color = '#FF8A00',
  className,
}: ThemedCaretProps) {
  const caretRef = useRef<HTMLSpanElement | null>(null);
  const placedRef = useRef({ x: 0, y: 0 });
  const lastValueRef = useRef<string | undefined>(undefined);
  const [focused, setFocused] = useState(false);
  const visible = active && focused;

  // 单独跟踪 focus：mount 时输入框可能已经被自动聚焦，那时不会再有 focus 事件
  useEffect(() => {
    const input = inputRef.current;
    if (!input || !active) return;
    if (document.activeElement === input) setFocused(true);
    const onFocus = () => setFocused(true);
    const onBlur = () => setFocused(false);
    input.addEventListener('focus', onFocus);
    input.addEventListener('blur', onBlur);
    return () => {
      input.removeEventListener('focus', onFocus);
      input.removeEventListener('blur', onBlur);
      setFocused(false);
    };
  }, [inputRef, active]);

  useEffect(() => {
    const input = inputRef.current;
    const caret = caretRef.current;
    if (!input || !caret || !visible) return;

    const reduceMotion = () =>
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const place = () => {
      const geom = measureCaret(input, shape);
      if (!geom) return;

      const start = input.selectionStart ?? 0;
      const collapsed = (input.selectionEnd ?? 0) === start;
      // 有选区时交给原生高亮，别画蛇添足
      // （用 visibility 而非 opacity：opacity 正被闪烁动画接管，内联样式压不住它）
      caret.style.visibility = collapsed ? '' : 'hidden';
      if (!collapsed) return;

      const height = geom.height * (shape === 'block' ? 1 : 0.95);
      const width = shape === 'block' ? Math.max(geom.blockWidth, 2) : Math.max(2, height * 0.12);
      const x = shape === 'block' ? geom.x : geom.x - width / 2;
      const y = geom.y + (geom.height - height) / 2;

      caret.style.width = `${width}px`;
      caret.style.height = `${height}px`;
      caret.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      placedRef.current = { x, y };

      // 量到位置后才藏原生光标：测量失败（极端情况下）至少还有一个默认竖线
      if (!nativeCaretColor.has(input)) nativeCaretColor.set(input, input.style.caretColor);
      input.style.caretColor = 'transparent';
    };

    // 打字反馈：新字母落下的瞬间，光标像笔尖一样被压扁一下
    const pop = () => {
      if (shape !== 'bar' || reduceMotion()) return;
      const { x, y } = placedRef.current;
      caret.animate?.(
        [
          { transform: `translate3d(${x}px, ${y}px, 0) scale(1)` },
          { transform: `translate3d(${x}px, ${y}px, 0) scale(1.85, 0.7)`, offset: 0.45 },
          { transform: `translate3d(${x}px, ${y}px, 0) scale(1)` },
        ],
        { duration: 150, easing: 'ease-out' }
      );
    };

    const changed = lastValueRef.current !== undefined && lastValueRef.current !== value;
    lastValueRef.current = value;
    place();
    if (changed) pop();

    const onSelect = () => place();
    const events = [
      'input',
      'keyup',
      'keydown',
      'click',
      'select',
      'change',
      'scroll',
      'cut',
      'paste',
      'compositionupdate',
      'compositionend',
    ] as const;
    for (const name of events) input.addEventListener(name, onSelect);

    // textarea 会随内容长高、窗口缩放、字体迟到 => 统一用 ResizeObserver + fonts.ready
    const observer = new ResizeObserver(() => place());
    observer.observe(input);
    let alive = true;
    document.fonts?.ready.then(() => alive && place()).catch(() => {});

    return () => {
      alive = false;
      for (const name of events) input.removeEventListener(name, onSelect);
      observer.disconnect();
      const original = nativeCaretColor.get(input);
      if (original !== undefined) {
        input.style.caretColor = original;
        nativeCaretColor.delete(input);
      }
      caret.style.visibility = '';
    };
  }, [inputRef, shape, value, visible]);

  if (!visible) return null;

  return (
    <span
      ref={caretRef}
      aria-hidden
      data-shape={shape}
      className={clsx(
        'themed-caret pointer-events-none absolute left-0 top-0 z-20 select-none',
        shape === 'block' ? 'themed-caret--block' : 'themed-caret--bar',
        className
      )}
      style={{ ['--themed-caret-color' as string]: color }}
    />
  );
}

export default ThemedCaret;