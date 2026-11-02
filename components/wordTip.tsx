'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import type { WordEntry } from '@/lib/dictionary';

/** 选区位置（视口坐标）：x=水平中心，top/bottom=选区上下缘，below=空间不足时翻到下方 */
type Anchor = { x: number; top: number; bottom: number; below: boolean };

type TipState = {
  entry: WordEntry;
  tags: string[];
  anchor: Anchor;
};

/** 气泡大约的高度（含尖角），用于判断上方是否放得下 */
const TIP_ESTIMATED_HEIGHT = 240;

const MAX_WORD_LEN = 24;

/** 选区文字是否像一个「可查的单词」（拒绝对话串、带空格短语、纯数字） */
function asLookupWord(text: string): string | null {
  const t = text.trim().replace(/[\u2018\u2019]/g, "'");
  if (!t || t.length > MAX_WORD_LEN || /\s/.test(t)) return null;
  if (!/^[A-Za-z][A-Za-z'-]*$/.test(t)) return null;
  return t;
}

/**
 * 全局划词查词：鼠标选中一个英文单词 → 气泡显示音标 + 中文释义。
 * 挂在 RootLayout 上，所有页面生效。
 */
export function WordTipProvider({ children }: { children: React.ReactNode }) {
  const [tip, setTip] = useState<TipState | null>(null);
  const [loadingPos, setLoadingPos] = useState<Anchor | null>(null);
  const reqSeq = useRef(0);

  const clear = useCallback(() => {
    reqSeq.current += 1;
    setTip(null);
    setLoadingPos(null);
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    const anchorFor = (rect: DOMRect): Anchor => ({
      x: rect.left + rect.width / 2,
      top: rect.top,
      bottom: rect.bottom,
      // 上方放不下（且下方更宽敞）时翻到下方
      below: rect.top < TIP_ESTIMATED_HEIGHT && window.innerHeight - rect.bottom > rect.top,
    });

    const lookup = async (word: string, rect: DOMRect) => {
      const seq = ++reqSeq.current;
      const anchor = anchorFor(rect);
      setLoadingPos(anchor);
      try {
        const res = await fetch(`/api/dict?word=${encodeURIComponent(word)}`);
        const data = await res.json();
        if (seq !== reqSeq.current) return; // 期间又选了别的词 / 已清除
        if (data?.ok && data.found) {
          setTip({ entry: data.entry, tags: data.tags || [], anchor });
        } else {
          setTip(null);
        }
      } catch {
        /* 查词失败保持安静 */
      } finally {
        if (seq === reqSeq.current) setLoadingPos(null);
      }
    };

    const handleMouseUp = (event: MouseEvent) => {
      // 输入框里选词不查（会打断默写输入）；气泡自身上的点击也不查
      const target = event.target as HTMLElement;
      if (
        target.closest('input, textarea, [contenteditable="true"], [data-word-tip]') ||
        target.isContentEditable
      ) {
        return;
      }

      if (timer) clearTimeout(timer);
      // 让浏览器先落定选区，再取文本
      timer = setTimeout(() => {
        const selection = window.getSelection();
        const text = selection ? selection.toString() : '';
        const word = asLookupWord(text);
        if (!word) {
          clear();
          return;
        }
        const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
        const rect = range?.getBoundingClientRect();
        if (!rect || (rect.width === 0 && rect.height === 0)) return;
        lookup(word, rect);
      }, 120);
    };

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') clear();
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keydown', handleKey);
    window.addEventListener('scroll', clear, true);
    window.addEventListener('resize', clear);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('keydown', handleKey);
      window.removeEventListener('scroll', clear, true);
      window.removeEventListener('resize', clear);
    };
  }, [clear]);

  return (
    <>
      {children}
      <AnimatePresence>
        {loadingPos && (
          <div
            data-word-tip
            className="pointer-events-none fixed z-[95] -translate-x-1/2 font-cartoon"
            style={
              loadingPos.below
                ? { left: loadingPos.x, top: loadingPos.bottom + 10 }
                : { left: loadingPos.x, bottom: window.innerHeight - loadingPos.top + 10 }
            }
          >
            <div className="rounded-xl border-2 border-ink bg-white px-3 py-1.5 text-[11px] font-extrabold text-ink/50 shadow-[3px_3px_0_0_#2B2B45]">
              查词典中…
            </div>
          </div>
        )}
        {tip && (
          <div
            data-word-tip
            className="fixed z-[95] w-[290px] max-w-[86vw] -translate-x-1/2 font-cartoon"
            style={{
              left: Math.min(Math.max(tip.anchor.x, 150), window.innerWidth - 150),
              ...(tip.anchor.below
                ? { top: tip.anchor.bottom + 10 }
                : { bottom: window.innerHeight - tip.anchor.top + 10 }),
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
              style={{ transformOrigin: tip.anchor.below ? 'top center' : 'bottom center' }}
            >
              {tip.anchor.below && (
                /* 指向选区的尖角（翻到下方时朝上） */
                <div
                  className="relative z-10 -mb-[6px] h-3 w-3 rotate-45 border-l-[3px] border-t-[3px] border-ink bg-[#FFFDF7]"
                  style={{ marginLeft: 'calc(50% - 6px)' }}
                />
              )}
              <div className="relative rounded-2xl border-[3px] border-ink bg-[#FFFDF7] px-4 pb-3 pt-2.5 shadow-[5px_5px_0_0_#2B2B45]">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-xl font-extrabold leading-snug text-ink">
                    {tip.entry.word}
                    {tip.entry.infOf && (
                      <span className="ml-2 align-middle text-[10px] font-black text-ink/45">
                        {tip.entry.infLabel} · {tip.entry.infOf}
                      </span>
                    )}
                  </p>
                  {tip.entry.phonetic && (
                    <p className="mt-0.5 font-mono text-[13px] font-bold text-cartoon-blue">
                      /{tip.entry.phonetic}/
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={clear}
                  aria-label="关闭词典气泡"
                  className="-mr-1 -mt-0.5 shrink-0 rounded-lg p-1 text-ink/30 transition-colors hover:bg-ink/5 hover:text-ink/70"
                >
                  <X size={15} strokeWidth={3} />
                </button>
              </div>

              <div className="mt-1.5 space-y-1 border-t-2 border-dashed border-ink/15 pt-2">
                {tip.entry.translation.split('\n').map((line, index) => (
                  <p key={index} className="text-[13px] font-bold leading-relaxed text-ink/75">
                    {line}
                  </p>
                ))}
              </div>

              {(tip.tags.length > 0 || tip.entry.collins > 0) && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {tip.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border-2 border-cartoon-blue/50 bg-cartoon-blue/15 px-2 py-px text-[10px] font-black text-ink/60"
                    >
                      {tag}
                    </span>
                  ))}
                  {tip.entry.collins > 0 && (
                    <span className="text-[10px] font-black text-lemon [text-shadow:0_0_2px_#2B2B45]">
                      {'★'.repeat(Math.min(tip.entry.collins, 5))}
                    </span>
                  )}
                </div>
              )}
              </div>
              {!tip.anchor.below && (
                /* 指向选区的尖角（默认在上方时朝下） */
                <div className="relative z-10 -mt-[6px] h-3 w-3 rotate-45 border-b-[3px] border-r-[3px] border-ink bg-[#FFFDF7]" style={{ marginLeft: 'calc(50% - 6px)' }} />
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
