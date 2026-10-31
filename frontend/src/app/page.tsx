"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    const hash = window.location.hash || "";
    const search = window.location.search || "";
    if (
      hash.includes("access_token=") ||
      search.includes("code=") ||
      search.includes("token_hash=")
    ) {
      window.location.replace(`/auth/callback${search}${hash}`);
      return;
    }
    router.replace("/discover");
  }, [router]);

  return (
    <div style={{ minHeight: "100vh", background: "#fcf6f0", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="spinner" />
    </div>
  );
}
