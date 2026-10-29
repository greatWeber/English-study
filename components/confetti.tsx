import { motion } from "framer-motion";

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