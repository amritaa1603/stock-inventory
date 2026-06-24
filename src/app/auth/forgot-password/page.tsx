"use client";
import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { createClient } from "@/lib/supabase";
import { Package, Loader2, CheckCircle2, ArrowLeft } from "lucide-react";

const schema = z.object({
  email: z.string().email("Invalid email address"),
});
type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [sentTo, setSentTo] = useState("");
  const supabase = createClient();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  async function onSubmit(data: FormData) {
    // Always show success — prevents email enumeration
    await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/settings`,
    });
    setSentTo(data.email);
    setSent(true);
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2.5 mb-8 justify-center">
            <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center">
              <Package size={18} className="text-white" />
            </div>
            <span className="text-xl font-semibold text-white">StockFlow</span>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-7 text-center">
            <div className="w-12 h-12 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={24} className="text-indigo-400" />
            </div>
            <h1 className="text-lg font-semibold text-white mb-2">Check your email</h1>
            <p className="text-sm text-zinc-400 leading-relaxed">
              If <span className="text-zinc-300 font-medium">{sentTo}</span> is registered,
              we&apos;ve sent a password reset link. Check your inbox and spam folder.
            </p>
            <p className="mt-4 text-xs text-zinc-600">
              The link expires in 1 hour.
            </p>
          </div>

          <p className="mt-5 text-xs text-zinc-500 text-center">
            <Link
              href="/auth/login"
              className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              <ArrowLeft size={12} /> Back to sign in
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center">
            <Package size={18} className="text-white" />
          </div>
          <span className="text-xl font-semibold text-white">StockFlow</span>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-7">
          <h1 className="text-lg font-semibold text-white mb-1">Reset your password</h1>
          <p className="text-sm text-zinc-500 mb-6">
            Enter your email and we&apos;ll send a reset link.
          </p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                Email address
              </label>
              <input
                {...register("email")}
                type="email"
                autoComplete="email"
                autoFocus
                placeholder="you@company.com"
                className="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              {errors.email && (
                <p className="mt-1 text-xs text-red-400">{errors.email.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              {isSubmitting && <Loader2 size={16} className="animate-spin" />}
              Send reset link
            </button>
          </form>

          <p className="mt-5 text-xs text-zinc-500 text-center">
            <Link
              href="/auth/login"
              className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              <ArrowLeft size={12} /> Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}