"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <button
      onClick={logout}
      className="rounded-xl bg-[#faf9f5] px-4 py-2 text-sm font-medium text-[#4d4c48] shadow-[0_0_0_1px_#d1cfc5] transition hover:bg-[#e8e6dc]"
    >
      Logout
    </button>
  );
}
