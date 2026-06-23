"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { createClient } from "@/lib/supabase";
import type { Product, Batch } from "@/types/supabase";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, X, Loader2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

const CHANNELS = ["Website", "Amazon", "Flipkart", "Myntra", "Wholesale", "Retail"];

const schema = z.object({
  customer_name: z.string().min(1, "Required"),
  channel: z.string().min(1, "Required"),
  invoice_number: z.string().min(1, "Required"),
  sale_date: z.string().min(1, "Required"),
  product_id: z.string().min(1, "Select product"),
  batch_id: z.string().min(1, "Select batch"),
  quantity: z.coerce.number().positive(),
  sale_rate: z.coerce.number().positive(),
});
type FormData = z.infer<typeof schema>;

const channelColors: Record<string, string> = {
  Website: "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400",
  Amazon: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
  Flipkart: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",
  Myntra: "bg-pink-50 text-pink-600 dark:bg-pink-500/10 dark:text-pink-400",
  Wholesale: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
  Retail: "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400",
};

export default function SalesPage() {
  const [sales, setSales] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const supabase = createClient();

  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { sale_date: new Date().toISOString().split("T")[0] },
  });

  const selectedProduct = watch("product_id");

  async function load() {
    setLoading(true);
    const [s, prods] = await Promise.all([
      supabase.from("sales").select("*, sale_items(*, product:products(name))").order("created_at", { ascending: false }).limit(20),
      supabase.from("products").select("*").order("name"),
    ]);
    setSales(s.data || []);
    setProducts(prods.data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!selectedProduct) return;
    supabase.from("batches").select("*").eq("product_id", selectedProduct).gt("quantity", 0).then(({ data }) => setBatches(data || []));
  }, [selectedProduct]);

  async function onSubmit(data: FormData) {
    const total = data.quantity * data.sale_rate;
    const { data: sale } = await supabase
      .from("sales")
      .insert({ customer_name: data.customer_name, channel: data.channel, invoice_number: data.invoice_number, sale_date: data.sale_date, total_amount: total })
      .select().single();
    if (!sale) return;

    await supabase.from("sale_items").insert({ sale_id: sale.id, product_id: data.product_id, batch_id: data.batch_id, quantity: data.quantity, sale_rate: data.sale_rate });
    await supabase.from("batches").rpc || await supabase.from("batches").select("quantity").eq("id", data.batch_id).single().then(async ({ data: b }) => {
      if (b) await supabase.from("batches").update({ quantity: b.quantity - data.quantity }).eq("id", data.batch_id);
    });
    await supabase.from("inventory_transactions").insert({ product_id: data.product_id, batch_id: data.batch_id, transaction_type: "SALE", quantity: data.quantity, remarks: `Sale: ${data.invoice_number}` });

    setShowModal(false);
    reset();
    load();
  }

  return (
    <AppLayout title="Sales">
      <div className="flex justify-end mb-5">
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-1.5">
          <Plus size={15} /> New Sale
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 dark:border-zinc-800">
              {["Invoice", "Customer", "Channel", "Date", "Products", "Total"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-zinc-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-400 text-xs">Loading…</td></tr>
            ) : sales.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-400 text-xs">No sales yet. Create your first sale entry.</td></tr>
            ) : sales.map(s => (
              <tr key={s.id} className="border-b border-zinc-50 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-zinc-500">{s.invoice_number}</td>
                <td className="px-4 py-3 font-medium text-zinc-900 dark:text-white">{s.customer_name}</td>
                <td className="px-4 py-3">
                  <span className={`badge ${channelColors[s.channel] || ""}`}>{s.channel}</span>
                </td>
                <td className="px-4 py-3 text-zinc-500 text-xs">{formatDate(s.sale_date)}</td>
                <td className="px-4 py-3 text-zinc-500 text-xs">{(s.sale_items || []).map((i: any) => i.product?.name).filter(Boolean).join(", ") || "—"}</td>
                <td className="px-4 py-3 font-semibold text-zinc-900 dark:text-white">{formatCurrency(s.total_amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-lg border border-zinc-200 dark:border-zinc-800 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">New Sale Entry</h2>
              <button onClick={() => setShowModal(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Customer Name</label>
                  <input {...register("customer_name")} className="input" placeholder="Customer name" />
                  {errors.customer_name && <p className="text-xs text-red-500 mt-1">{errors.customer_name.message}</p>}
                </div>
                <div>
                  <label className="label">Channel</label>
                  <select {...register("channel")} className="input">
                    <option value="">Select channel</option>
                    {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {errors.channel && <p className="text-xs text-red-500 mt-1">{errors.channel.message}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Invoice Number</label>
                  <input {...register("invoice_number")} className="input" placeholder="SINV-001" />
                  {errors.invoice_number && <p className="text-xs text-red-500 mt-1">{errors.invoice_number.message}</p>}
                </div>
                <div>
                  <label className="label">Sale Date</label>
                  <input {...register("sale_date")} type="date" className="input" />
                </div>
              </div>
              <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4">
                <p className="text-xs font-semibold text-zinc-500 mb-3 uppercase tracking-wide">Item Details</p>
                <div>
                  <label className="label">Product</label>
                  <select {...register("product_id")} className="input">
                    <option value="">Select product</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  {errors.product_id && <p className="text-xs text-red-500 mt-1">{errors.product_id.message}</p>}
                </div>
                <div className="mt-3">
                  <label className="label">Batch</label>
                  <select {...register("batch_id")} className="input" disabled={!selectedProduct}>
                    <option value="">Select batch</option>
                    {batches.map(b => <option key={b.id} value={b.id}>{b.batch_number} — Exp: {formatDate(b.expiry_date)} (Qty: {b.quantity})</option>)}
                  </select>
                  {errors.batch_id && <p className="text-xs text-red-500 mt-1">{errors.batch_id.message}</p>}
                </div>
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div>
                    <label className="label">Quantity</label>
                    <input {...register("quantity")} type="number" className="input" placeholder="10" />
                    {errors.quantity && <p className="text-xs text-red-500 mt-1">{errors.quantity.message}</p>}
                  </div>
                  <div>
                    <label className="label">Sale Rate (₹)</label>
                    <input {...register("sale_rate")} type="number" step="0.01" className="input" placeholder="0.00" />
                    {errors.sale_rate && <p className="text-xs text-red-500 mt-1">{errors.sale_rate.message}</p>}
                  </div>
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                  Save Sale
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
