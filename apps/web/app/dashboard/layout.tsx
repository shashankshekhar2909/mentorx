"use client";

import { useRouter } from "next/navigation";
import { ReactNode, useEffect } from "react";

import { useAuthStore } from "@/lib/auth-store";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const session = useAuthStore((s) => s.session);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!session) {
      router.replace("/login");
    }
  }, [session, router, hasHydrated]);

  if (!hasHydrated) {
    return <p className="px-6 py-10 text-sm text-black/70">Loading workspace...</p>;
  }

  if (!session) {
    return <p className="px-6 py-10 text-sm text-black/70">Redirecting to login...</p>;
  }

  return <>{children}</>;
}
