"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/discover");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
    </div>
  );
}

