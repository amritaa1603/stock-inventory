"use client";
import { useEffect, useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { createClient } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from "recharts";
import { Package, TrendingUp, AlertTriangle, ShoppingCart } from "lucide-react";

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4"];

const salesData = [
  { month: "Jan", sales: 42000 }, { month: "Feb", sales: 58000 },
  { month: "Mar", sales: 51000 }, { month: "Apr", sales: 73000 },
  { month: "May", sales: 67000 }, { month: "Jun", sales: 89000 },
];

const channelData = [
  { name: "Website", value: 30 }, { name: "Amazon", value: 25 },
  { name: "Flipkart", value: 20 }, { name: "Wholesale", value: 15 },
  { name: "Retail", value: 10 },
];

interface Stats {
  totalProducts: number;
  totalStock: number;
  nearExpiry: number;
  todaySales: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({ totalProducts: 0, totalStock: 0, nearExpiry: 0, todaySales: 0 });
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const [products, batches, sales] = await Promise.all([
        supabase.from("products").select("id", { count: "exact" }),
        supabase.from("batches").select("quantity, expiry_date"),
        supabase.from("sales").select("total_amount").eq("sale_date", new Date().toISOString().split("T")[0]),
      ]);

      const today = new Date();
      const in30 = new Date(); in30.setDate(today.getDate() + 30);
      const batchList = batches.data || [];
      const totalStock = batchList.reduce((s, b) => s + (b.quantity || 0), 0);
      const nearExpiry = batchList.filter(b => {
        const d = new Date(b.expiry_date);
        return d > today && d <= in30;
      }).length;

      const todaySales = (sales.data || []).reduce((s, x) => s + (x.total_amount || 0), 0);

      setStats({ totalProducts: products.count || 0, totalStock, nearExpiry, todaySales });

      const txn = await supabase
        .from("inventory_transactions")
        .select("*, product:products(name), batch:batches(batch_number)")
        .order("created_at", { ascending: false })
        .limit(5);
      setRecentTransactions(txn.data || []);
    }
    load();
  }, []);

  const statCards = [
    { label: "Total Products", value: stats.totalProducts.toString(), icon: Package, color: "text-indigo-500", bg: "bg-indigo-50 dark:bg-indigo-500/10" },
    { label: "Total Stock", value: stats.totalStock.toLocaleString(), icon: ShoppingCart, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-500/10" },
    { label: "Near Expiry (30d)", value: stats.nearExpiry.toString(), icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-500/10" },
    { label: "Today's Sales", value: formatCurrency(stats.todaySales), icon: TrendingUp, color: "text-violet-500", bg: "bg-violet-50 dark:bg-violet-500/10" },
  ];

  const txnColors: Record<string, string> = {
    PURCHASE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400",
    SALE: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-400",
    SALE_RETURN: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400",
    BREAKAGE: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400",
    EXPIRY: "bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-400",
  };

  return (
    <AppLayout title="Dashboard">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="card p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
                <p className="text-2xl font-bold text-zinc-900 dark:text-white mt-1">{value}</p>
              </div>
              <div className={`p-2 rounded-lg ${bg}`}>
                <Icon size={18} className={color} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Sales Trend */}
        <div className="card p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white mb-4">Sales Trend</h2>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={salesData}>
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#71717a" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#71717a" }} axisLine={false} tickLine={false} tickFormatter={(v) => `₹${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => [formatCurrency(v), "Sales"]} contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="sales" stroke="#6366f1" strokeWidth={2} fill="url(#salesGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Channel Distribution */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white mb-4">Sales by Channel</h2>
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie data={channelData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                {channelData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 space-y-1.5">
            {channelData.map((c, i) => (
              <div key={c.name} className="flex items-center gap-2 text-xs">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: COLORS[i] }} />
                <span className="text-zinc-600 dark:text-zinc-400 flex-1">{c.name}</span>
                <span className="font-medium text-zinc-900 dark:text-white">{c.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="card">
        <div className="p-5 border-b border-zinc-100 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Recent Inventory Activity</h2>
        </div>
        {recentTransactions.length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-400">No transactions yet. Start by adding products and purchases.</div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {recentTransactions.map((t) => (
              <div key={t.id} className="flex items-center gap-4 px-5 py-3 text-sm">
                <span className={`badge ${txnColors[t.transaction_type] || ""}`}>{t.transaction_type}</span>
                <span className="font-medium text-zinc-900 dark:text-white flex-1">{t.product?.name || "—"}</span>
                <span className="text-zinc-500">{t.batch?.batch_number || "—"}</span>
                <span className="text-zinc-700 dark:text-zinc-300 font-mono">×{t.quantity}</span>
                <span className="text-zinc-400 text-xs">{new Date(t.created_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
