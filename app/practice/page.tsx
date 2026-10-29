'use client';

import { BackgroundDecor, Mascot } from "@/components/cartoon";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { PracticePageContent } from "./practicePageContent";



function SearchParamsWrapper({
  children,
}: {
  children: (params: URLSearchParams) => React.ReactNode;
}) {
  const searchParams = useSearchParams();
  return <>{children(searchParams)}</>;
}



export default function PracticePage() {
  return (
    <Suspense
      fallback={
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-cream font-cartoon text-ink">
          <BackgroundDecor />
          <div className="relative z-10 flex flex-col items-center gap-5">
            <Mascot className="h-24 w-24 animate-float" />
            <div className="rounded-2xl border-[3px] border-ink bg-white px-6 py-3 text-sm font-extrabold shadow-[4px_4px_0_0_#2B2B45]">
              正在翻开练习本…
            </div>
          </div>
        </div>
      }
    >
      <SearchParamsWrapper>
        {(searchParams) => <PracticePageContent searchParams={searchParams} />}
      </SearchParamsWrapper>
    </Suspense>
  );
}
