import { Phase, CheckDetail } from "@/lib/type";
import { motion } from "framer-motion";

type BlankSlotProps = {
  answer: string;
  typed: string;
  order: number;
  phase: Phase;
  active: boolean;
  hint: boolean;
  detail?: CheckDetail;
  punctuation: string;
  registerInput: (order: number, el: HTMLInputElement | null) => void;
  onFocus: (order: number) => void;
  onChange: (order: number, value: string) => void;
  onKeyDown: (order: number, event: React.KeyboardEvent<HTMLInputElement>) => void;
};

export function BlankSlot({
  answer,
  typed,
  order,
  phase,
  active,
  hint,
  detail,
  punctuation,
  registerInput,
  onFocus,
  onChange,
  onKeyDown,
}: BlankSlotProps) {
  const isChecked = phase === 'checked';
  const isRevealed = phase === 'revealed';
  const isStatic = isChecked || isRevealed;
  const isCorrect = isChecked && !!detail?.correct;
  const isAlternative = isCorrect && !!detail?.alternative;
  const isWrong = isChecked && !!detail && !detail.correct;
  const width = Math.max(answer.length, typed.length, 2) + 0.8;

  let lineColor = '#8ED3F4';
  let highlight = 'bg-[#FFF6D6]';
  if (isRevealed) {
    lineColor = '#22C55E';
    highlight = 'bg-[#DCFCE7]';
  } else if (isAlternative) {
    // 近义/拼写替换：也对，但用天空蓝区分「逐字正确」
    lineColor = '#0EA5E9';
    highlight = 'bg-[#E0F2FE]';
  } else if (isCorrect) {
    lineColor = '#22C55E';
    highlight = 'bg-[#DCFCE7]';
  } else if (isWrong) {
    lineColor = '#EF4444';
    highlight = 'bg-[#FFE4E6]';
  } else if (active) {
    lineColor = '#FF9F1C';
    highlight = 'bg-lemon';
  } else if (typed.trim()) {
    lineColor = '#8B7CF6';
    highlight = 'bg-[#EDE9FE]';
  }

  const marks =
    isChecked && detail
      ? detail.marks
      : answer.split('').map((ch) => ({ ch, ok: isRevealed }));

  return (
    <span className="relative inline-flex items-center">
      <span
        className={`relative inline-flex h-[1.5em] items-center justify-center rounded-lg transition-all duration-150 ${
          active && !isStatic ? '-translate-y-0.5' : ''
        }`}
        style={{ width: `${width}ch` }}
      >
        <span
          className={`absolute inset-x-0.5 bottom-[0.13em] h-[0.62em] -rotate-1 rounded-[3px] ${highlight}`}
          aria-hidden
        />
        {!isStatic ? (
          <input
            ref={(el) => registerInput(order, el)}
            value={typed}
            onChange={(event) => onChange(order, event.target.value)}
            onFocus={() => onFocus(order)}
            onKeyDown={(event) => onKeyDown(order, event)}
            placeholder={hint ? `${answer[0]}…` : ''}
            aria-label={`第 ${order + 1} 个空，答案 ${answer.length} 个字母`}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            className="relative z-10 h-full w-full bg-transparent px-1 text-center font-cartoon font-extrabold leading-none text-ink caret-[#FF8A00] outline-none placeholder:text-ink/25"
          />
        ) : (
          <span
            className="relative z-10 flex h-full items-center justify-center px-1 font-extrabold leading-none"
            title={
              isAlternative && detail?.typed
                ? `接受了近义替换：${detail.typed}`
                : isWrong && detail?.typed
                  ? `你写的是：${detail.typed}`
                  : undefined
            }
          >
            {marks.map((mark, index) => (
              <span
                key={`${order}-mark-${index}`}
                className={
                  isAlternative
                    ? 'text-sky-700'
                    : isCorrect || isRevealed
                      ? 'text-green-700'
                      : mark.ok
                        ? 'text-green-700'
                        : 'text-red-500'
                }
              >
                {mark.ch}
              </span>
            ))}
            {isWrong && detail && detail.extra.length > 0 ? (
              <span className="ml-0.5 text-[0.55em] text-red-400 line-through">
                {detail.extra.join('')}
              </span>
            ) : null}
          </span>
        )}

        <svg
          viewBox="0 0 100 12"
          preserveAspectRatio="none"
          className={`pointer-events-none absolute -bottom-1 left-0 h-2.5 w-full ${
            active && !isStatic ? 'animate-dash' : ''
          }`}
          aria-hidden
        >
          <path
            d="M2 7 C 18 2, 34 11, 52 6 S 82 3, 98 7"
            fill="none"
            stroke={lineColor}
            strokeWidth="4"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            strokeDasharray={active && !isStatic ? '7 5' : undefined}
          />
        </svg>
      </span>

      {punctuation && (
        <span className="whitespace-nowrap text-ink/40">{punctuation}</span>
      )}

      {isStatic && (
        <span
          className={`absolute -right-2 -top-1 grid h-5 w-5 place-items-center rounded-full border-2 border-ink text-[10px] font-black text-white shadow-[1px_1px_0_0_#2B2B45] ${
            isAlternative
              ? 'bg-sky-400'
              : isCorrect || isRevealed
                ? 'bg-green-400'
                : 'bg-red-400'
          }`}
          aria-hidden
        >
          {isAlternative ? '≈' : isCorrect || isRevealed ? '✓' : '✕'}
        </span>
      )}

      {active && !isStatic && (
        <motion.span
          aria-hidden
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute -right-3 -top-4 text-sm"
        >
          ✨
        </motion.span>
      )}
    </span>
  );
}