"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { createClient } from "@/lib/supabase";
import type { Product } from "@/types/supabase";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, X, Loader2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

const schema = z.object({
  supplier_name: z.string().min(1, "Required"),
  invoice_number: z.string().min(1, "Required"),
  purchase_date: z.string().min(1, "Required"),
  product_id: z.string().min(1, "Select product"),
  batch_number: z.string().min(1, "Required"),
  expiry_date: z.string().min(1, "Required"),
  quantity: z.coerce.number().positive("Must be > 0"),
  purchase_rate: z.coerce.number().positive("Must be > 0"),
});
type FormData = z.infer<typeof schema>;

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const supabase = createClient();

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { purchase_date: new Date().toISOString().split("T")[0] },
  });

  async function load() {
    setLoading(true);
    const [p, prods] = await Promise.all([
      supabase.from("purchases").select("*, purchase_items(*, product:products(name))").order("created_at", { ascending: false }).limit(20),
      supabase.from("products").select("*").order("name"),
    ]);
    setPurchases(p.data || []);
    setProducts(prods.data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function onSubmit(data: FormData) {
    const total = data.quantity * data.purchase_rate;

    // 1. Create purchase
    const { data: purchase } = await supabase
      .from("purchases")
      .insert({ supplier_name: data.supplier_name, invoice_number: data.invoice_number, purchase_date: data.purchase_date, total_amount: total })
      .select().single();
    if (!purchase) return;

    // 2. Create batch
    const { data: batch } = await supabase
      .from("batches")
      .insert({ product_id: data.product_id, batch_number: data.batch_number, expiry_date: data.expiry_date, quantity: data.quantity, purchase_rate: data.purchase_rate })
      .select().single();
    if (!batch) return;

    // 3. Purchase item
    await supabase.from("purchase_items").insert({ purchase_id: purchase.id, product_id: data.product_id, batch_id: batch.id, quantity: data.quantity, purchase_rate: data.purchase_rate });

    // 4. Inventory transaction
    await supabase.from("inventory_transactions").insert({ product_id: data.product_id, batch_id: batch.id, transaction_type: "PURCHASE", quantity: data.quantity, remarks: `Purchase: ${data.invoice_number}` });

    setShowModal(false);
    reset();
    load();
  }

  return (
    <AppLayout title="Purchases">
      <div className="flex justify-end mb-5">
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-1.5">
          <Plus size={15} /> New Purchase
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 dark:border-zinc-800">
              {["Invoice", "Supplier", "Date", "Products", "Total"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-zinc-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-400 text-xs">Loading…</td></tr>
            ) : purchases.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-zinc-400 text-xs">No purchases yet. Add your first purchase entry.</td></tr>
            ) : purchases.map(p => (
              <tr key={p.id} className="border-b border-zinc-50 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-zinc-500">{p.invoice_number}</td>
                <td className="px-4 py-3 font-medium text-zinc-900 dark:text-white">{p.supplier_name}</td>
                <td className="px-4 py-3 text-zinc-500 text-xs">{formatDate(p.purchase_date)}</td>
                <td className="px-4 py-3 text-zinc-500 text-xs">{(p.purchase_items || []).map((i: any) => i.product?.name).filter(Boolean).join(", ") || "—"}</td>
                <td className="px-4 py-3 font-semibold text-zinc-900 dark:text-white">{formatCurrency(p.total_amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-lg border border-zinc-200 dark:border-zinc-800 shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">New Purchase Entry</h2>
              <button onClick={() => setShowModal(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Supplier Name</label>
                  <input {...register("supplier_name")} className="input" placeholder="Supplier Co." />
                  {errors.supplier_name && <p className="text-xs text-red-500 mt-1">{errors.supplier_name.message}</p>}
                </div>
                <div>
                  <label className="label">Invoice Number</label>
                  <input {...register("invoice_number")} className="input" placeholder="INV-001" />
                  {errors.invoice_number && <p className="text-xs text-red-500 mt-1">{errors.invoice_number.message}</p>}
                </div>
              </div>
              <div>
                <label className="label">Purchase Date</label>
                <input {...register("purchase_date")} type="date" className="input" />
              </div>
              <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4">
                <p className="text-xs font-semibold text-zinc-500 mb-3 uppercase tracking-wide">Item Details</p>
                <div>
                  <label className="label">Product</label>
                  <select {...register("product_id")} className="input">
                    <option value="">Select product</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                  </select>
                  {errors.product_id && <p className="text-xs text-red-500 mt-1">{errors.product_id.message}</p>}
                </div>
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div>
                    <label className="label">Batch Number</label>
                    <input {...register("batch_number")} className="input" placeholder="B001" />
                    {errors.batch_number && <p className="text-xs text-red-500 mt-1">{errors.batch_number.message}</p>}
                  </div>
                  <div>
                    <label className="label">Expiry Date</label>
                    <input {...register("expiry_date")} type="date" className="input" />
                    {errors.expiry_date && <p className="text-xs text-red-500 mt-1">{errors.expiry_date.message}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div>
                    <label className="label">Quantity</label>
                    <input {...register("quantity")} type="number" className="input" placeholder="100" />
                    {errors.quantity && <p className="text-xs text-red-500 mt-1">{errors.quantity.message}</p>}
                  </div>
                  <div>
                    <label className="label">Purchase Rate (₹)</label>
                    <input {...register("purchase_rate")} type="number" step="0.01" className="input" placeholder="0.00" />
                    {errors.purchase_rate && <p className="text-xs text-red-500 mt-1">{errors.purchase_rate.message}</p>}
                  </div>
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                  Save Purchase
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
