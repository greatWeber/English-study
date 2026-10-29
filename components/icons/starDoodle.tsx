
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