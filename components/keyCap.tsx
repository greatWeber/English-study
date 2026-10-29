
export function KeyCap({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-md border-2 border-ink/20 bg-white px-1.5 py-0.5 text-[10px] font-black text-ink/55">
      {children}
    </kbd>
  );
}