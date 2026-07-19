"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, BookOpen, RefreshCw, FileText,
  CalendarDays, LogOut, Target, UserCircle,
  FolderOpen, TrendingUp, MessageSquare, ExternalLink,
  Cloud, GraduationCap, BookMarked, History, ScrollText, Trophy,
  ChevronLeft, ChevronRight,
} from "lucide-react";

const nav = [
  { href: "/dashboard",        label: "Painel",            icon: LayoutDashboard },
  { href: "/comparativo",      label: "Comparativo",       icon: Trophy },
  { href: "/historico",        label: "Histórico",         icon: History },
  { href: "/sessao",           label: "Sessao de Estudo",  icon: BookOpen },
  { href: "/edital",           label: "Edital",            icon: ScrollText },
  { href: "/meu-edital",       label: "Meu Edital",        icon: ScrollText },
  { href: "/calendario-ciclo", label: "Calendário",        icon: CalendarDays },
  { href: "/prioridades",      label: "Prioridades",       icon: TrendingUp },
  { href: "/materias",         label: "Materias",          icon: Target },
  { href: "/revisoes",         label: "Revisoes",          icon: RefreshCw },
  { href: "/caderno",          label: "Caderno de Erros",  icon: FileText },
  { href: "/resumos",          label: "Resumos",           icon: FolderOpen },
  { href: "/perfil",           label: "Minha Conta",       icon: UserCircle },
];

const externalLinks = [
  { href: "https://ankiweb.net/decks",                                       label: "Anki",       icon: ExternalLink  },
  { href: "https://studychat-production-9f95.up.railway.app/",               label: "StudyChat",  icon: MessageSquare },
  { href: "https://www.estrategiaconcursos.com.br/app/dashboard/cursos",     label: "Estratégia", icon: GraduationCap },
  { href: "https://onedrive.live.com/",                                      label: "OneDrive",   icon: Cloud         },
  { href: "https://notebooklm.google.com/notebook",                          label: "NotebookLM", icon: BookMarked    },
  { href: "https://www.qconcursos.com/questoes-de-concursos/questoes",       label: "QConcursos", icon: ExternalLink  },
];

const BG     = "#1B4040";
const BORDER = "rgba(255,255,255,0.08)";
const MUTED  = "rgba(255,255,255,0.5)";
const ACTIVE = "rgba(255,255,255,0.15)";
const HOVER  = "rgba(255,255,255,0.08)";

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("sidebar_collapsed");
      if (saved !== null) setCollapsed(saved === "true");
    } catch {}
  }, []);

  const toggle = () => {
    setCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem("sidebar_collapsed", String(next));
        window.dispatchEvent(new Event("sidebar_toggle"));
      } catch {}
      return next;
    });
  };

  const w = collapsed ? "60px" : "224px";

  return (
    <aside
      className="fixed left-0 top-0 h-screen flex flex-col z-50 transition-all duration-300"
      style={{ backgroundColor: BG, width: w, minWidth: w, maxWidth: w }}
    >
      {/* Logo / toggle header */}
      <div
        className="flex items-center shrink-0 relative"
        style={{ height: "124px", borderBottom: `1px solid ${BORDER}`, padding: collapsed ? "0" : "0 12px" }}
      >
        {!collapsed && (
          <Image
            src="/logo-estudaai.png"
            alt="EstudaAí"
            width={148}
            height={74}
            className="object-contain mx-auto"
            style={{ maxHeight: "72px", width: "auto" }}
            priority
          />
        )}

        {/* Botão de toggle */}
        <button
          onClick={toggle}
          className="absolute flex items-center justify-center rounded-full transition-all"
          style={{
            width: 22, height: 22,
            backgroundColor: "rgba(255,255,255,0.15)",
            bottom: -11,
            right: collapsed ? "50%" : 12,
            transform: collapsed ? "translateX(50%)" : "none",
            color: "#fff",
            zIndex: 10,
          }}
          title={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          {collapsed
            ? <ChevronRight className="w-3 h-3" />
            : <ChevronLeft  className="w-3 h-3" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 space-y-0.5" style={{ padding: collapsed ? "12px 6px" : "12px 8px" }}>
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className="flex items-center rounded-lg transition-all"
              style={{
                gap:             collapsed ? 0 : 12,
                padding:         collapsed ? "10px 0" : "10px 12px",
                justifyContent:  collapsed ? "center" : "flex-start",
                backgroundColor: active ? ACTIVE : "transparent",
                color:           active ? "#ffffff" : MUTED,
                fontWeight:      active ? 600 : 400,
                fontSize:        14,
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
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}

        <div className="py-2">
          <div style={{ borderTop: `1px solid ${BORDER}` }} />
        </div>

        {externalLinks.map(({ href, label, icon: Icon }) => (
          <a
            key={href}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            title={collapsed ? label : undefined}
            className="flex items-center rounded-lg transition-all"
            style={{
              gap:            collapsed ? 0 : 12,
              padding:        collapsed ? "10px 0" : "10px 12px",
              justifyContent: collapsed ? "center" : "flex-start",
              color:          MUTED,
              fontSize:       14,
            }}
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
            {!collapsed && (
              <>
                <span className="flex-1">{label}</span>
                <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>↗</span>
              </>
            )}
          </a>
        ))}
      </nav>

      {/* Sair */}
      <div style={{ padding: "12px 6px", borderTop: `1px solid ${BORDER}` }}>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          title={collapsed ? "Sair" : undefined}
          className="flex items-center rounded-lg transition-all w-full"
          style={{
            gap:            collapsed ? 0 : 12,
            padding:        collapsed ? "10px 0" : "10px 12px",
            justifyContent: collapsed ? "center" : "flex-start",
            color:          MUTED,
            fontSize:       14,
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.backgroundColor = HOVER;
            (e.currentTarget as HTMLElement).style.color = "#fff";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
            (e.currentTarget as HTMLElement).style.color = MUTED;
          }}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </aside>
  );
}
