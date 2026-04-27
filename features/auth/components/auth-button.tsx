import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseEnvVars } from "@/lib/utils";
import { LogoutButton } from "./logout-button.client";

export async function AuthButton() {
  if (!hasSupabaseEnvVars) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/auth/login"
          className="rounded-xl bg-[#faf9f5] px-4 py-2 text-sm font-medium text-[#4d4c48] shadow-[0_0_0_1px_#d1cfc5] transition hover:bg-[#e8e6dc]"
        >
          Login
        </Link>
        <Link
          href="/auth/sign-up"
          className="rounded-xl bg-[#c96442] px-4 py-2 text-sm font-medium text-[#faf9f5] shadow-[0_0_0_1px_#c96442] transition hover:bg-[#b95739]"
        >
          Sign up
        </Link>
      </div>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims;

  return user ? (
    <div className="flex items-center gap-3 text-sm text-[#5e5d59]">
      <span className="hidden max-w-48 truncate sm:inline">{user.email}</span>
      <LogoutButton />
    </div>
  ) : (
    <div className="flex items-center gap-2">
      <Link
        href="/auth/login"
        className="rounded-xl bg-[#faf9f5] px-4 py-2 text-sm font-medium text-[#4d4c48] shadow-[0_0_0_1px_#d1cfc5] transition hover:bg-[#e8e6dc]"
      >
        Login
      </Link>
      <Link
        href="/auth/sign-up"
        className="rounded-xl bg-[#c96442] px-4 py-2 text-sm font-medium text-[#faf9f5] shadow-[0_0_0_1px_#c96442] transition hover:bg-[#b95739]"
      >
        Sign up
      </Link>
    </div>
  );
}
