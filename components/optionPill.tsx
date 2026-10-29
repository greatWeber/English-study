
export function OptionPill({
  active,
  onClick,
  activeClass = 'bg-lemon',
  children,
}: {
  active: boolean;
  onClick: () => void;
  activeClass?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full border-[3px] border-ink px-3.5 py-1.5 text-xs font-extrabold transition-all duration-100 ${
        active
          ? `${activeClass} -translate-y-0.5 shadow-[3px_3px_0_0_#2B2B45]`
          : 'bg-white shadow-[2px_2px_0_0_#2B2B45] hover:-translate-y-0.5 hover:bg-[#FFF6D6]'
      }`}
    >
      {children}
    </button>
  );
}