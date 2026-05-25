"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard, Sun, BookOpen, RefreshCw, FileText,
  BarChart2, CalendarDays, Zap, LogOut, Target, UserCircle,
  FolderOpen, TrendingUp, MessageSquare, ExternalLink,
  Cloud, GraduationCap, BookMarked,
} from "lucide-react";

const nav = [
  { href: "/dashboard",        label: "Dashboard",         icon: LayoutDashboard },
  { href: "/hoje",             label: "Hoje",              icon: Sun },
  { href: "/sessao",           label: "Sessao de Estudo",  icon: BookOpen },
  { href: "/ciclo",            label: "Ciclo Inteligente", icon: Zap },
  { href: "/calendario-ciclo", label: "Calendário",        icon: CalendarDays },
  { href: "/prioridades",      label: "Prioridades",       icon: TrendingUp },
  { href: "/materias",         label: "Materias",          icon: Target },
  { href: "/revisoes",         label: "Revisoes",          icon: RefreshCw },
  { href: "/caderno",          label: "Caderno de Erros",  icon: FileText },
  { href: "/resumos",          label: "Resumos",           icon: FolderOpen },
  { href: "/estatisticas",     label: "Estatisticas",      icon: BarChart2 },
  { href: "/perfil",           label: "Minha Conta",       icon: UserCircle },
];

const externalLinks = [
  { href: "https://ankiweb.net/decks",                                    label: "Anki",      icon: ExternalLink  },
  { href: "https://studychat-production-9f95.up.railway.app/",            label: "StudyChat", icon: MessageSquare },
  { href: "https://www.estrategiaconcursos.com.br/app/dashboard/cursos",  label: "Estratégia",icon: GraduationCap },
  { href: "https://onedrive.live.com/",                                   label: "OneDrive",  icon: Cloud         },
  { href: "https://notebooklm.google.com/notebook",                       label: "NotebookLM",icon: BookMarked    },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <aside className="fixed left-0 top-0 h-screen w-56 bg-gray-950 flex flex-col z-50">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-gray-800 flex items-center gap-3">
        <Image
          src="/logo-estudaai.png"
          alt="EstudaAí"
          width={36}
          height={36}
          className="rounded-lg shrink-0 object-contain"
        />
        <div className="min-w-0">
          <p className="text-white font-bold text-base leading-tight">EstudaAí</p>
          <p className="text-gray-500 text-xs truncate">{session?.user?.name ?? "Concurseiro"}</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                active ? "bg-white text-gray-900 font-semibold" : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}>
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}

        <div className="pt-2 pb-1"><div className="border-t border-gray-800" /></div>

        {externalLinks.map(({ href, label, icon: Icon }) => (
          <a key={href} href={href} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors text-gray-400 hover:text-white hover:bg-gray-800">
            <Icon className="w-4 h-4 shrink-0" />
            <span>{label}</span>
            <span className="ml-auto text-[10px] text-gray-600">↗</span>
          </a>
        ))}
      </nav>

      <div className="p-3 border-t border-gray-800">
        <button onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-3 px-3 py-2.5 w-full text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg text-sm transition-colors">
          <LogOut className="w-4 h-4" /> Sair
        </button>
      </div>
    </aside>
  );
}
