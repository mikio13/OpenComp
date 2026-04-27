import Link from "next/link";
import { Suspense } from "react";
import { AuthButton } from "@/features/auth/components/auth-button";
import { ResearchWorkbench } from "@/features/research/components/research-workbench.client";

export function LandingPage() {
  return (
    <main className="min-h-screen bg-[#f5f4ed] text-[#141413]">
      <header className="border-b border-[#e8e6dc] bg-[#f5f4ed]/95">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5">
          <Link href="/" className="font-serif text-xl font-medium">
            OpenComp
          </Link>
          <Suspense
            fallback={
              <div className="h-10 w-32 rounded-xl bg-[#faf9f5] shadow-[0_0_0_1px_#f0eee6]" />
            }
          >
            <AuthButton />
          </Suspense>
        </div>
      </header>

      <section className="mx-auto w-full max-w-6xl px-5 py-8 lg:py-10">
        <ResearchWorkbench />
      </section>
    </main>
  );
}
