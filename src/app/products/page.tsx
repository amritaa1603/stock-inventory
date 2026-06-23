"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { createClient } from "@/lib/supabase";
import type { Product } from "@/types/supabase";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Search, Pencil, Trash2, X, Loader2 } from "lucide-react";
import { formatDate } from "@/lib/utils";

const schema = z.object({
  name: z.string().min(1, "Required"),
  sku: z.string().min(1, "Required"),
  category: z.string().min(1, "Required"),
  gst: z.coerce.number().min(0).max(100),
});
type FormData = z.infer<typeof schema>;

const CATEGORIES = ["Medicine", "Supplement", "FMCG", "Chemical", "Food", "Other"];
const GST_RATES = [0, 5, 12, 18, 28];

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [page, setPage] = useState(0);
  const perPage = 10;
  const supabase = createClient();

  const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { gst: 18 },
  });

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("products")
      .select("*")
      .ilike("name", `%${search}%`)
      .order("created_at", { ascending: false })
      .range(page * perPage, (page + 1) * perPage - 1);
    setProducts(data || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [search, page]);

  function openAdd() { setEditing(null); reset({ name: "", sku: "", category: "", gst: 18 }); setShowModal(true); }
  function openEdit(p: Product) {
    setEditing(p);
    setValue("name", p.name); setValue("sku", p.sku); setValue("category", p.category); setValue("gst", p.gst);
    setShowModal(true);
  }

  async function onSubmit(data: FormData) {
    if (editing) {
      await supabase.from("products").update(data).eq("id", editing.id);
    } else {
      await supabase.from("products").insert(data);
    }
    setShowModal(false);
    load();
  }

  async function deleteProduct(id: string) {
    if (!confirm("Delete this product?")) return;
    await supabase.from("products").delete().eq("id", id);
    load();
  }

  return (
    <AppLayout title="Products">
      <div className="flex items-center justify-between mb-5">
        <div className="relative w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search products..."
            className="input pl-8 text-xs"
          />
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-1.5">
          <Plus size={15} /> Add Product
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 dark:border-zinc-800">
              {["Product Name", "SKU", "Category", "GST %", "Created"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">{h}</th>
              ))}
              <th className="px-4 py-3 text-xs font-medium text-zinc-500 dark:text-zinc-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-400 text-xs">Loading…</td></tr>
            ) : products.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-400 text-xs">No products found. Add your first product.</td></tr>
            ) : products.map(p => (
              <tr key={p.id} className="border-b border-zinc-50 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors">
                <td className="px-4 py-3 font-medium text-zinc-900 dark:text-white">{p.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-500">{p.sku}</td>
                <td className="px-4 py-3">
                  <span className="badge bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">{p.category}</span>
                </td>
                <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">{p.gst}%</td>
                <td className="px-4 py-3 text-zinc-400 text-xs">{formatDate(p.created_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => openEdit(p)} className="p-1.5 rounded-md text-zinc-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => deleteProduct(p.id)} className="p-1.5 rounded-md text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-100 dark:border-zinc-800">
          <span className="text-xs text-zinc-400">Page {page + 1}</span>
          <div className="flex gap-2">
            <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="btn-secondary text-xs py-1 px-2.5 disabled:opacity-40">Prev</button>
            <button disabled={products.length < perPage} onClick={() => setPage(p => p + 1)} className="btn-secondary text-xs py-1 px-2.5 disabled:opacity-40">Next</button>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-md border border-zinc-200 dark:border-zinc-800 shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-zinc-100 dark:border-zinc-800">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
                {editing ? "Edit Product" : "Add Product"}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
              <div>
                <label className="label">Product Name</label>
                <input {...register("name")} className="input" placeholder="e.g. Paracetamol 500mg" />
                {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
              </div>
              <div>
                <label className="label">SKU</label>
                <input {...register("sku")} className="input" placeholder="e.g. MED-001" />
                {errors.sku && <p className="text-xs text-red-500 mt-1">{errors.sku.message}</p>}
              </div>
              <div>
                <label className="label">Category</label>
                <select {...register("category")} className="input">
                  <option value="">Select category</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {errors.category && <p className="text-xs text-red-500 mt-1">{errors.category.message}</p>}
              </div>
              <div>
                <label className="label">GST Rate</label>
                <select {...register("gst")} className="input">
                  {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                  {editing ? "Save Changes" : "Add Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
