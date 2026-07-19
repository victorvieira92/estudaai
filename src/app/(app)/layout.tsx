"use client";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { FloatingTimer } from "@/components/FloatingTimer";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  // Sincroniza com o estado do Sidebar via localStorage + evento customizado
  useEffect(() => {
    const sync = () => {
      try {
        const saved = localStorage.getItem("sidebar_collapsed");
        setCollapsed(saved === "true");
      } catch {}
    };
    sync();
    window.addEventListener("sidebar_toggle", sync);
    return () => window.removeEventListener("sidebar_toggle", sync);
  }, []);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!session) return null;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main
        className="flex-1 min-h-screen bg-gray-50 transition-all duration-300"
        style={{ marginLeft: collapsed ? "60px" : "224px" }}
      >
        {children}
      </main>
      <FloatingTimer />
    </div>
  );
}
