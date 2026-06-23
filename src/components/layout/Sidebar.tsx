"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import {
  Package, LayoutDashboard, ShoppingCart, TrendingUp,
  Boxes, AlertTriangle, Clock, BarChart3, Settings, LogOut
} from "lucide-react";

const nav = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/products", icon: Package, label: "Products" },
  { href: "/purchases", icon: ShoppingCart, label: "Purchases" },
  { href: "/sales", icon: TrendingUp, label: "Sales" },
  { href: "/inventory", icon: Boxes, label: "Inventory" },
  { href: "/expiry", icon: AlertTriangle, label: "Expiry" },
  { href: "/timeline", icon: Clock, label: "Timeline" },
  { href: "/reports", icon: BarChart3, label: "Reports" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await signOut();
    router.push("/auth/login");
  }

  return (
    <aside className="w-56 min-h-screen bg-zinc-950 border-r border-zinc-800 flex flex-col">
      {/* Logo */}
      <div className="px-5 py-5 flex items-center gap-2.5">
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <Package size={16} className="text-white" />
        </div>
        <span className="text-base font-semibold text-white">StockFlow</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 space-y-0.5">
        {nav.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-indigo-600/15 text-indigo-400"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-4 border-t border-zinc-800 pt-3 space-y-0.5">
        <Link
          href="/settings"
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            pathname === "/settings"
              ? "bg-indigo-600/15 text-indigo-400"
              : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
          }`}
        >
          <Settings size={16} />
          Settings
        </Link>

        <div className="px-3 py-2 mt-2">
          <div className="text-xs text-zinc-600 truncate mb-2">{user?.email}</div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-zinc-500 hover:text-red-400 transition-colors"
          >
            <LogOut size={14} />
            Logout
          </button>
        </div>
      </div>
    </aside>
  );
}
