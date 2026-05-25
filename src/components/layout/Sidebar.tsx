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
  { href: "https://ankiweb.net/decks",                                   label: "Anki",       icon: ExternalLink  },
  { href: "https://studychat-production-9f95.up.railway.app/",           label: "StudyChat",  icon: MessageSquare },
  { href: "https://www.estrategiaconcursos.com.br/app/dashboard/cursos", label: "Estratégia", icon: GraduationCap },
  { href: "https://onedrive.live.com/",                                  label: "OneDrive",   icon: Cloud         },
  { href: "https://notebooklm.google.com/notebook",                      label: "NotebookLM", icon: BookMarked    },
];

// Cor extraída da logo: verde-escuro petróleo #1B4040
const BG = "#1B4040";
const BG_HOVER = "#163535";
const BG_ACTIVE = "rgba(255,255,255,0.12)";
const BORDER = "rgba(255,255,255,0.08)";

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <aside
      className="fixed left-0 top-0 h-screen w-56 flex flex-col z-50"
      style={{ backgroundColor: BG }}
    >
      {/* Logo estilo Estudei — ícone + texto lado a lado */}
      <div
        className="px-4 py-4 flex items-center gap-2.5"
        style={{ borderBottom: `1px solid ${BORDER}` }}
      >
        <Image
          src="/logo-estudaai.png"
          alt="EstudaAí"
          width={32}
          height={32}
          className="rounded-md object-contain shrink-0"
          style={{ background: "transparent" }}
        />
        <div className="min-w-0">
          <p className="text-white font-bold text-base leading-tight tracking-tight">
            EstudaAí
          </p>
          <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.45)" }}>
            {session?.user?.name ?? "Concurseiro"}
          </p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors"
              style={{
                backgroundColor: active ? "rgba(255,255,255,0.15)" : "transparent",
                color: active ? "#ffffff" : "rgba(255,255,255,0.6)",
                fontWeight: active ? 600 : 400,
              }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLElement).style.color = "#fff"; }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.6)"; }}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}

        <div className="pt-2 pb-1">
          <div style={{ borderTop: `1px solid ${BORDER}` }} />
        </div>

        {externalLinks.map(({ href, label, icon: Icon }) => (
          <a
            key={href}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors"
            style={{ color: "rgba(255,255,255,0.6)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLElement).style.color = "#fff"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.6)"; }}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span>{label}</span>
            <span className="ml-auto text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>↗</span>
          </a>
        ))}
      </nav>

      <div className="p-3" style={{ borderTop: `1px solid ${BORDER}` }}>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm transition-colors"
          style={{ color: "rgba(255,255,255,0.6)" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "rgba(255,255,255,0.08)"; (e.currentTarget as HTMLElement).style.color = "#fff"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.6)"; }}
        >
          <LogOut className="w-4 h-4" /> Sair
        </button>
      </div>
    </aside>
  );
}
