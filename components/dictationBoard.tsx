'use client';

import { useEffect, useRef } from 'react';
import { CheckCircle2, Languages } from 'lucide-react';
import type { CheckDetail, Phase } from '@/lib/type';
import {
  buildDictationHint,
  countDictationWords,
  splitDictation,
} from '@/lib/utils';

type DictationBoardProps = {
  text: string;
  zh?: string | null;
  phase: Phase;
  typed: string;
  showZh: boolean;
  hint: boolean;
  allCorrect: boolean;
  detailByOrder: Map<number, CheckDetail>;
  extraWords: string[];
  registerInput: (el: HTMLTextAreaElement | null) => void;
  onChange: (value: string) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
};

export function DictationBoard({
  text,
  zh,
  phase,
  typed,
  showZh,
  hint,
  allCorrect,
  detailByOrder,
  extraWords,
  registerInput,
  onChange,
  onKeyDown,
}: DictationBoardProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const wordCount = countDictationWords(typed);

  // 输入框随内容长高，避免长句只能在小框里滚动
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(116, Math.min(el.scrollHeight, 280))}px`;
  }, [typed, phase]);

  const setTextareaRef = (el: HTMLTextAreaElement | null) => {
    textareaRef.current = el;
    registerInput(el);
  };

  if (phase === 'typing') {
    return (
      <div className="relative z-10 mx-auto max-w-3xl">
        {showZh ? (
          <div className="mx-auto max-w-2xl rounded-2xl border-2 border-dashed border-ink/25 bg-white/85 px-5 py-4 text-center shadow-[3px_3px_0_0_rgba(43,43,69,0.08)]">
            <p className="mb-1.5 flex items-center justify-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-ink/40">
              <Languages size={13} strokeWidth={3} />
              中文提示 · 看中文写英文
            </p>
            <p className="text-lg font-extrabold leading-relaxed text-ink/80 md:text-xl">
              {zh || '这道题暂时没有中文翻译，凭记忆写出完整英文句子吧～'}
            </p>
          </div>
        ) : (
          <div className="mx-auto max-w-2xl rounded-2xl border-2 border-dashed border-ink/15 bg-white/55 px-5 py-3 text-center text-[11px] font-extrabold text-ink/40">
            中文提示已隐藏 · 点下方「中文」恢复
          </div>
        )}

        {hint && (
          <div className="mx-auto mt-4 max-w-2xl rounded-2xl border-2 border-lemon bg-[#FFF9D6] px-4 py-2.5 text-center">
            <p className="mb-1 text-[10px] font-black tracking-[0.18em] text-ink/40">
              首字母提示
            </p>
            <p className="break-words text-sm font-bold leading-relaxed tracking-[0.12em] text-ink/65">
              {buildDictationHint(text)}
            </p>
          </div>
        )}

        <label className="relative mt-4 block">
          <span className="sr-only">写出完整的英文句子</span>
          <textarea
            ref={setTextareaRef}
            value={typed}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={onKeyDown}
            rows={3}
            placeholder="在这里写出完整的英文句子…"
            aria-label="整句默写输入框"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            className="w-full resize-none overflow-y-auto rounded-[24px] border-[3px] border-ink bg-white px-5 py-4 font-cartoon text-lg font-bold leading-relaxed text-ink shadow-[4px_4px_0_0_#2B2B45] outline-none transition-all placeholder:text-ink/25 focus:border-cartoon-orange focus:shadow-[4px_4px_0_0_#FFB26B] md:text-xl"
          />
        </label>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1 text-[11px] font-bold text-ink/35">
          <span>标点 / 大小写不计入错误 · Shift + Enter 换行</span>
          <span className="ink-pill border-ink/10 bg-white/80 py-0.5 text-[10px] text-ink/45">
            已写 {wordCount} 个词
          </span>
        </div>
      </div>
    );
  }

  const parts = splitDictation(text);

  return (
    <div className="relative z-10 mx-auto max-w-3xl">
      <div
        className={`rounded-[24px] border-[3px] border-ink bg-white px-5 py-4 shadow-[4px_4px_0_0_#2B2B45] ${
          phase === 'checked' && allCorrect ? 'bg-[#F0FFF5]' : ''
        }`}
      >
        <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-ink/40">
          <CheckCircle2 size={13} strokeWidth={3} />
          {phase === 'revealed' ? '参考句子' : '正确句子'}
        </p>
        <p className="text-left text-[22px] font-bold leading-[1.75] md:text-[27px]">
          {parts.map((part, index) => {
            if (!part.isWord) {
              return (
                <span key={`part-${index}`} className="text-ink/40">
                  {part.text}
                </span>
              );
            }
            const detail = detailByOrder.get(part.wordIndex ?? -1);
            const ok = phase === 'revealed' || !detail || detail.correct;
            return (
              <span
                key={`part-${index}`}
                className={
                  ok
                    ? 'text-green-700'
                    : 'text-red-500 underline decoration-red-300 decoration-2 underline-offset-4'
                }
              >
                {part.text}
              </span>
            );
          })}
        </p>
      </div>

      {phase === 'checked' && (
        <div
          className={`mt-3 rounded-2xl border-2 border-dashed px-4 py-3 ${
            allCorrect
              ? 'border-green-300 bg-green-50'
              : 'border-red-200 bg-[#FFF5F5]'
          }`}
        >
          <p className="mb-1 text-[10px] font-black uppercase tracking-[0.16em] text-ink/40">
            你的答案
          </p>
          <p className="whitespace-pre-wrap break-words text-sm font-bold leading-relaxed text-ink/70">
            {typed.trim() || '（没有写）'}
          </p>
          {extraWords.length > 0 && (
            <p className="mt-2 flex flex-wrap items-center gap-1 text-[11px] font-bold text-red-500">
              <span className="rounded-full border border-red-200 bg-white px-2 py-0.5">
                多写了
              </span>
              <span className="line-through decoration-2">
                {extraWords.join(' / ')}
              </span>
            </p>
          )}
        </div>
      )}

      {showZh && zh && (
        <div className="mx-auto mt-4 flex max-w-2xl items-start justify-center gap-2 rounded-2xl border-2 border-dashed border-ink/25 bg-white/85 px-4 py-2.5 text-center text-sm font-bold leading-relaxed text-ink/65">
          <Languages size={16} strokeWidth={2.5} className="mt-0.5 shrink-0" />
          <span>{zh}</span>
        </div>
      )}
    </div>
  );
}
