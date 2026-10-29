import { StarDoodle } from "./icons/starDoodle";

export function BackgroundDecor() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="paper-dots absolute inset-0 opacity-50" />
      <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-lemon/50 blur-3xl" />
      <div className="absolute -right-20 top-16 h-80 w-80 rounded-full bg-cloud/40 blur-3xl" />
      <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-grape/30 blur-3xl" />
      <span className="absolute left-[5%] top-44 hidden -rotate-12 animate-float-slow text-4xl opacity-60 md:block">
        📚
      </span>
      <span
        className="absolute right-[6%] top-1/3 hidden rotate-12 animate-float-slow text-4xl opacity-60 md:block"
        style={{ animationDelay: '-2s' }}
      >
        ✏️
      </span>
      <span className="absolute bottom-28 left-[9%] hidden animate-float text-3xl opacity-50 md:block">
        ⭐
      </span>
      <span
        className="absolute bottom-44 right-[10%] hidden animate-float text-3xl opacity-50 lg:block"
        style={{ animationDelay: '-1s' }}
      >
        💡
      </span>
      <StarDoodle className="absolute right-[3%] top-10 h-10 w-10 text-ink/10" />
      <StarDoodle className="absolute bottom-16 left-[2%] h-6 w-6 text-ink/10" />
    </div>
  );
}