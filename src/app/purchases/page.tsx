"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { createClient } from "@/lib/supabase";
import type { Product } from "@/types/supabase";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus, X, Loader2, Zap, ClipboardList, Upload,
  QrCode, Download, CheckCircle2, AlertCircle,
  Search, FileText, Printer,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

interface QRBatch {
  id: string;
  sku: string;
  productName: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  invoiceNumber: string;
}

interface CSVRow {
  sku: string;
  batch_number: string;
  expiry_date: string;
  quantity: string;
  purchase_rate: string;
  _product?: Product;
  _error?: string;
  _status?: "valid" | "error" | "duplicate";
}

// ─── Schemas ─────────────────────────────────────────────────────────────────

const manualSchema = z.object({
  supplier_name: z.string().min(1, "Required"),
  invoice_number: z.string().min(1, "Required"),
  purchase_date: z.string().min(1, "Required"),
  product_id: z.string().min(1, "Select a product"),
  batch_number: z.string().min(1, "Required"),
  expiry_date: z.string().min(1, "Required"),
  quantity: z.coerce.number().positive("Must be > 0"),
  purchase_rate: z.coerce.number().positive("Must be > 0"),
});

const skuSchema = z.object({
  supplier_name: z.string().min(1, "Required"),
  invoice_number: z.string().min(1, "Required"),
  purchase_date: z.string().min(1, "Required"),
  batch_number: z.string().min(1, "Required"),
  expiry_date: z.string().min(1, "Required"),
  quantity: z.coerce.number().positive("Must be > 0"),
  purchase_rate: z.coerce.number().positive("Must be > 0"),
});

type ManualFormData = z.infer<typeof manualSchema>;
type SKUFormData = z.infer<typeof skuSchema>;

// ─── CSV Parser (no deps needed) ─────────────────────────────────────────────

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));
  return lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim().replace(/"/g, ""));
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
  });
}

const CSV_TEMPLATE = `sku,batch_number,expiry_date,quantity,purchase_rate
MED-001,B-JAN25,2025-12-31,100,25.50
SUP-001,B-FEB25,2026-06-30,50,180.00`;

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "purchase_import_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ─── QR URL helper (no npm package needed) ───────────────────────────────────

