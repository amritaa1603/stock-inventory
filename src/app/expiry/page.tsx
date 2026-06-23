"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { createClient } from "@/lib/supabase";
import { daysUntilExpiry, formatDate } from "@/lib/utils";
import { AlertTriangle, AlertCircle, Clock } from "lucide-react";

type Tab = "expired" | "30" | "60" | "90";

export default function ExpiryPage() {
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("30");
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from("batches")
        .select("*, product:products(name, sku, category)")
        .gt("quantity", 0)
        .order("expiry_date");
      setBatches(data || []);
      setLoading(false);
    }
    load();
  }, []);

  const today = new Date();
  const expired = batches.filter(b => new Date(b.expiry_date) < today);
  const near30 = batches.filter(b => { const d = daysUntilExpiry(b.expiry_date); return d >= 0 && d <= 30; });
  const near60 = batches.filter(b => { const d = daysUntilExpiry(b.expiry_date); return d > 30 && d <= 60; });
  const near90 = batches.filter(b => { const d = daysUntilExpiry(b.expiry_date); return d > 60 && d <= 90; });

  const tabs: { id: Tab; label: string; count: number; icon: any; color: string }[] = [
    { id: "expired", label: "Expired", count: expired.length, icon: AlertCircle, color: "text-red-500" },
    { id: "30", label: "≤ 30 Days", count: near30.length, icon: AlertTriangle, color: "text-orange-500" },
    { id: "60", label: "≤ 60 Days", count: near60.length, icon: Clock, color: "text-amber-500" },
    { id: "90", label: "≤ 90 Days", count: near90.length, icon: Clock, color: "text-yellow-500" },
  ];

  const data = tab === "expired" ? expired : tab === "30" ? near30 : tab === "60" ? near60 : near90;

  return (
    <AppLayout title="Expiry Management">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {tabs.map(({ id, label, count, icon: Icon, color }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`card p-4 text-left transition-all ${tab === id ? "ring-2 ring-indigo-500" : "hover:border-zinc-300 dark:hover:border-zinc-600"}`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-zinc-500">{label}</span>
              <Icon size={15} className={color} />
            </div>
            <p className={`text-2xl font-bold ${tab === id ? "text-zinc-900 dark:text-white" : "text-zinc-700 dark:text-zinc-300"}`}>{count}</p>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-100 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
            {tabs.find(t => t.id === tab)?.label} Batches
          </h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 dark:border-zinc-800">
              {["Product", "SKU", "Batch", "Expiry Date", "Days Left", "Quantity"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-zinc-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-400 text-xs">Loading…</td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-400 text-xs">No batches in this category.</td></tr>
            ) : data.map(b => {
              const days = daysUntilExpiry(b.expiry_date);
              return (
                <tr key={b.id} className="border-b border-zinc-50 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-white">{b.product?.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-400">{b.product?.sku}</td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-500">{b.batch_number}</td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 text-xs">{formatDate(b.expiry_date)}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${
                      days < 0 ? "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400" :
                      days <= 30 ? "bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400" :
                      "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                    }`}>
                      {days < 0 ? `${Math.abs(days)}d ago` : `${days}d`}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-zinc-900 dark:text-white">{b.quantity}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}
