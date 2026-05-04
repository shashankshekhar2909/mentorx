"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuthStore } from "@/lib/auth-store";

export default function DashboardRouterPage() {
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!session) {
      router.replace("/login");
      return;
    }

    router.replace(`/dashboard/${session.role}`);
  }, [router, session, hasHydrated]);

  return (
    <div className="flex min-h-screen w-full items-center justify-center" style={{ background: "#05070f" }}>
      <p className="text-sm text-slate-500">Loading dashboard...</p>
    </div>
  );
}
