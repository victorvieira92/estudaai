"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard, Sun, BookOpen, RefreshCw, Brain,
  FileText, BarChart2, CalendarDays, Zap, LogOut, Target,
  UserCircle, FolderOpen, TrendingUp, MessageSquare
} from "lucide-react";

const nav = [
  { href: "/dashboard",        label: "Dashboard",        icon: LayoutDashboard },
  { href: "/hoje",             label: "Hoje",              icon: Sun },
  { href: "/sessao",           label: "Sessao de Estudo",  icon: BookOpen },
  { href: "/ciclo",            label: "Ciclo Inteligente", icon: Zap },
  { href: "/calendario-ciclo", label: "Calendário",        icon: CalendarDays },
  { href: "/prioridades",      label: "Prioridades",       icon: TrendingUp },
  { href: "/materias",         label: "Materias",          icon: Target },
  { href: "/revisoes",         label: "Revisoes",          icon: RefreshCw },
  { href: "/flashcards",       label: "Flashcards",        icon: Brain },
  { href: "/flashcards/novo",  label: "Gerenciar Cards",   icon: Brain },
  { href: "/caderno",          label: "Caderno de Erros",  icon: FileText },
  { href: "/resumos",          label: "Resumos",           icon: FolderOpen },
  { href: "/estatisticas",     label: "Estatisticas",      icon: BarChart2 },
  { href: "/perfil",           label: "Minha Conta",       icon: UserCircle },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  return (
    <aside className="fixed left-0 top-0 h-screen w-56 bg-gray-950 flex flex-col z-50">
      <div className="px-5 py-6 border-b border-gray-800">
        <p className="text-white font-bold text-lg">EstudaAi</p>
        <p className="text-gray-500 text-xs mt-0.5 truncate">{session?.user?.name ?? "Concurseiro"}</p>
      </div>
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                active ? "bg-white text-gray-900 font-semibold" : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}>
              <Icon className="w-4 h-4 shrink-0"/>
              {label}
            </Link>
          );
        })}
        <div className="pt-2 pb-1"><div className="border-t border-gray-800"/></div>
        <a href="https://studychat-production-9f95.up.railway.app/" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-gray-400 hover:text-white hover:bg-gray-800">
          <MessageSquare className="w-4 h-4 shrink-0"/>
          <span>StudyChat</span>
          <span className="ml-auto text-[10px] text-gray-600">↗</span>
        </a>
      </nav>
      <div className="p-3 border-t border-gray-800">
        <button onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-3 px-3 py-2.5 w-full text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg text-sm transition-colors">
          <LogOut className="w-4 h-4"/>Sair
        </button>
      </div>
    </aside>
  );
}
