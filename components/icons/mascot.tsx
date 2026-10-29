
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
      <path
        d="M50 13V7"
        stroke="#2B2B45"
        strokeWidth="4"
        strokeLinecap="round"
      />
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
      <path
        d="M19 62c-4 5-5 10-3 14"
        fill="none"
        stroke="#2B2B45"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M81 62c4 5 5 10 3 14"
        fill="none"
        stroke="#2B2B45"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}