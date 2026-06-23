"use client";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function AppLayout({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar title={title} />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
