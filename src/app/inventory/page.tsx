"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { createClient } from "@/lib/supabase";
import type { Product } from "@/types/supabase";
import { Search } from "lucide-react";
import { formatDate, formatCurrency } from "@/lib/utils";

export default function InventoryPage() {
  const [batches, setBatches] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const supabase = createClient();

  async function load() {
    setLoading(true);
    let q = supabase.from("batches").select("*, product:products(name, sku, category)").order("expiry_date");
    if (selectedProduct) q = q.eq("product_id", selectedProduct);
    const { data } = await q;
    const filtered = (data || []).filter(b =>
      !search || b.product?.name?.toLowerCase().includes(search.toLowerCase()) || b.batch_number?.toLowerCase().includes(search.toLowerCase())
    );
    setBatches(filtered);
    setLoading(false);
  }

  async function loadProducts() {
    const { data } = await supabase.from("products").select("id, name").order("name");
    setProducts(data || []);
  }

  useEffect(() => { loadProducts(); }, []);
  useEffect(() => { load(); }, [search, selectedProduct]);

  function stockBadge(qty: number) {
    if (qty === 0) return "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400";
    if (qty < 10) return "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400";
    return "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400";
  }

  return (
    <AppLayout title="Inventory">
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="relative w-56">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search batches..." className="input pl-8 text-xs" />
        </div>
        <select value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)} className="input w-48 text-xs">
          <option value="">All Products</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <span className="ml-auto text-xs text-zinc-500">{batches.length} batch{batches.length !== 1 ? "es" : ""}</span>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 dark:border-zinc-800">
              {["Product", "Batch No.", "Expiry", "Quantity", "Purchase Rate", "Value"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-zinc-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-400 text-xs">Loading…</td></tr>
            ) : batches.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-400 text-xs">No batches found. Batches are created automatically when you add a purchase.</td></tr>
            ) : batches.map(b => {
              const expired = new Date(b.expiry_date) < new Date();
              return (
                <tr key={b.id} className={`border-b border-zinc-50 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors ${expired ? "opacity-60" : ""}`}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-zinc-900 dark:text-white">{b.product?.name}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">{b.product?.sku} · {b.product?.category}</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-zinc-600 dark:text-zinc-400">{b.batch_number}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium ${expired ? "text-red-500" : "text-zinc-600 dark:text-zinc-400"}`}>
                      {expired && "⚠ "}{formatDate(b.expiry_date)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${stockBadge(b.quantity)}`}>{b.quantity} units</span>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{formatCurrency(b.purchase_rate)}</td>
                  <td className="px-4 py-3 font-semibold text-zinc-900 dark:text-white">{formatCurrency(b.quantity * b.purchase_rate)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}
