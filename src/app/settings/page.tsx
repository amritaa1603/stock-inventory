"use client";
import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { createClient } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Loader2, Check, User, Shield, Palette, Database,
  Info, LogOut, Download, Sun, Moon, Eye, EyeOff,
  AlertTriangle, ChevronRight,
} from "lucide-react";

// ─── Schemas ─────────────────────────────────────────────────────────────────

const pwSchema = z
  .object({
    current: z.string().min(1, "Required"),
    password: z.string().min(8, "Min 8 characters"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords don't match",
    path: ["confirm"],
  });

type PwForm = z.infer<typeof pwSchema>;

// ─── Tab type ─────────────────────────────────────────────────────────────────

type Tab = "profile" | "security" | "preferences" | "data" | "about";

const TABS: { id: Tab; label: string; icon: React.ComponentType<any> }[] = [
  { id: "profile",     label: "Profile",      icon: User },
  { id: "security",    label: "Security",     icon: Shield },
  { id: "preferences", label: "Preferences",  icon: Palette },
  { id: "data",        label: "Data & Export", icon: Database },
  { id: "about",       label: "About",        icon: Info },
];

// ─── Password strength ────────────────────────────────────────────────────────

function getStrength(pw: string) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score;
}

const strengthLabel = ["", "Weak", "Weak", "Fair", "Good", "Strong"];
const strengthColor = ["", "bg-red-500", "bg-red-400", "bg-amber-400", "bg-emerald-400", "bg-emerald-500"];

