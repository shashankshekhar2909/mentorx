"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { extractSession, login } from "@/lib/auth";
import { useAuthStore } from "@/lib/auth-store";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);

  const { register: formRegister, handleSubmit, formState } = useForm<FormValues>({
    defaultValues: { email: "", password: "" }
  });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const parsed = schema.parse(values);
      return login(parsed.email, parsed.password);
    },
    onSuccess: (tokens) => {
      setSession(extractSession(tokens));
      router.push("/dashboard");
    }
  });

  return (
    <section className="mx-auto max-w-md space-y-4">
      <div className="rounded-2xl bg-gradient-to-r from-teal-700 to-cyan-700 p-5 text-white shadow-lg">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/80">MentorX</p>
        <h1 className="mt-1 text-2xl font-extrabold">Sign in</h1>
        <p className="mt-1 text-sm text-white/85">Use your registered MentorX account.</p>
      </div>
      <div className="app-card p-6">
      <form className="mt-6 space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Email</span>
          <input className="w-full rounded-md border px-3 py-2" type="email" {...formRegister("email")} />
        </label>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Password</span>
          <input className="w-full rounded-md border px-3 py-2" type="password" {...formRegister("password")} />
        </label>
        {mutation.isError && <p className="text-sm text-red-600">{(mutation.error as Error).message}</p>}
        <button
          type="submit"
          disabled={mutation.isPending || formState.isSubmitting}
          className="w-full rounded-md bg-accent px-4 py-2 font-semibold text-white disabled:opacity-50"
        >
          {mutation.isPending ? "Signing in..." : "Sign in"}
        </button>
      </form>
      <p className="mt-4 text-sm text-black/70">
        New here? <Link className="font-semibold text-accent" href="/register">Create an account</Link>
      </p>
      </div>
    </section>
  );
}
