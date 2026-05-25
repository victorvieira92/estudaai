import { Sidebar } from "@/components/layout/Sidebar";
import { FloatingTimer } from "@/components/FloatingTimer";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
      <FloatingTimer />
    </div>
  );
}
