"use client";
import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Check } from "lucide-react";

const pwSchema = z.object({
  password: z.string().min(6, "Min 6 characters"),
  confirm: z.string(),
}).refine(d => d.password === d.confirm, { message: "Passwords don't match", path: ["confirm"] });

export default function SettingsPage() {
  const { user } = useAuth();
  const [pwSuccess, setPwSuccess] = useState(false);
  const supabase = createClient();

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(pwSchema),
  });

  async function changePassword({ password }: any) {
    await supabase.auth.updateUser({ password });
    setPwSuccess(true);
    reset();
    setTimeout(() => setPwSuccess(false), 3000);
  }

  return (
    <AppLayout title="Settings">
      <div className="max-w-lg space-y-5">
        {/* Profile */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white mb-4">Profile</h2>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
              {user?.email?.[0]?.toUpperCase() || "U"}
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-900 dark:text-white">{user?.email}</p>
              <p className="text-xs text-zinc-400 mt-0.5">Administrator</p>
            </div>
          </div>
        </div>

        {/* Change Password */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white mb-4">Change Password</h2>
          <form onSubmit={handleSubmit(changePassword)} className="space-y-3">
            <div>
              <label className="label">New Password</label>
              <input {...register("password")} type="password" className="input" placeholder="••••••••" />
              {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message as string}</p>}
            </div>
            <div>
              <label className="label">Confirm Password</label>
              <input {...register("confirm")} type="password" className="input" placeholder="••••••••" />
              {errors.confirm && <p className="text-xs text-red-500 mt-1">{errors.confirm.message as string}</p>}
            </div>
            <button type="submit" disabled={isSubmitting} className="btn-primary flex items-center gap-2">
              {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : pwSuccess ? <Check size={14} /> : null}
              {pwSuccess ? "Password updated!" : "Update Password"}
            </button>
          </form>
        </div>

        {/* Theme */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white mb-3">Theme</h2>
          <div className="flex gap-3">
            {["Light", "Dark"].map(t => (
              <button
                key={t}
                onClick={() => {
                  if (t === "Dark") {
                    document.documentElement.classList.add("dark");
                    localStorage.setItem("theme", "dark");
                  } else {
                    document.documentElement.classList.remove("dark");
                    localStorage.setItem("theme", "light");
                  }
                }}
                className="btn-secondary flex items-center gap-2 text-xs"
              >
                {t === "Light" ? "☀️" : "🌙"} {t}
              </button>
            ))}
          </div>
        </div>

        {/* App Info */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white mb-3">About</h2>
          <div className="space-y-1.5 text-xs text-zinc-500">
            <p>StockFlow Inventory Management</p>
            <p>Version 1.0.0 — MVP</p>
            <p>Built with Next.js 15, Supabase, Tailwind CSS</p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