function getQRUrl(data: string, size = 200) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}&color=6366f1&bgcolor=18181b`;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  // Modal states
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [modalTab, setModalTab] = useState<"sku" | "manual">("sku");
  const [showCSVModal, setShowCSVModal] = useState(false);

  // SKU Quick Add state
  const [skuInput, setSkuInput] = useState("");
  const [skuSearching, setSkuSearching] = useState(false);
  const [foundProduct, setFoundProduct] = useState<Product | null>(null);
  const [skuNotFound, setSkuNotFound] = useState(false);
  const skuDebounce = useRef<NodeJS.Timeout>();

  // QR Modal
  const [qrBatch, setQrBatch] = useState<QRBatch | null>(null);

  // CSV Import state
  const [csvRows, setCsvRows] = useState<CSVRow[]>([]);
  const [csvValidating, setCsvValidating] = useState(false);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvDone, setCsvDone] = useState(false);
  const [csvSupplier, setCsvSupplier] = useState("");
  const [csvInvoice, setCsvInvoice] = useState("");
  const [csvDate, setCsvDate] = useState(new Date().toISOString().split("T")[0]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Forms ─────────────────────────────────────────────────────────────────

  const manualForm = useForm<ManualFormData>({
    resolver: zodResolver(manualSchema),
    defaultValues: { purchase_date: new Date().toISOString().split("T")[0] },
  });

  const skuForm = useForm<SKUFormData>({
    resolver: zodResolver(skuSchema),
    defaultValues: { purchase_date: new Date().toISOString().split("T")[0] },
  });

  // ── Data loading ──────────────────────────────────────────────────────────

  async function load() {
    setLoading(true);
    const [p, prods] = await Promise.all([
      supabase
        .from("purchases")
        .select("*, purchase_items(*, product:products(name))")
        .order("created_at", { ascending: false })
        .limit(30),
      supabase.from("products").select("*").order("name"),
    ]);
    setPurchases(p.data || []);
    setProducts(prods.data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  // ── SKU Search (debounced) ────────────────────────────────────────────────

  const searchBySKU = useCallback(
    async (sku: string) => {
      const trimmed = sku.trim().toUpperCase();
      if (!trimmed) {
        setFoundProduct(null);
        setSkuNotFound(false);
        return;
      }
      setSkuSearching(true);
      setSkuNotFound(false);
      const { data } = await supabase
        .from("products")
        .select("*")
        .ilike("sku", trimmed)
        .limit(1)
        .single();
      setSkuSearching(false);
      if (data) {
        setFoundProduct(data);
        setSkuNotFound(false);
      } else {
        setFoundProduct(null);
        setSkuNotFound(true);
      }
    },
    [supabase]
  );

  function handleSKUInput(value: string) {
    setSkuInput(value);
    clearTimeout(skuDebounce.current);
    skuDebounce.current = setTimeout(() => searchBySKU(value), 400);
  }

  // ── Save helpers ──────────────────────────────────────────────────────────

  async function savePurchase(
    productId: string,
    batchData: {
      batch_number: string;
      expiry_date: string;
      quantity: number;
      purchase_rate: number;
    },
    header: {
      supplier_name: string;
      invoice_number: string;
      purchase_date: string;
    }
  ): Promise<QRBatch | null> {
    const total = batchData.quantity * batchData.purchase_rate;

    const { data: purchase } = await supabase
      .from("purchases")
      .insert({
        supplier_name: header.supplier_name,
        invoice_number: header.invoice_number,
        purchase_date: header.purchase_date,
        total_amount: total,
      })
      .select()
      .single();
    if (!purchase) return null;

    const { data: batch } = await supabase
      .from("batches")
      .insert({ product_id: productId, ...batchData })
      .select()
      .single();
    if (!batch) return null;

    await supabase.from("purchase_items").insert({
      purchase_id: purchase.id,
      product_id: productId,
      batch_id: batch.id,
      quantity: batchData.quantity,
      purchase_rate: batchData.purchase_rate,
    });

    await supabase.from("inventory_transactions").insert({
      product_id: productId,
      batch_id: batch.id,
      transaction_type: "PURCHASE",
      quantity: batchData.quantity,
      remarks: `Purchase: ${header.invoice_number}`,
    });

    const product = products.find((p) => p.id === productId);
    return {
      id: batch.id,
      sku: product?.sku ?? "",
      productName: product?.name ?? "",
      batchNumber: batchData.batch_number,
      expiryDate: batchData.expiry_date,
      quantity: batchData.quantity,
      invoiceNumber: header.invoice_number,
    };
  }

  // ── Submit: SKU Quick Add ─────────────────────────────────────────────────

  async function onSKUSubmit(data: SKUFormData) {
    if (!foundProduct) return;
    const qr = await savePurchase(
      foundProduct.id,
      { batch_number: data.batch_number, expiry_date: data.expiry_date, quantity: data.quantity, purchase_rate: data.purchase_rate },
      { supplier_name: data.supplier_name, invoice_number: data.invoice_number, purchase_date: data.purchase_date }
    );
    setShowPurchaseModal(false);
    skuForm.reset({ purchase_date: new Date().toISOString().split("T")[0] });
    setSkuInput("");
    setFoundProduct(null);
    load();
    if (qr) setQrBatch(qr);
  }

  // ── Submit: Manual ────────────────────────────────────────────────────────

  async function onManualSubmit(data: ManualFormData) {
    const qr = await savePurchase(
      data.product_id,
      { batch_number: data.batch_number, expiry_date: data.expiry_date, quantity: data.quantity, purchase_rate: data.purchase_rate },
      { supplier_name: data.supplier_name, invoice_number: data.invoice_number, purchase_date: data.purchase_date }
    );
    setShowPurchaseModal(false);
    manualForm.reset({ purchase_date: new Date().toISOString().split("T")[0] });
    load();
    if (qr) setQrBatch(qr);
  }

  // ── CSV Flow ──────────────────────────────────────────────────────────────

  async function handleCSVFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = parseCSV(text);
    if (!parsed.length) return;

    setCsvValidating(true);
    const skus = [...new Set(parsed.map((r) => r.sku?.toUpperCase()))].filter(Boolean);
    const { data: foundProds } = await supabase
      .from("products")
      .select("*")
      .in("sku", skus);

    const prodMap = Object.fromEntries((foundProds || []).map((p) => [p.sku.toUpperCase(), p]));
    const seenBatches = new Set<string>();

    const validated: CSVRow[] = parsed.map((row) => {
      const sku = row.sku?.toUpperCase() || "";
      const product = prodMap[sku];
      const batchKey = `${sku}|${row.batch_number}`;
      let error = "";

      if (!sku) error = "Missing SKU";
      else if (!product) error = `SKU "${sku}" not found in Products`;
      else if (!row.batch_number) error = "Missing batch number";
      else if (!row.expiry_date) error = "Missing expiry date";
      else if (!row.quantity || isNaN(Number(row.quantity)) || Number(row.quantity) <= 0) error = "Invalid quantity";
      else if (!row.purchase_rate || isNaN(Number(row.purchase_rate)) || Number(row.purchase_rate) <= 0) error = "Invalid rate";
      else if (seenBatches.has(batchKey)) error = "Duplicate batch number in file";

      if (!error && product) seenBatches.add(batchKey);

      return {
        sku,
        batch_number: row.batch_number || "",
        expiry_date: row.expiry_date || "",
        quantity: row.quantity || "",
        purchase_rate: row.purchase_rate || "",
        _product: product,
        _error: error,
        _status: error ? "error" : "valid",
      };
    });

    setCsvRows(validated);
    setCsvValidating(false);
  }

  async function importCSV() {
    if (!csvSupplier || !csvInvoice || !csvDate) return;
    const validRows = csvRows.filter((r) => r._status === "valid" && r._product);
    if (!validRows.length) return;

    setCsvImporting(true);
    const total = validRows.reduce(
      (s, r) => s + Number(r.quantity) * Number(r.purchase_rate),
      0
    );

    const { data: purchase } = await supabase
      .from("purchases")
      .insert({ supplier_name: csvSupplier, invoice_number: csvInvoice, purchase_date: csvDate, total_amount: total })
      .select()
      .single();

    if (purchase) {
      for (const row of validRows) {
        const { data: batch } = await supabase
          .from("batches")
          .insert({
            product_id: row._product!.id,
            batch_number: row.batch_number,
            expiry_date: row.expiry_date,
            quantity: Number(row.quantity),
            purchase_rate: Number(row.purchase_rate),
          })
          .select()
          .single();

        if (batch) {
          await supabase.from("purchase_items").insert({
            purchase_id: purchase.id,
            product_id: row._product!.id,
            batch_id: batch.id,
            quantity: Number(row.quantity),
            purchase_rate: Number(row.purchase_rate),
          });
          await supabase.from("inventory_transactions").insert({
            product_id: row._product!.id,
            batch_id: batch.id,
            transaction_type: "PURCHASE",
            quantity: Number(row.quantity),
            remarks: `CSV Import: ${csvInvoice}`,
          });
        }
      }
    }

    setCsvImporting(false);
    setCsvDone(true);
    load();
  }

  function resetCSVModal() {
    setShowCSVModal(false);
    setCsvRows([]);
    setCsvDone(false);
    setCsvSupplier("");
    setCsvInvoice("");
    setCsvDate(new Date().toISOString().split("T")[0]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ─── QR print helper ─────────────────────────────────────────────────────

  function printQR() {
    if (!qrBatch) return;
    const qrData = `STOCKFLOW|${qrBatch.sku}|${qrBatch.batchNumber}|${qrBatch.expiryDate}`;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head><title>Batch QR — ${qrBatch.batchNumber}</title>
      <style>body{font-family:sans-serif;text-align:center;padding:40px}
      h2{font-size:16px;margin:0 0 4px}p{font-size:12px;color:#555;margin:2px 0}
      img{margin:12px auto;display:block}</style></head>
      <body>
        <h2>${qrBatch.productName}</h2>
        <p>SKU: ${qrBatch.sku} &nbsp;|&nbsp; Batch: ${qrBatch.batchNumber}</p>
        <p>Expiry: ${qrBatch.expiryDate} &nbsp;|&nbsp; Qty: ${qrBatch.quantity}</p>
        <img src="${getQRUrl(qrData, 200)}" width="200" height="200" />
        <p style="font-size:10px;margin-top:8px;color:#999">${qrData}</p>
        <script>window.onload=()=>{window.print();window.close()}</script>
      </body></html>
    `);
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const validCSVCount = csvRows.filter((r) => r._status === "valid").length;
  const errorCSVCount = csvRows.filter((r) => r._status === "error").length;

  return (
    <AppLayout title="Purchases">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-xs text-zinc-500">{purchases.length} entries</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCSVModal(true)}
            className="btn-secondary flex items-center gap-1.5 text-xs"
          >
            <Upload size={14} /> Import CSV
          </button>
          <button
            onClick={() => { setShowPurchaseModal(true); setModalTab("sku"); }}
            className="btn-primary flex items-center gap-1.5"
          >
            <Plus size={15} /> New Purchase
          </button>
        </div>
      </div>

      {/* ── Purchases Table ── */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 dark:border-zinc-800">
              {["Invoice", "Supplier", "Date", "Products", "Total", ""].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-zinc-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-zinc-400 text-xs">
                  <Loader2 size={16} className="animate-spin inline-block" />
                </td>
              </tr>
            ) : purchases.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-zinc-400 text-sm">
                  No purchases yet. Add your first entry.
                </td>
              </tr>
            ) : (
              purchases.map((p) => (
                <tr
                  key={p.id}
                  className="border-b border-zinc-50 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-xs text-zinc-500">{p.invoice_number}</td>
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-white">{p.supplier_name}</td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">{formatDate(p.purchase_date)}</td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">
                    {(p.purchase_items || []).map((i: any) => i.product?.name).filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3 font-semibold text-zinc-900 dark:text-white">
                    {formatCurrency(p.total_amount)}
                  </td>
                  <td className="px-4 py-3">
                    {/* Could add view/edit actions here */}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* NEW PURCHASE MODAL                                                  */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {showPurchaseModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-lg border border-zinc-200 dark:border-zinc-800 shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal header */}
            <div className="flex items-center justify-between p-5 border-b border-zinc-100 dark:border-zinc-800 sticky top-0 bg-white dark:bg-zinc-900 z-10">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">New Purchase Entry</h2>
              <button
                onClick={() => { setShowPurchaseModal(false); setSkuInput(""); setFoundProduct(null); }}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X size={18} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-zinc-100 dark:border-zinc-800 px-5 pt-4 gap-1">
              {([
                { key: "sku", label: "Quick SKU", icon: Zap },
                { key: "manual", label: "Manual", icon: ClipboardList },
              ] as const).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setModalTab(key)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg border-b-2 transition-colors ${
                    modalTab === key
                      ? "border-indigo-500 text-indigo-500"
                      : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  }`}
                >
                  <Icon size={13} /> {label}
                </button>
              ))}
            </div>

            {/* ── TAB: Quick SKU ── */}
            {modalTab === "sku" && (
              <form onSubmit={skuForm.handleSubmit(onSKUSubmit)} className="p-5 space-y-4">
                {/* SKU Search */}
                <div>
                  <label className="label">Search by SKU</label>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                      value={skuInput}
                      onChange={(e) => handleSKUInput(e.target.value)}
                      placeholder="e.g. RET-50GM"
                      className="input pl-8 uppercase"
                      autoFocus
                    />
                    {skuSearching && (
                      <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 animate-spin" />
                    )}
                  </div>

                  {/* Product found */}
                  {foundProduct && (
                    <div className="mt-2 px-3 py-2.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-lg flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">{foundProduct.name}</p>
                        <p className="text-xs text-emerald-600 dark:text-emerald-500">{foundProduct.category} · {foundProduct.gst}% GST</p>
                      </div>
                    </div>
                  )}

                  {/* Not found */}
                  {skuNotFound && skuInput.trim() && (
                    <div className="mt-2 px-3 py-2.5 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg flex items-center gap-2">
                      <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
                      <p className="text-xs text-red-600 dark:text-red-400">
                        No product with SKU &ldquo;{skuInput.trim().toUpperCase()}&rdquo;.{" "}
                        <a href="/products" className="underline">Add it in Products →</a>
                      </p>
                    </div>
                  )}
                </div>

                {/* Only show rest of form if product found */}
                {foundProduct && (
                  <>
                    <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4">
                      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">Purchase Header</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="label">Supplier Name</label>
                          <input {...skuForm.register("supplier_name")} className="input" placeholder="Supplier Co." />
                          {skuForm.formState.errors.supplier_name && (
                            <p className="text-xs text-red-500 mt-1">{skuForm.formState.errors.supplier_name.message}</p>
                          )}
                        </div>
                        <div>
                          <label className="label">Invoice Number</label>
                          <input {...skuForm.register("invoice_number")} className="input" placeholder="INV-001" />
                          {skuForm.formState.errors.invoice_number && (
                            <p className="text-xs text-red-500 mt-1">{skuForm.formState.errors.invoice_number.message}</p>
                          )}
                        </div>
                      </div>
                      <div className="mt-3">
                        <label className="label">Purchase Date</label>
                        <input {...skuForm.register("purchase_date")} type="date" className="input" />
                      </div>
                    </div>

                    <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4">
                      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">Batch Details</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="label">Batch Number</label>
                          <input {...skuForm.register("batch_number")} className="input" placeholder="B-001" />
                          {skuForm.formState.errors.batch_number && (
                            <p className="text-xs text-red-500 mt-1">{skuForm.formState.errors.batch_number.message}</p>
                          )}
                        </div>
                        <div>
                          <label className="label">Expiry Date</label>
                          <input {...skuForm.register("expiry_date")} type="date" className="input" />
                          {skuForm.formState.errors.expiry_date && (
                            <p className="text-xs text-red-500 mt-1">{skuForm.formState.errors.expiry_date.message}</p>
                          )}
                        </div>
                        <div>
                          <label className="label">Quantity</label>
                          <input {...skuForm.register("quantity")} type="number" className="input" placeholder="100" />
                          {skuForm.formState.errors.quantity && (
                            <p className="text-xs text-red-500 mt-1">{skuForm.formState.errors.quantity.message}</p>
                          )}
                        </div>
                        <div>
                          <label className="label">Purchase Rate (₹)</label>
                          <input {...skuForm.register("purchase_rate")} type="number" step="0.01" className="input" placeholder="0.00" />
                          {skuForm.formState.errors.purchase_rate && (
                            <p className="text-xs text-red-500 mt-1">{skuForm.formState.errors.purchase_rate.message}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => { setShowPurchaseModal(false); setSkuInput(""); setFoundProduct(null); }}
                        className="btn-secondary flex-1"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={skuForm.formState.isSubmitting}
                        className="btn-primary flex-1 flex items-center justify-center gap-2"
                      >
                        {skuForm.formState.isSubmitting && <Loader2 size={14} className="animate-spin" />}
                        Save + Generate QR
                      </button>
                    </div>
                  </>
                )}
              </form>
            )}

            {/* ── TAB: Manual ── */}
            {modalTab === "manual" && (
              <form onSubmit={manualForm.handleSubmit(onManualSubmit)} className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Supplier Name</label>
                    <input {...manualForm.register("supplier_name")} className="input" placeholder="Supplier Co." />
                    {manualForm.formState.errors.supplier_name && (
                      <p className="text-xs text-red-500 mt-1">{manualForm.formState.errors.supplier_name.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="label">Invoice Number</label>
                    <input {...manualForm.register("invoice_number")} className="input" placeholder="INV-001" />
                    {manualForm.formState.errors.invoice_number && (
                      <p className="text-xs text-red-500 mt-1">{manualForm.formState.errors.invoice_number.message}</p>
                    )}
                  </div>
                </div>
                <div>
                  <label className="label">Purchase Date</label>
                  <input {...manualForm.register("purchase_date")} type="date" className="input" />
                </div>

                <div className="border-t border-zinc-100 dark:border-zinc-800 pt-4">
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">Item Details</p>
                  <div>
                    <label className="label">Product</label>
                    <select {...manualForm.register("product_id")} className="input">
                      <option value="">Select product…</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                      ))}
                    </select>
                    {manualForm.formState.errors.product_id && (
                      <p className="text-xs text-red-500 mt-1">{manualForm.formState.errors.product_id.message}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <label className="label">Batch Number</label>
                      <input {...manualForm.register("batch_number")} className="input" placeholder="B-001" />
                      {manualForm.formState.errors.batch_number && (
                        <p className="text-xs text-red-500 mt-1">{manualForm.formState.errors.batch_number.message}</p>
                      )}
                    </div>
                    <div>
                      <label className="label">Expiry Date</label>
                      <input {...manualForm.register("expiry_date")} type="date" className="input" />
                    </div>
                    <div>
                      <label className="label">Quantity</label>
                      <input {...manualForm.register("quantity")} type="number" className="input" placeholder="100" />
                      {manualForm.formState.errors.quantity && (
                        <p className="text-xs text-red-500 mt-1">{manualForm.formState.errors.quantity.message}</p>
                      )}
                    </div>
                    <div>
                      <label className="label">Purchase Rate (₹)</label>
                      <input {...manualForm.register("purchase_rate")} type="number" step="0.01" className="input" placeholder="0.00" />
                      {manualForm.formState.errors.purchase_rate && (
                        <p className="text-xs text-red-500 mt-1">{manualForm.formState.errors.purchase_rate.message}</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setShowPurchaseModal(false)} className="btn-secondary flex-1">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={manualForm.formState.isSubmitting}
                    className="btn-primary flex-1 flex items-center justify-center gap-2"
                  >
                    {manualForm.formState.isSubmitting && <Loader2 size={14} className="animate-spin" />}
                    Save + Generate QR
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* QR CODE MODAL                                                       */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {qrBatch && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-2xl w-full max-w-sm border border-zinc-800 shadow-2xl p-6 text-center">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <QrCode size={16} className="text-indigo-400" />
                <span className="text-sm font-semibold text-white">Batch QR Code</span>
              </div>
              <button onClick={() => setQrBatch(null)} className="text-zinc-500 hover:text-zinc-300">
                <X size={18} />
              </button>
            </div>

            {/* QR Image */}
            <div className="bg-zinc-950 rounded-xl p-4 inline-block mx-auto mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getQRUrl(`STOCKFLOW|${qrBatch.sku}|${qrBatch.batchNumber}|${qrBatch.expiryDate}`)}
                alt="Batch QR"
                width={180}
                height={180}
                className="rounded-lg"
              />
            </div>

            {/* Batch Info */}
            <div className="space-y-1.5 mb-5">
              <p className="text-sm font-semibold text-white">{qrBatch.productName}</p>
              <div className="flex items-center justify-center gap-3 text-xs text-zinc-400">
                <span>SKU: <span className="font-mono text-zinc-300">{qrBatch.sku}</span></span>
                <span>·</span>
                <span>Batch: <span className="font-mono text-zinc-300">{qrBatch.batchNumber}</span></span>
              </div>
              <div className="flex items-center justify-center gap-3 text-xs text-zinc-400">
                <span>Expiry: <span className="text-zinc-300">{qrBatch.expiryDate}</span></span>
                <span>·</span>
                <span>Qty: <span className="text-zinc-300">{qrBatch.quantity}</span></span>
              </div>
              <p className="text-xs text-zinc-600 font-mono mt-2">
                STOCKFLOW|{qrBatch.sku}|{qrBatch.batchNumber}|{qrBatch.expiryDate}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button onClick={printQR} className="btn-secondary flex-1 flex items-center justify-center gap-1.5 text-xs">
                <Printer size={13} /> Print
              </button>
              <a
                href={getQRUrl(`STOCKFLOW|${qrBatch.sku}|${qrBatch.batchNumber}|${qrBatch.expiryDate}`, 400)}
                download={`QR-${qrBatch.batchNumber}.png`}
                className="btn-secondary flex-1 flex items-center justify-center gap-1.5 text-xs"
              >
                <Download size={13} /> Download
              </a>
              <button onClick={() => setQrBatch(null)} className="btn-primary flex-1 text-xs">
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* CSV IMPORT MODAL                                                     */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {showCSVModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-zinc-100 dark:border-zinc-800 sticky top-0 bg-white dark:bg-zinc-900 z-10">
              <div className="flex items-center gap-2">
                <Upload size={15} className="text-indigo-400" />
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Import from CSV</h2>
              </div>
              <button onClick={resetCSVModal} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {csvDone ? (
                // Success state
                <div className="text-center py-8">
                  <CheckCircle2 size={40} className="text-emerald-500 mx-auto mb-3" />
                  <p className="text-base font-semibold text-zinc-900 dark:text-white">
                    {validCSVCount} batch{validCSVCount !== 1 ? "es" : ""} imported!
                  </p>
                  <p className="text-sm text-zinc-500 mt-1">All valid rows have been saved to inventory.</p>
                  <button onClick={resetCSVModal} className="btn-primary mt-5 mx-auto">
                    Done
                  </button>
                </div>
              ) : (
                <>
                  {/* Template download */}
                  <div className="flex items-center justify-between px-4 py-3 bg-indigo-50 dark:bg-indigo-500/10 rounded-xl border border-indigo-100 dark:border-indigo-500/20">
                    <div>
                      <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">CSV Template</p>
                      <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-0.5">
                        Columns: sku, batch_number, expiry_date, quantity, purchase_rate
                      </p>
                    </div>
                    <button
                      onClick={downloadTemplate}
                      className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      <Download size={12} /> Download template
                    </button>
                  </div>

                  {/* Purchase header */}
                  <div>
                    <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">Purchase Header (applies to all rows)</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="label">Supplier Name</label>
                        <input
                          value={csvSupplier}
                          onChange={(e) => setCsvSupplier(e.target.value)}
                          className="input"
                          placeholder="Supplier Co."
                        />
                      </div>
                      <div>
                        <label className="label">Invoice Number</label>
                        <input
                          value={csvInvoice}
                          onChange={(e) => setCsvInvoice(e.target.value)}
                          className="input"
                          placeholder="INV-001"
                        />
                      </div>
                      <div>
                        <label className="label">Purchase Date</label>
                        <input
                          type="date"
                          value={csvDate}
                          onChange={(e) => setCsvDate(e.target.value)}
                          className="input"
                        />
                      </div>
                    </div>
                  </div>

                  {/* File upload */}
                  <div>
                    <label className="label">Upload CSV File</label>
                    <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl cursor-pointer hover:border-indigo-400 transition-colors bg-zinc-50 dark:bg-zinc-800/50">
                      <FileText size={20} className="text-zinc-400 mb-1" />
                      <span className="text-xs text-zinc-500">Click to select a CSV file</span>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        onChange={handleCSVFile}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* Preview table */}
                  {csvValidating && (
                    <div className="flex items-center gap-2 text-sm text-zinc-500">
                      <Loader2 size={14} className="animate-spin" />
                      Validating SKUs against database…
                    </div>
                  )}

                  {csvRows.length > 0 && !csvValidating && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">
                          Preview ({csvRows.length} rows)
                        </p>
                        <div className="flex items-center gap-3 text-xs">
                          <span className="text-emerald-500">✓ {validCSVCount} valid</span>
                          {errorCSVCount > 0 && <span className="text-red-400">✗ {errorCSVCount} error{errorCSVCount !== 1 ? "s" : ""}</span>}
                        </div>
                      </div>
                      <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
                              <th className="text-left px-3 py-2 font-medium text-zinc-500">SKU / Product</th>
                              <th className="text-left px-3 py-2 font-medium text-zinc-500">Batch</th>
                              <th className="text-left px-3 py-2 font-medium text-zinc-500">Expiry</th>
                              <th className="text-left px-3 py-2 font-medium text-zinc-500">Qty</th>
                              <th className="text-left px-3 py-2 font-medium text-zinc-500">Rate</th>
                              <th className="text-left px-3 py-2 font-medium text-zinc-500">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {csvRows.map((row, i) => (
                              <tr
                                key={i}
                                className={`border-b border-zinc-100 dark:border-zinc-800 ${
                                  row._status === "error" ? "bg-red-50 dark:bg-red-500/5" : ""
                                }`}
                              >
                                <td className="px-3 py-2">
                                  <span className="font-mono text-zinc-600 dark:text-zinc-400">{row.sku}</span>
                                  {row._product && (
                                    <span className="block text-zinc-400 text-xs">{row._product.name}</span>
                                  )}
                                </td>
                                <td className="px-3 py-2 font-mono text-zinc-600 dark:text-zinc-400">{row.batch_number}</td>
                                <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{row.expiry_date}</td>
                                <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{row.quantity}</td>
                                <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">₹{row.purchase_rate}</td>
                                <td className="px-3 py-2">
                                  {row._status === "valid" ? (
                                    <span className="text-emerald-500">✓</span>
                                  ) : (
                                    <span className="text-red-400" title={row._error}>✗ {row._error}</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3 pt-1">
                    <button onClick={resetCSVModal} className="btn-secondary flex-1">Cancel</button>
                    <button
                      onClick={importCSV}
                      disabled={
                        csvImporting ||
                        validCSVCount === 0 ||
                        !csvSupplier ||
                        !csvInvoice ||
                        !csvDate
                      }
                      className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {csvImporting ? (
                        <><Loader2 size={14} className="animate-spin" /> Importing…</>
                      ) : (
                        `Import ${validCSVCount} row${validCSVCount !== 1 ? "s" : ""}`
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}