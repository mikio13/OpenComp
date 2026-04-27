import Link from "next/link";
import { SignUpForm } from "@/features/auth/components/sign-up-form.client";

export default function Page() {
  return (
    <main className="flex min-h-svh w-full flex-col items-center bg-[#f5f4ed] p-6 text-[#141413] md:p-10">
      <div className="w-full max-w-sm">
        <Link href="/" className="font-serif text-xl font-medium">
          OpenComp
        </Link>
        <div className="flex min-h-[calc(100svh-7rem)] items-center">
          <SignUpForm className="w-full" />
        </div>
      </div>
    </main>
  );
}