export default function SettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const supabase = createClient();
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [showPw, setShowPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwError, setPwError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [dark, setDark] = useState(
    typeof document !== "undefined" && document.documentElement.classList.contains("dark")
  );

  const {
    register, handleSubmit, watch, reset,
    formState: { errors, isSubmitting },
  } = useForm<PwForm>({ resolver: zodResolver(pwSchema) });

  const watchedPw = watch("password", "");
  const strength = getStrength(watchedPw || "");

  // ── Change password ───────────────────────────────────────────────────────

  async function changePassword(data: PwForm) {
    setPwError("");
    // Re-authenticate first
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: user?.email ?? "",
      password: data.current,
    });
    if (authError) {
      setPwError("Current password is incorrect.");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: data.password });
    if (error) {
      setPwError(error.message);
    } else {
      setPwSuccess(true);
      reset();
      setTimeout(() => setPwSuccess(false), 4000);
    }
  }

  // ── Sign out all sessions ─────────────────────────────────────────────────

  async function signOutAll() {
    await supabase.auth.signOut({ scope: "global" });
    router.replace("/auth/login");
  }

  // ── Theme toggle ──────────────────────────────────────────────────────────

  function toggleTheme(toDark: boolean) {
    setDark(toDark);
    if (toDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }

  // ── Export CSV ────────────────────────────────────────────────────────────

  async function exportTable(table: string) {
    setExporting(true);
    const { data } = await supabase.from(table).select("*").order("created_at", { ascending: false });
    if (data && data.length > 0) {
      const headers = Object.keys(data[0]).join(",");
      const rows = data.map((r) => Object.values(r).map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));
      const csv = [headers, ...rows].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${table}_export_${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
    setExporting(false);
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const initials = user?.email?.[0]?.toUpperCase() ?? "U";

  return (
    <AppLayout title="Settings">
      <div className="max-w-3xl">
        <div className="flex gap-6">

          {/* ── Left Sidebar Nav ── */}
          <nav className="w-44 flex-shrink-0">
            <div className="card p-2 space-y-0.5">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                    activeTab === id
                      ? "bg-indigo-600/10 text-indigo-600 dark:text-indigo-400"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                >
                  <Icon size={15} />
                  {label}
                </button>
              ))}
            </div>
          </nav>

          {/* ── Right Content ── */}
          <div className="flex-1 space-y-4">

            {/* ════ PROFILE ════ */}
            {activeTab === "profile" && (
              <div className="card p-6">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-white mb-5">Profile</h2>

                {/* Avatar + email */}
                <div className="flex items-center gap-4 p-4 bg-zinc-50 dark:bg-zinc-800 rounded-xl mb-5">
                  <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-full flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
                    {initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-white">
                      {user?.user_metadata?.full_name || "Administrator"}
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5">{user?.email}</p>
                    <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs rounded-full font-medium">
                      Admin
                    </span>
                  </div>
                </div>

                {/* Info grid */}
                <div className="space-y-3">
                  {[
                    { label: "Email address", value: user?.email },
                    { label: "Account created", value: user?.created_at ? new Date(user.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" }) : "—" },
                    { label: "Last sign in", value: user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString("en-IN") : "—" },
                    { label: "User ID", value: user?.id?.slice(0, 8) + "…", mono: true },
                  ].map(({ label, value, mono }) => (
                    <div key={label} className="flex items-center justify-between py-2.5 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                      <span className="text-xs text-zinc-500">{label}</span>
                      <span className={`text-xs font-medium text-zinc-900 dark:text-zinc-200 ${mono ? "font-mono" : ""}`}>
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ════ SECURITY ════ */}
            {activeTab === "security" && (
              <>
                {/* Change password */}
                <div className="card p-6">
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-white mb-1">Change Password</h2>
                  <p className="text-xs text-zinc-500 mb-5">Use a strong password with uppercase, numbers, and symbols.</p>

                  {pwSuccess && (
                    <div className="mb-4 px-3 py-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center gap-2">
                      <Check size={14} className="text-emerald-500" />
                      <p className="text-xs text-emerald-400">Password updated successfully.</p>
                    </div>
                  )}
                  {pwError && (
                    <div className="mb-4 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
                      <AlertTriangle size={14} className="text-red-400" />
                      <p className="text-xs text-red-400">{pwError}</p>
                    </div>
                  )}

                  <form onSubmit={handleSubmit(changePassword)} className="space-y-4">
                    <div>
                      <label className="label">Current Password</label>
                      <div className="relative">
                        <input {...register("current")} type={showPw ? "text" : "password"} className="input pr-9" placeholder="••••••••" />
                        <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                          {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                      {errors.current && <p className="text-xs text-red-500 mt-1">{errors.current.message}</p>}
                    </div>

                    <div>
                      <label className="label">New Password</label>
                      <div className="relative">
                        <input {...register("password")} type={showNewPw ? "text" : "password"} className="input pr-9" placeholder="••••••••" />
                        <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">
                          {showNewPw ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                      {/* Strength meter */}
                      {watchedPw && (
                        <div className="mt-2 space-y-1">
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${s <= strength ? strengthColor[strength] : "bg-zinc-200 dark:bg-zinc-700"}`} />
                            ))}
                          </div>
                          <p className={`text-xs ${strength <= 2 ? "text-red-400" : strength === 3 ? "text-amber-400" : "text-emerald-400"}`}>
                            {strengthLabel[strength]}
                          </p>
                        </div>
                      )}
                      {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
                    </div>

                    <div>
                      <label className="label">Confirm New Password</label>
                      <input {...register("confirm")} type="password" className="input" placeholder="••••••••" />
                      {errors.confirm && <p className="text-xs text-red-500 mt-1">{errors.confirm.message}</p>}
                    </div>

                    <button type="submit" disabled={isSubmitting} className="btn-primary flex items-center gap-2">
                      {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : pwSuccess ? <Check size={14} /> : null}
                      {pwSuccess ? "Updated!" : "Update Password"}
                    </button>
                  </form>
                </div>

                {/* Sessions */}
                <div className="card p-6">
                  <h2 className="text-sm font-semibold text-zinc-900 dark:text-white mb-1">Sessions</h2>
                  <p className="text-xs text-zinc-500 mb-4">Sign out from all devices including this one.</p>
                  <button
                    onClick={signOutAll}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-red-500 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
                  >
                    <LogOut size={14} />
                    Sign out all sessions
                  </button>
                </div>
              </>
            )}

            {/* ════ PREFERENCES ════ */}
            {activeTab === "preferences" && (
              <div className="card p-6">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-white mb-1">Appearance</h2>
                <p className="text-xs text-zinc-500 mb-5">Choose your preferred theme.</p>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Light", desc: "Bright and clean", icon: Sun, value: false },
                    { label: "Dark", desc: "Easy on the eyes", icon: Moon, value: true },
                  ].map(({ label, desc, icon: Icon, value }) => (
                    <button
                      key={label}
                      onClick={() => toggleTheme(value)}
                      className={`relative flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                        dark === value
                          ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10"
                          : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600"
                      }`}
                    >
                      <div className={`p-1.5 rounded-lg ${dark === value ? "bg-indigo-100 dark:bg-indigo-500/20" : "bg-zinc-100 dark:bg-zinc-800"}`}>
                        <Icon size={16} className={dark === value ? "text-indigo-600 dark:text-indigo-400" : "text-zinc-500"} />
                      </div>
                      <div>
                        <p className={`text-sm font-medium ${dark === value ? "text-indigo-700 dark:text-indigo-300" : "text-zinc-900 dark:text-zinc-200"}`}>
                          {label}
                        </p>
                        <p className="text-xs text-zinc-500 mt-0.5">{desc}</p>
                      </div>
                      {dark === value && (
                        <div className="absolute top-3 right-3 w-4 h-4 bg-indigo-500 rounded-full flex items-center justify-center">
                          <Check size={10} className="text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ════ DATA ════ */}
            {activeTab === "data" && (
              <div className="card p-6">
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-white mb-1">Export Data</h2>
                <p className="text-xs text-zinc-500 mb-5">Download your data as CSV files for backup or migration.</p>

                <div className="space-y-2">
                  {[
                    { table: "products",               label: "Products",               desc: "All product records with SKU and GST" },
                    { table: "batches",                label: "Batches",                desc: "All batch records with expiry and stock" },
                    { table: "purchases",              label: "Purchases",              desc: "Purchase invoices and headers" },
                    { table: "purchase_items",         label: "Purchase Items",         desc: "Line items for each purchase" },
                    { table: "sales",                  label: "Sales",                  desc: "Sales invoices" },
                    { table: "inventory_transactions", label: "Inventory Transactions", desc: "Full audit log of stock movements" },
                  ].map(({ table, label, desc }) => (
                    <div
                      key={table}
                      className="flex items-center justify-between px-4 py-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl"
                    >
                      <div>
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-200">{label}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">{desc}</p>
                      </div>
                      <button
                        onClick={() => exportTable(table)}
                        disabled={exporting}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 rounded-lg transition-colors disabled:opacity-50"
                      >
                        <Download size={12} />
                        Export CSV
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ════ ABOUT ════ */}
            {activeTab === "about" && (
              <div className="card p-6">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Database size={18} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">StockFlow</h2>
                    <p className="text-xs text-zinc-500">Inventory Management System</p>
                  </div>
                </div>

                <div className="space-y-2.5">
                  {[
                    ["Version",    "1.0.0 — MVP"],
                    ["Framework",  "Next.js 15 (App Router)"],
                    ["Auth",       "Supabase Auth"],
                    ["Database",   "Supabase PostgreSQL"],
                    ["UI Library", "Tailwind CSS v3"],
                    ["Language",   "TypeScript"],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                      <span className="text-xs text-zinc-500">{label}</span>
                      <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{value}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-5 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
                  <p className="text-xs text-zinc-500 leading-relaxed">
                    Built for pharmaceutical and FMCG inventory workflows. Batch tracking,
                    expiry management, multi-channel sales reporting, and full audit trails
                    for compliance.
                  </p>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </AppLayout>
  );
}