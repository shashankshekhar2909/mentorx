"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useAuthStore } from "@/lib/auth-store";

export default function DashboardRouterPage() {
  const router = useRouter();
  const session = useAuthStore((s) => s.session);

  useEffect(() => {
    if (!session) {
      router.replace("/login");
      return;
    }

    router.replace(`/dashboard/${session.role}`);
  }, [router, session]);

  return <p className="text-sm text-black/70">Loading dashboard...</p>;
}
