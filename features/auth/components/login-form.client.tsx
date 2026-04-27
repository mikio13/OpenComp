"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, hasSupabaseEnvVars } from "@/lib/utils";

export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!hasSupabaseEnvVars) {
      setError("Supabase credentials are not configured yet.");
      return;
    }

    const supabase = createClient();
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      router.push("/");
      router.refresh();
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "Unable to login.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="rounded-2xl border-[#f0eee6] bg-[#faf9f5] shadow-[0_0_0_1px_#f0eee6,0_4px_24px_rgba(0,0,0,0.05)]">
        <CardHeader>
          <CardTitle className="font-serif text-3xl font-medium text-[#141413]">
            Login
          </CardTitle>
          <CardDescription className="text-[#5e5d59]">
            Access your OpenComp workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin}>
            <div className="flex flex-col gap-5">
              <div className="grid gap-2">
                <Label htmlFor="email" className="text-[#4d4c48]">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-11 rounded-xl border-[#e8e6dc] bg-white text-[#141413] shadow-[0_0_0_1px_#f0eee6] focus-visible:ring-[#3898ec]"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password" className="text-[#4d4c48]">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-11 rounded-xl border-[#e8e6dc] bg-white text-[#141413] shadow-[0_0_0_1px_#f0eee6] focus-visible:ring-[#3898ec]"
                />
              </div>
              {error ? <p className="text-sm text-[#b53333]">{error}</p> : null}
              <Button
                type="submit"
                className="h-11 w-full rounded-xl bg-[#c96442] text-[#faf9f5] shadow-[0_0_0_1px_#c96442] hover:bg-[#b95739]"
                disabled={isLoading}
              >
                {isLoading ? "Logging in..." : "Login"}
              </Button>
            </div>
            <p className="mt-4 text-center text-sm text-[#5e5d59]">
              Need an account?{" "}
              <Link
                href="/auth/sign-up"
                className="font-medium text-[#c96442] underline-offset-4 hover:underline"
              >
                Sign up
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
