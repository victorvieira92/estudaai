"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard, Sun, BookOpen, RefreshCw, FileText,
  BarChart2, CalendarDays, LogOut, Target, UserCircle,
  FolderOpen, TrendingUp, MessageSquare, ExternalLink,
  Cloud, GraduationCap, BookMarked, History, ScrollText,
} from "lucide-react";

const nav = [
  { href: "/dashboard",        label: "Dashboard",         icon: LayoutDashboard },
  { href: "/historico",        label: "Histórico",         icon: History },
  { href: "/sessao",           label: "Sessao de Estudo",  icon: BookOpen },
  { href: "/edital",           label: "Edital",            icon: ScrollText },
  { href: "/meu-edital",        label: "Meu Edital",        icon: ScrollText },
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
  { href: "https://www.qconcursos.com/questoes-de-concursos/questoes",       label: "QConcursos", icon: ExternalLink  },
];

const BG     = "#1B4040";
const BORDER = "rgba(255,255,255,0.08)";
const MUTED  = "rgba(255,255,255,0.5)";
const ACTIVE = "rgba(255,255,255,0.15)";
const HOVER  = "rgba(255,255,255,0.08)";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="fixed left-0 top-0 h-screen w-56 flex flex-col z-50"
      style={{ backgroundColor: BG }}
    >
      <div
        className="flex items-center justify-center px-4 shrink-0"
        style={{ height: "124px", borderBottom: `1px solid ${BORDER}` }}
      >
        <Image
          src="/logo-estudaai.png"
          alt="EstudaAí"
          width={148}
          height={74}
          className="object-contain"
          style={{ maxHeight: "72px", width: "auto" }}
          priority
        />
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all"
              style={{
                backgroundColor: active ? ACTIVE : "transparent",
                color:           active ? "#ffffff" : MUTED,
                fontWeight:      active ? 600 : 400,
              }}
              onMouseEnter={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.backgroundColor = HOVER;
                  (e.currentTarget as HTMLElement).style.color = "#fff";
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
                  (e.currentTarget as HTMLElement).style.color = MUTED;
                }
              }}
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
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all"
            style={{ color: MUTED }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.backgroundColor = HOVER;
              (e.currentTarget as HTMLElement).style.color = "#fff";
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
              (e.currentTarget as HTMLElement).style.color = MUTED;
            }}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span>{label}</span>
            <span className="ml-auto text-[10px]" style={{ color: "rgba(255,255,255,0.2)" }}>↗</span>
          </a>
        ))}
      </nav>

      <div className="p-3" style={{ borderTop: `1px solid ${BORDER}` }}>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm transition-all"
          style={{ color: MUTED }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.backgroundColor = HOVER;
            (e.currentTarget as HTMLElement).style.color = "#fff";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
            (e.currentTarget as HTMLElement).style.color = MUTED;
          }}
        >
          <LogOut className="w-4 h-4" /> Sair
        </button>
      </div>
    </aside>
  );
}
