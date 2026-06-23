"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { createClient } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Download, Loader2 } from "lucide-react";

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899"];

export default function ReportsPage() {
  const [productSales, setProductSales] = useState<any[]>([]);
  const [channelSales, setChannelSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: saleItems } = await supabase
        .from("sale_items")
        .select("quantity, sale_rate, product:products(name), sale:sales(channel)");

      const byProduct: Record<string, { qty: number; revenue: number }> = {};
      const byChannel: Record<string, number> = {};

      (saleItems || []).forEach((item: any) => {
        const name = item.product?.name || "Unknown";
        byProduct[name] = byProduct[name] || { qty: 0, revenue: 0 };
        byProduct[name].qty += item.quantity;
        byProduct[name].revenue += item.quantity * item.sale_rate;

        const ch = item.sale?.channel || "Unknown";
        byChannel[ch] = (byChannel[ch] || 0) + item.quantity * item.sale_rate;
      });

      setProductSales(
        Object.entries(byProduct)
          .map(([name, v]) => ({ name, quantity: v.qty, revenue: v.revenue }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 8)
      );
      setChannelSales(
        Object.entries(byChannel).map(([name, revenue]) => ({ name, revenue }))
      );
      setLoading(false);
    }
    load();
  }, []);

  async function exportPDF() {
    setExporting(true);
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.setTextColor(99, 102, 241);
    doc.text("StockFlow — Sales Report", 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated: ${new Date().toLocaleDateString("en-IN")}`, 14, 28);

    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text("Product-wise Sales", 14, 40);
    autoTable(doc, {
      startY: 45,
      head: [["Product", "Qty Sold", "Revenue"]],
      body: productSales.map(p => [p.name, p.quantity, formatCurrency(p.revenue)]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [99, 102, 241] },
    });

    const y = (doc as any).lastAutoTable.finalY + 10;
    doc.text("Channel-wise Revenue", 14, y);
    autoTable(doc, {
      startY: y + 5,
      head: [["Channel", "Revenue"]],
      body: channelSales.map(c => [c.name, formatCurrency(c.revenue)]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [99, 102, 241] },
    });

    doc.save("stockflow-sales-report.pdf");
    setExporting(false);
  }

  return (
    <AppLayout title="Reports">
      <div className="flex justify-end mb-5">
        <button onClick={exportPDF} disabled={exporting} className="btn-primary flex items-center gap-1.5">
          {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          Export PDF
        </button>
      </div>

      {loading ? (
        <div className="text-center py-16 text-zinc-400 text-sm">Loading report data…</div>
      ) : (
        <div className="space-y-5">
          {/* Product Sales Chart */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white mb-4">Top Products by Revenue</h2>
            {productSales.length === 0 ? (
              <p className="text-sm text-zinc-400 text-center py-8">No sales data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={productSales} margin={{ top: 0, right: 0, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#71717a" }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => [formatCurrency(v), "Revenue"]} contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8, fontSize: 11 }} />
                  <Bar dataKey="revenue" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Channel Chart */}
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-white mb-4">Revenue by Channel</h2>
              {channelSales.length === 0 ? (
                <p className="text-sm text-zinc-400 text-center py-8">No data.</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={channelSales} cx="50%" cy="50%" outerRadius={80} dataKey="revenue" nameKey="name">
                        {channelSales.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => [formatCurrency(v)]} contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8, fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-2 space-y-1.5">
                    {channelSales.map((c, i) => (
                      <div key={c.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ background: COLORS[i] }} />
                          <span className="text-zinc-600 dark:text-zinc-400">{c.name}</span>
                        </div>
                        <span className="font-medium text-zinc-900 dark:text-white">{formatCurrency(c.revenue)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Product Table */}
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-white mb-4">Product-wise Sales Table</h2>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800">
                    <th className="text-left pb-2 text-zinc-500 font-medium">Product</th>
                    <th className="text-right pb-2 text-zinc-500 font-medium">Qty</th>
                    <th className="text-right pb-2 text-zinc-500 font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {productSales.length === 0 ? (
                    <tr><td colSpan={3} className="py-6 text-center text-zinc-400">No data.</td></tr>
                  ) : productSales.map((p, i) => (
                    <tr key={p.name} className="border-b border-zinc-50 dark:border-zinc-800/50">
                      <td className="py-2 flex items-center gap-2">
                        <span className="w-5 h-5 rounded flex items-center justify-center text-xs font-bold text-white" style={{ background: COLORS[i % COLORS.length] }}>{i + 1}</span>
                        <span className="text-zinc-800 dark:text-zinc-200 truncate max-w-[120px]">{p.name}</span>
                      </td>
                      <td className="py-2 text-right text-zinc-500">{p.quantity}</td>
                      <td className="py-2 text-right font-medium text-zinc-900 dark:text-white">{formatCurrency(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
