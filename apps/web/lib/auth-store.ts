"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { Session } from "@/lib/types";

type AuthState = {
  session: Session | null;
  hasHydrated: boolean;
  setSession: (session: Session) => void;
  updateSession: (patch: Partial<Session>) => void;
  clearSession: () => void;
  setHasHydrated: (value: boolean) => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      session: null,
      hasHydrated: false,
      setSession: (session) => set({ session }),
      updateSession: (patch) => set((state) => ({ session: state.session ? { ...state.session, ...patch } : state.session })),
      clearSession: () => set({ session: null }),
      setHasHydrated: (value) => set({ hasHydrated: value })
    }),
    {
      name: "exammentor-auth",
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      }
    }
  )
);
