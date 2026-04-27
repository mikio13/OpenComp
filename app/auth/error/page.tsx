import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Suspense } from "react";

async function ErrorContent({
  searchParams,
}: {
  searchParams: Promise<{ error: string }>;
}) {
  const params = await searchParams;

  return (
    <>
      {params?.error ? (
        <p className="text-sm text-[#5e5d59]">
          Code error: {params.error}
        </p>
      ) : (
        <p className="text-sm text-[#5e5d59]">
          An unspecified error occurred.
        </p>
      )}
    </>
  );
}

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ error: string }>;
}) {
  return (
    <main className="flex min-h-svh w-full flex-col items-center bg-[#f5f4ed] p-6 text-[#141413] md:p-10">
      <div className="w-full max-w-sm">
        <Link href="/" className="font-serif text-xl font-medium">
          OpenComp
        </Link>
        <div className="flex min-h-[calc(100svh-7rem)] items-center">
          <Card className="w-full rounded-2xl border-[#f0eee6] bg-[#faf9f5] shadow-[0_0_0_1px_#f0eee6,0_4px_24px_rgba(0,0,0,0.05)]">
            <CardHeader>
              <CardTitle className="font-serif text-3xl font-medium">
                Something went wrong
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Suspense>
                <ErrorContent searchParams={searchParams} />
              </Suspense>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
