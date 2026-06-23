"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { createClient } from "@/lib/supabase";
import type { Product } from "@/types/supabase";
import { formatDate } from "@/lib/utils";

const TXN_TYPES = ["PURCHASE", "SALE", "SALE_RETURN", "BREAKAGE", "EXPIRY"];

const typeColors: Record<string, string> = {
  PURCHASE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
  SALE: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400",
  SALE_RETURN: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  BREAKAGE: "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400",
  EXPIRY: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

export default function TimelinePage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [productFilter, setProductFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const supabase = createClient();

  async function load() {
    setLoading(true);
    let q = supabase
      .from("inventory_transactions")
      .select("*, product:products(name), batch:batches(batch_number)")
      .order("created_at", { ascending: false })
      .limit(50);
    if (productFilter) q = q.eq("product_id", productFilter);
    if (typeFilter) q = q.eq("transaction_type", typeFilter);
    if (dateFrom) q = q.gte("created_at", dateFrom);
    if (dateTo) q = q.lte("created_at", dateTo + "T23:59:59");
    const { data } = await q;
    setTransactions(data || []);
    setLoading(false);
  }

  useEffect(() => {
    supabase.from("products").select("id, name").order("name").then(({ data }) => setProducts(data || []));
  }, []);

  useEffect(() => { load(); }, [productFilter, typeFilter, dateFrom, dateTo]);

  return (
    <AppLayout title="Inventory Timeline">
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <select value={productFilter} onChange={e => setProductFilter(e.target.value)} className="input w-44 text-xs">
          <option value="">All Products</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="input w-40 text-xs">
          <option value="">All Types</option>
          {TXN_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input w-36 text-xs" />
        <span className="text-zinc-400 text-xs">to</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input w-36 text-xs" />
        {(productFilter || typeFilter || dateFrom || dateTo) && (
          <button onClick={() => { setProductFilter(""); setTypeFilter(""); setDateFrom(""); setDateTo(""); }} className="text-xs text-indigo-500 hover:text-indigo-600">Clear filters</button>
        )}
        <span className="ml-auto text-xs text-zinc-400">{transactions.length} entries</span>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 dark:border-zinc-800">
              {["Date & Time", "Product", "Batch", "Type", "Quantity", "Remarks"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-zinc-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-400 text-xs">Loading…</td></tr>
            ) : transactions.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-400 text-xs">No transactions found.</td></tr>
            ) : transactions.map(t => (
              <tr key={t.id} className="border-b border-zinc-50 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                <td className="px-4 py-3 text-zinc-500 text-xs whitespace-nowrap">
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">{formatDate(t.created_at)}</span>
                  <br />
                  <span className="text-zinc-400">{new Date(t.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
                </td>
                <td className="px-4 py-3 font-medium text-zinc-900 dark:text-white">{t.product?.name || "—"}</td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-500">{t.batch?.batch_number || "—"}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${typeColors[t.transaction_type] || ""}`}>{t.transaction_type}</span>
                </td>
                <td className="px-4 py-3 font-mono font-semibold text-zinc-900 dark:text-white">
                  {["SALE", "BREAKAGE", "EXPIRY"].includes(t.transaction_type) ? "-" : "+"}{t.quantity}
                </td>
                <td className="px-4 py-3 text-zinc-500 text-xs">{t.remarks || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}
