"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { extractSession, register } from "@/lib/auth";
import { useAuthStore } from "@/lib/auth-store";
import type { Role } from "@/lib/types";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["student", "mentor"]),
});

type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);

  const { register: formRegister, handleSubmit, formState } = useForm<FormValues>({
    defaultValues: { email: "", password: "", role: "student" },
  });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const parsed = schema.parse(values);
      return register(parsed.email, parsed.password, parsed.role as Role);
    },
    onSuccess: (tokens) => {
      setSession(extractSession(tokens));
      router.push("/dashboard");
    },
  });

  return (
    /* Full-screen dark background — pt-16 for the fixed nav */
    <div
      className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-4 py-24"
      style={{ background: "#05070f" }}
    >
      {/* Background radial glows */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width: 800,
          height: 600,
          background:
            "radial-gradient(ellipse, rgba(59,130,246,0.14) 0%, rgba(124,58,237,0.08) 40%, transparent 70%)",
          filter: "blur(60px)",
        }}
      />
      <div
        className="pointer-events-none absolute -right-40 -top-40 rounded-full"
        style={{
          width: 500,
          height: 500,
          background: "rgba(59,130,246,0.08)",
          filter: "blur(80px)",
        }}
      />
      <div
        className="pointer-events-none absolute -bottom-20 -left-20 rounded-full"
        style={{
          width: 400,
          height: 400,
          background: "rgba(124,58,237,0.07)",
          filter: "blur(80px)",
        }}
      />

      {/* Card */}
      <div
        className="relative w-full max-w-md rounded-[1.75rem] p-8"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)",
          backdropFilter: "blur(24px)",
        }}
      >
        {/* Logo + heading */}
        <div className="mb-8 text-center">
          <Link href="/" className="mb-6 inline-flex items-center gap-2">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black text-white"
              style={{
                background: "linear-gradient(135deg, #7c3aed, #3b82f6)",
                boxShadow: "0 4px 16px rgba(124,58,237,0.5)",
              }}
            >
              MX
            </div>
            <span
              className="text-lg font-black"
              style={{
                background: "linear-gradient(135deg, #a78bfa 0%, #60a5fa 60%, #34d399 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              MentorX
            </span>
          </Link>

          <h1 className="mt-2 text-2xl font-black text-white">Create your account</h1>
          <p className="mt-1 text-sm text-slate-500">Join 12,000+ students on mentorXAI</p>
        </div>

        {/* Role selector */}
        <div className="mb-6">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
            I am joining as a...
          </p>
          <div className="grid grid-cols-2 gap-3">
            {(["student", "mentor"] as const).map((r) => (
              <label
                key={r}
                className="relative cursor-pointer"
              >
                <input
                  type="radio"
                  value={r}
                  className="peer sr-only"
                  {...formRegister("role")}
                />
                <div
                  className="flex flex-col items-center gap-2 rounded-xl border px-4 py-4 text-center transition-all duration-200 peer-checked:border-violet-500/60 peer-checked:bg-violet-500/10"
                  style={{
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.03)",
                  }}
                >
                  <div className="text-2xl">
                    {r === "student" ? "🎓" : "📚"}
                  </div>
                  <span className="text-sm font-semibold capitalize text-slate-300">
                    {r}
                  </span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Form */}
        <form
          className="space-y-5"
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
        >
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Email
            </span>
            <input
              className="input-dark"
              type="email"
              placeholder="you@example.com"
              {...formRegister("email")}
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Password
            </span>
            <input
              className="input-dark"
              type="password"
              placeholder="Min. 6 characters"
              {...formRegister("password")}
            />
          </label>

          {mutation.isError && (
            <div
              className="rounded-xl px-4 py-3 text-sm text-rose-300"
              style={{
                background: "rgba(244,63,94,0.1)",
                border: "1px solid rgba(244,63,94,0.25)",
              }}
            >
              {(mutation.error as Error).message}
            </div>
          )}

          <button
            type="submit"
            disabled={mutation.isPending || formState.isSubmitting}
            className="cta-shimmer relative w-full rounded-xl py-3 text-sm font-bold text-white transition disabled:opacity-50"
            style={{
              background: "linear-gradient(135deg, #7c3aed, #3b82f6)",
              boxShadow: "0 4px 20px rgba(124,58,237,0.4)",
            }}
          >
            {mutation.isPending ? "Creating account..." : "Create account"}
          </button>
        </form>

        {/* Fine print */}
        <p className="mt-4 text-center text-xs text-slate-600">
          By joining, you agree to our Terms of Service and Privacy Policy.
        </p>

        {/* Footer link */}
        <p className="mt-4 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-violet-400 transition hover:text-violet-300"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
