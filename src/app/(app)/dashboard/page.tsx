"use client";
import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  CheckCircle, Flame, RefreshCw, BookOpen, Pencil,
  ChevronLeft, ChevronRight, X, TrendingUp, Clock, FileText, AlertCircle,
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
} from "recharts";

const BG = "#1B4040";

// ── Interfaces ────────────────────────────────────────────────────────────────
interface WeekDay { day: string; date: string; hours: number; questions: number; correct: number; wrong: number; }
interface WeekData { weekOffset: number; startDate: string; endDate: string; days: WeekDay[]; }

interface Stats {
  totalHours: number; totalQuestions: number; totalCorrect: number; totalWrong: number;
  accuracy: number | null; completedPdfs: number; totalPdfs: number;
  pendingErrors: number; pendingReviews: number; lateReviews: number;
  streak: number; studiedDays: number; totalDays: number; consistency: number;
  consistencyDots: { date: string; studied: boolean; status: "done" | "partial" | "none" | "future" }[];
  todayHours: number; todayQuestions: number;
  todayBySubject: { name: string; hours: number }[];
  subjectStats: { id: string; name: string; hours: number; questions: number; correct: number; wrong: number; accuracy: number | null }[];
  weeklyHours: { day: string; hours: number }[];
  weeksData: WeekData[];
  weeklyGoalHours: number;
}

interface SubjectDetail {
  subjectName: string; totalHours: number; totalQuestions: number;
  totalCorrect: number; totalWrong: number; accuracy: number | null;
  pendingErrors: number; totalErrors: number; totalSessions: number;
  byPdf: { title: string; hours: number; pages: number; questions: number; correct: number; accuracy: number | null }[];
  byTopic: { name: string; hours: number; questions: number; accuracy: number | null }[];
  weeklyEvolution: { label: string; correct: number; wrong: number; hours: number }[];
  errorDistribution: { type: string; label: string; count: number }[];
  sessionHistory: { id: string; date: string; hours: number; questions: number; correct: number; wrong: number; accuracy: number | null; pdfTitle: string; topicName: string; category?: string; endPage?: number; comment?: string }[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const PIE_COLORS = [BG,"#3B82F6","#10B981","#F59E0B","#EF4444","#8B5CF6","#EC4899","#14B8A6"];

function fmtH(h: number) {
  const hh = Math.floor(h); const mm = Math.round((h - hh) * 60);
  return mm > 0 ? `${hh}h${mm.toString().padStart(2,"0")}min` : `${hh}h`;
}
function fmtDate(ds: string) {
  return new Date(ds + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

const ERROR_COLORS: Record<string, string> = {
  desatencao: "#BA7517", nao_estudei: "#185FA5", nao_lembrei: "#534AB7",
  confundi_conceitos: "#E24B4A", interpretacao: "#1D9E75", pegadinha: "#D85A30",
  outro: "#888780", decoreba: "#9333ea",
};

// ── MetasSemanal ──────────────────────────────────────────────────────────────
function MetasSemanal({ weekTotalHours, weekTotalQ, weeklyGoalHours, userId }: {
  weekTotalHours: number; weekTotalQ: number; weeklyGoalHours: number; userId?: string;
}) {
  const storageKey = userId ? `estudaai_meta_q_${userId}` : "estudaai_meta_q";
  const [metaQ,    setMetaQ]    = React.useState(150);
  const [editingQ, setEditingQ] = React.useState(false);
  const [inputQ,   setInputQ]   = React.useState("");

  React.useEffect(() => {
    try { const s = localStorage.getItem(storageKey); if (s) setMetaQ(parseInt(s) || 150); } catch {}
  }, [storageKey]);

  const saveMetaQ = () => {
    const v = parseInt(inputQ);
    if (v > 0) { setMetaQ(v); try { localStorage.setItem(storageKey, String(v)); } catch {} }
    setEditingQ(false);
  };

  const horasMeta = weeklyGoalHours;
  const pctHoras  = horasMeta > 0 ? Math.min(100, Math.round((weekTotalHours / horasMeta) * 100)) : 0;
  const pctQ      = Math.min(100, Math.round((weekTotalQ / metaQ) * 100));

  const BarMeta = ({ pct, color }: { pct: number; color: string }) => (
    <div className="relative h-5 bg-gray-100 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all flex items-center justify-end pr-2"
        style={{ width: `${Math.max(pct, 8)}%`, backgroundColor: color }}>
        {pct >= 15 && <span className="text-white text-[10px] font-bold">{pct}%</span>}
      </div>
      {pct < 15 && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 text-[10px] font-bold">{pct}%</span>}
    </div>
  );

  return (
    <div className="space-y-4">
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1.5">
          <span className="font-medium">Horas de Estudo</span>
          <span className="font-semibold text-gray-700">{fmtH(weekTotalHours)}{horasMeta > 0 ? ` / ${fmtH(horasMeta)}` : ""}</span>
        </div>
        <BarMeta pct={pctHoras} color={BG} />
      </div>
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1.5">
          <span className="font-medium">Questões</span>
          <div className="flex items-center gap-1.5">
            {editingQ ? (
              <div className="flex items-center gap-1">
                <input autoFocus type="number" min="1" value={inputQ}
                  onChange={e => setInputQ(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") saveMetaQ(); if (e.key === "Escape") setEditingQ(false); }}
                  className="w-16 text-center text-xs border border-gray-300 rounded-lg px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  placeholder={String(metaQ)} />
                <button onClick={saveMetaQ} className="text-[10px] text-white px-1.5 py-0.5 rounded bg-gray-900 font-bold">✓</button>
                <button onClick={() => setEditingQ(false)} className="text-[10px] text-gray-400 hover:text-gray-600">✕</button>
              </div>
            ) : (
              <>
                <span className="font-semibold text-gray-700">{weekTotalQ} / {metaQ}</span>
                <button onClick={() => { setInputQ(String(metaQ)); setEditingQ(true); }}
                  title="Editar meta de questões" className="text-gray-300 hover:text-gray-500 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>
        <BarMeta pct={pctQ} color="#8B5CF6" />
      </div>
    </div>
  );
}

// ── PdfQuestionsChart ─────────────────────────────────────────────────────────
function PdfQuestionsChart({ byPdf }: {
  byPdf: { title: string; questions: number; correct: number; pages: number; hours: number; accuracy: number | null }[]
}) {
  const data = (byPdf ?? []).filter(p => p.questions > 0).map(p => ({
    title: p.title, acertos: p.correct, erros: Math.max(0, p.questions - p.correct),
  }));
  if (!data.length) return <p className="text-xs text-gray-400 text-center py-4">Nenhuma questão registrada por PDF.</p>;
  return (
    <ResponsiveContainer width="100%" height={Math.max(data.length * 44 + 20, 120)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 36, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 10 }} />
        <YAxis type="category" dataKey="title" width={90} tick={{ fontSize: 10 }} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        <Bar dataKey="acertos" fill="#1D9E75" name="Acertos" stackId="q" />
        <Bar dataKey="erros"   fill="#E24B4A" name="Erros"   stackId="q" radius={[0,4,4,0] as [number,number,number,number]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── SubjectModal ──────────────────────────────────────────────────────────────

function SessionHistoryCards({ sessions }: {
  sessions: { id: string; date: string; hours: number; questions: number; correct: number; wrong: number; accuracy: number | null; pdfTitle: string; topicName: string; category?: string; endPage?: number; comment?: string }[]
}) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  if (sessions.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
        Nenhuma sessão no período selecionado.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Histórico de sessões</h3>
        <span className="text-xs text-gray-400">{sessions.length} sessão{sessions.length !== 1 ? "ões" : ""}</span>
      </div>
      <div className="divide-y divide-gray-50">
        {sessions.map(s => {
          const isOpen = expandedId === s.id;
          const dateStr = new Date(s.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
          const accColor = s.accuracy === null ? "" : s.accuracy >= 70 ? "bg-green-100 text-green-700" : s.accuracy >= 50 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700";

          return (
            <div key={s.id}>
              {/* Linha principal — clicável */}
              <button
                onClick={() => setExpandedId(isOpen ? null : s.id)}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left">

                {/* Data */}
                <div className="shrink-0 w-16 text-center">
                  <p className="text-base font-bold text-gray-900 leading-none">{dateStr.slice(0,5)}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{dateStr.slice(6)}</p>
                </div>

                {/* PDF + Tópico */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{s.pdfTitle || "Sem material"}</p>
                  {s.topicName && <p className="text-xs text-gray-400 truncate mt-0.5">{s.topicName}</p>}
                  {s.category && (
                    <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">{s.category}</span>
                  )}
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-center hidden sm:block">
                    <p className="text-[10px] text-gray-400">Tempo</p>
                    <p className="text-xs font-semibold text-gray-700">{s.hours > 0 ? fmtH(s.hours) : "—"}</p>
                  </div>
                  {s.questions > 0 && (
                    <>
                      <div className="text-center">
                        <p className="text-[10px] text-gray-400">✓ / ✗</p>
                        <p className="text-xs font-semibold">
                          <span className="text-green-600">{s.correct}</span>
                          <span className="text-gray-300 mx-0.5">/</span>
                          <span className="text-red-500">{s.wrong}</span>
                        </p>
                      </div>
                      {s.accuracy !== null && (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${accColor}`}>{s.accuracy}%</span>
                      )}
                    </>
                  )}
                  {s.questions === 0 && <span className="text-xs text-gray-300">sem questões</span>}
                  {/* Chevron */}
                  <svg className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>

              {/* Detalhes expandidos */}
              {isOpen && (
                <div className="px-5 pb-4 pt-1 bg-gray-50 border-t border-gray-100">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-white rounded-xl p-3 border border-gray-100">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Data completa</p>
                      <p className="text-sm font-semibold text-gray-800">{dateStr}</p>
                    </div>
                    <div className="bg-white rounded-xl p-3 border border-gray-100">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Tempo de estudo</p>
                      <p className="text-sm font-semibold text-gray-800">{s.hours > 0 ? fmtH(s.hours) : "—"}</p>
                    </div>
                    <div className="bg-white rounded-xl p-3 border border-gray-100">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Categoria</p>
                      <p className="text-sm font-semibold text-gray-800">{s.category || "—"}</p>
                    </div>
                    <div className="bg-white rounded-xl p-3 border border-gray-100">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Última página</p>
                      <p className="text-sm font-semibold text-gray-800">{s.endPage && s.endPage > 0 ? `Pág. ${s.endPage}` : "—"}</p>
                    </div>
                  </div>
                  {s.questions > 0 && (
                    <div className="grid grid-cols-3 gap-3 mt-3">
                      <div className="bg-white rounded-xl p-3 border border-gray-100 text-center">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Total de questões</p>
                        <p className="text-lg font-bold text-gray-800">{s.questions}</p>
                      </div>
                      <div className="bg-white rounded-xl p-3 border border-gray-100 text-center">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Acertos</p>
                        <p className="text-lg font-bold text-green-600">{s.correct}</p>
                      </div>
                      <div className="bg-white rounded-xl p-3 border border-gray-100 text-center">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Erros</p>
                        <p className="text-lg font-bold text-red-500">{s.wrong}</p>
                      </div>
                    </div>
                  )}
                  {s.comment && (
                    <div className="mt-3 bg-white rounded-xl p-3 border border-gray-100">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">💬 Comentário</p>
                      <p className="text-sm text-gray-700">{s.comment}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SubjectModal({ subjectId, subjectName, onClose }: {
  subjectId: string; subjectName: string; onClose: () => void;
}) {
  const [period, setPeriod] = useState(30);
  const [data, setData]     = useState<SubjectDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setData(null);
    fetch(`/api/statistics/subject?subjectId=${subjectId}&period=${period}`)
      .then(r => { if (!r.ok) throw new Error("erro"); return r.json(); })
      .then(d => {
        setData({
          ...d,
          byPdf:             d.byPdf             ?? [],
          byTopic:           d.byTopic           ?? [],
          weeklyEvolution:   d.weeklyEvolution   ?? [],
          errorDistribution: d.errorDistribution ?? [],
          sessionHistory:    d.sessionHistory    ?? [],
        });
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [subjectId, period]);

  const accColor = (a: number | null) =>
    a === null ? "text-gray-400" : a >= 70 ? "text-green-600" : a >= 50 ? "text-yellow-600" : "text-red-600";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-6 pb-6 px-4"
      style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 rounded-t-2xl shrink-0" style={{ backgroundColor: BG }}>
          <div>
            <p className="text-xs font-medium uppercase tracking-widest mb-1" style={{ color: "#9FE1CB" }}>Estatísticas detalhadas</p>
            <h2 className="text-xl font-bold text-white">{subjectName}</h2>
          </div>
          <div className="flex items-center gap-3">
            <select value={period} onChange={e => setPeriod(Number(e.target.value))}
              className="text-sm rounded-xl px-3 py-2 border-0 focus:outline-none"
              style={{ backgroundColor: "rgba(255,255,255,0.12)", color: "#fff" }}>
              <option value={30}  style={{ color: "#000" }}>Últimos 30 dias</option>
              <option value={90}  style={{ color: "#000" }}>Últimos 90 dias</option>
              <option value={0}   style={{ color: "#000" }}>Todo o período</option>
            </select>
            <button onClick={onClose} className="p-2 rounded-xl text-white hover:bg-white/10 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {loading && (
            <div className="grid grid-cols-4 gap-4">
              {[1,2,3,4].map(i => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}
            </div>
          )}
          {!loading && !data && (
            <p className="text-center text-gray-400 py-8">Não foi possível carregar os dados.</p>
          )}
          {!loading && data && (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { icon: Clock,       label: "Tempo total",      value: fmtH(data.totalHours),        sub: `${data.totalSessions} sessões` },
                  { icon: TrendingUp,  label: "Questões",         value: String(data.totalQuestions),   sub: data.accuracy !== null ? `${data.accuracy}% de acerto` : "sem questões" },
                  { icon: FileText,    label: "Páginas lidas",    value: String((data.byPdf).reduce((a,p)=>a+p.pages,0)||"—"), sub: `${data.byPdf.length} PDFs` },
                  { icon: AlertCircle, label: "Erros no caderno", value: String(data.totalErrors),      sub: `${data.pendingErrors} pendentes` },
                ].map(({ icon: Icon, label, value, sub }) => (
                  <div key={label} className="bg-gray-50 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="w-4 h-4 text-gray-400" />
                      <p className="text-xs text-gray-500">{label}</p>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{value}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
                  </div>
                ))}
              </div>

              {/* Evolução semanal */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Evolução — acertos e erros por semana</h3>
                <div className="flex gap-4 mb-3">
                  <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-3 h-0.5 bg-green-500 inline-block rounded"/>Acertos</span>
                  <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-3 h-0.5 bg-red-400 inline-block rounded"/>Erros</span>
                </div>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={data.weeklyEvolution} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Line type="monotone" dataKey="correct" stroke="#1D9E75" strokeWidth={2} dot={{ r: 3 }} name="Acertos" />
                    <Line type="monotone" dataKey="wrong"   stroke="#E24B4A" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 3" name="Erros" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Tempo por PDF + Questões por PDF */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Tempo de estudo por PDF</h3>
                  {data.byPdf.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">Nenhuma sessão com PDF registrado.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={Math.max(data.byPdf.length * 44 + 20, 120)}>
                      <BarChart data={data.byPdf} layout="vertical" margin={{ top: 0, right: 36, left: 8, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${Math.round(v)}h`} />
                        <YAxis type="category" dataKey="title" width={90} tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(v: number) => [`${v.toFixed(1)}h`, "Tempo"]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                        <Bar dataKey="hours" fill={BG} radius={[0,4,4,0] as [number,number,number,number]} name="Horas" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Questões por PDF</h3>
                  <PdfQuestionsChart byPdf={data.byPdf} />
                </div>
              </div>

              {/* Tipos de erro + Tópicos */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Tipos de erro — caderno</h3>
                  {data.errorDistribution.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">Nenhum erro registrado nesta matéria.</p>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-2 mb-3">
                        {data.errorDistribution.slice(0,5).map(e => (
                          <span key={e.type} className="flex items-center gap-1 text-xs text-gray-500">
                            <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: ERROR_COLORS[e.type] ?? "#888" }}/>
                            {e.label} ({e.count})
                          </span>
                        ))}
                      </div>
                      <ResponsiveContainer width="100%" height={160}>
                        <PieChart>
                          <Pie data={data.errorDistribution} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={65} innerRadius={35} paddingAngle={2}>
                            {data.errorDistribution.map(e => <Cell key={e.type} fill={ERROR_COLORS[e.type] ?? "#888"} />)}
                          </Pie>
                          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </>
                  )}
                </div>
                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Tópicos com mais horas</h3>
                  {data.byTopic.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">Nenhum tópico registrado.</p>
                  ) : (
                    <div className="space-y-2">
                      {data.byTopic.slice(0,7).map(t => {
                        const maxH = Math.max(...data.byTopic.map(x => x.hours), 0.1);
                        const pct  = Math.round((t.hours / maxH) * 100);
                        return (
                          <div key={t.name}>
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-xs text-gray-700 truncate max-w-[200px]">{t.name}</span>
                              <div className="flex items-center gap-2 shrink-0 ml-2">
                                <span className="text-xs text-gray-500">{fmtH(t.hours)}</span>
                                {t.accuracy !== null && <span className={`text-xs font-semibold ${accColor(t.accuracy)}`}>{t.accuracy}%</span>}
                              </div>
                            </div>
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: BG }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Histórico */}
              <SessionHistoryCards sessions={data.sessionHistory} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
function accColor(a: number | null) {
  return a === null ? "text-gray-400" : a >= 70 ? "text-green-600" : a >= 50 ? "text-yellow-600" : "text-red-600";
}

export default function PainelPage() {
  const { data: session } = useSession();
  const [stats,           setStats]           = useState<Stats | null>(null);
  const [loading,         setLoading]         = useState(true);
  const [weekOffset,      setWeekOffset]      = useState(0);
  const [chartMode,       setChartMode]       = useState<"hours" | "questions">("hours");
  const [dotEditMode,     setDotEditMode]     = useState(false);
  const [pendingOverrides, setPendingOverrides] = useState<Record<string, "done" | "partial" | "none" | "auto">>({});
  const [savingOverrides,  setSavingOverrides]  = useState(false);
  const [modalSubject,    setModalSubject]    = useState<{ id: string; name: string } | null>(null);

  const saveDotOverride = (date: string, status: "done" | "partial" | "none" | "auto") => {
    setPendingOverrides(prev => ({ ...prev, [date]: status }));
    setStats(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        consistencyDots: prev.consistencyDots.map(dot => {
          if (dot.date !== date) return dot;
          const newStatus = status === "auto" ? dot.status : status as "done" | "partial" | "none";
          return { ...dot, status: newStatus, studied: newStatus !== "none" };
        }),
      };
    });
  };

  const finishDotEdit = async () => {
    setSavingOverrides(true);
    await Promise.all(
      Object.entries(pendingOverrides).map(([date, status]) =>
        fetch("/api/statistics", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date, status }),
        }).catch(console.error)
      )
    );
    const hasAuto = Object.values(pendingOverrides).some(s => s === "auto");
    if (hasAuto) {
      const newStats = await fetch("/api/statistics").then(r => r.json()).catch(() => null);
      if (newStats) setStats(newStats);
    }
    setPendingOverrides({});
    setSavingOverrides(false);
    setDotEditMode(false);
  };

  useEffect(() => {
    fetch("/api/statistics").then(r => r.json()).then(setStats).catch(console.error).finally(() => setLoading(false));
  }, []);

  const currentWeek     = stats?.weeksData?.find(w => w.weekOffset === weekOffset);
  const chartData       = currentWeek?.days ?? [];
  const weekLabel       = currentWeek ? `${fmtDate(currentWeek.startDate)} – ${fmtDate(currentWeek.endDate)}` : "";
  const maxWeekOffset   = (stats?.weeksData?.length ?? 1) - 1;
  const currentWeekData = stats?.weeksData?.find(w => w.weekOffset === 0);
  const weekTotalHours  = currentWeekData?.days.reduce((a, d) => a + d.hours, 0) ?? 0;
  const weekTotalQ      = currentWeekData?.days.reduce((a, d) => a + d.questions, 0) ?? 0;

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Header idêntico ao dashboard ── */}
      <div className="text-white px-8" style={{ backgroundColor: BG, minHeight: "124px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>Bem-vindo de volta,</p>
        <h1 className="text-3xl font-bold mt-0.5">{session?.user?.name ?? "Concurseiro"} 👋</h1>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">

        {/* ── KPIs topo ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Tempo de Estudo",    value: stats ? fmtH(stats.totalHours) : "—",     color: "text-gray-900", sub: undefined },
            { label: "Desempenho",         value: stats?.accuracy !== null && stats?.accuracy !== undefined ? `${stats.accuracy}%` : "—",
              sub: stats && stats.totalQuestions > 0 ? `${stats.totalQuestions} Exercícios · ${stats.totalCorrect} Acertos · ${stats.totalWrong} Erros` : "sem dados",
              color: stats?.accuracy !== null && stats?.accuracy !== undefined ? stats.accuracy >= 70 ? "text-green-600" : stats.accuracy >= 50 ? "text-yellow-600" : "text-red-600" : "text-gray-400" },
            { label: "Progresso no Edital", value: stats && stats.totalPdfs > 0 ? `${Math.round((stats.completedPdfs / stats.totalPdfs) * 100)}%` : "—",
              sub: stats ? `${stats.completedPdfs} concluídos · ${stats.totalPdfs - stats.completedPdfs} pendentes` : "", color: "text-gray-900" },
            { label: "Revisões Pendentes", value: String(stats?.pendingReviews ?? "—"),
              sub: stats?.lateReviews ? `${stats.lateReviews} atrasadas` : "em dia",
              color: (stats?.lateReviews ?? 0) > 0 ? "text-red-600" : "text-gray-900" },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{label}</p>
              {sub && <p className="text-xs text-gray-500 mb-1">{sub}</p>}
              <p className={`text-3xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* ── Constância ── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-500" />
              <h2 className="text-base font-semibold">Constância nos estudos</h2>
            </div>
            {stats && (
              <div className="flex items-center gap-4 text-sm flex-wrap">
                <span className="flex items-center gap-1.5 font-semibold text-orange-500">
                  <Flame className="w-4 h-4" />
                  {stats.streak === 1 ? "1 dia seguido" : `${stats.streak} dias seguidos`}
                </span>
                <span className="text-gray-400">{stats.studiedDays} de {stats.totalDays} dias estudados</span>
                <span className={`font-semibold ${stats.consistency >= 70 ? "text-green-600" : stats.consistency >= 40 ? "text-yellow-600" : "text-red-600"}`}>
                  {stats.consistency}% constância
                </span>
                <button
                  onClick={() => dotEditMode ? finishDotEdit() : setDotEditMode(true)}
                  disabled={savingOverrides}
                  className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${dotEditMode ? "bg-teal-100 text-teal-700" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
                  <Pencil className="w-3 h-3" />
                  {savingOverrides ? "Salvando..." : dotEditMode ? `Concluir edição${Object.keys(pendingOverrides).length > 0 ? ` (${Object.keys(pendingOverrides).length})` : ""}` : "Editar"}
                </button>
              </div>
            )}
          </div>

          {dotEditMode && (
            <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
              Clique em qualquer dia para ajustar o status manualmente.
            </div>
          )}

          <div className="grid gap-1.5"
            style={{ gridTemplateColumns: `repeat(${stats?.consistencyDots.length ?? 30}, minmax(0, 1fr))` }}>
            {stats?.consistencyDots.map((dot, i) => {
              const isFuture = dot.status === "future";
              const dayNum   = parseInt(dot.date.slice(8), 10);
              if (dotEditMode && !isFuture) {
                return (
                  <div key={i} className="relative group">
                    <div title={`${dot.date} — clique para alterar`}
                      className={`aspect-square rounded-md flex flex-col items-center justify-center cursor-pointer ring-2 ring-offset-1 ring-teal-400 ${dot.status === "done" ? "bg-green-500" : dot.status === "partial" ? "bg-yellow-400" : "bg-red-400"}`}>
                      <span className="text-white font-bold leading-none" style={{ fontSize: "clamp(7px, 1vw, 11px)" }}>{dayNum}</span>
                      {dot.status === "done"    && <CheckCircle className="w-2.5 h-2.5 text-white mt-0.5" />}
                      {dot.status === "partial" && <span className="text-white font-bold leading-none mt-0.5" style={{ fontSize: "8px" }}>~</span>}
                      {dot.status === "none"    && <span className="text-white font-bold leading-none mt-0.5" style={{ fontSize: "8px" }}>✕</span>}
                    </div>
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col gap-1 bg-white border border-gray-200 rounded-xl shadow-lg p-2 z-50 w-32 mb-1">
                      <p className="text-[10px] text-gray-400 font-medium mb-1 text-center">{dot.date.slice(5).replace("-", "/")}</p>
                      {(["done", "partial", "none", "auto"] as const).map(s => (
                        <button key={s} onClick={() => saveDotOverride(dot.date, s)}
                          className={`text-[11px] px-2 py-1 rounded-lg font-medium transition-colors ${s === "done" ? "bg-green-100 text-green-700 hover:bg-green-200" : s === "partial" ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200" : s === "none" ? "bg-red-100 text-red-700 hover:bg-red-200" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                          {s === "done" ? "✓ Concluído" : s === "partial" ? "~ Parcial" : s === "none" ? "✕ Não estudou" : "↻ Automático"}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              }
              return (
                <div key={i} title={dot.date}
                  className={`aspect-square rounded-md flex flex-col items-center justify-center ${isFuture ? "bg-gray-100 border border-gray-200" : dot.status === "done" ? "bg-green-500" : dot.status === "partial" ? "bg-yellow-400" : "bg-red-400"}`}>
                  <span className={`font-medium leading-none ${isFuture ? "text-gray-400" : "text-white"}`} style={{ fontSize: "clamp(7px, 1vw, 11px)" }}>{dayNum}</span>
                  {!isFuture && dot.status === "done"    && <CheckCircle className="w-2.5 h-2.5 text-white mt-0.5" />}
                  {!isFuture && dot.status === "partial" && <span className="text-white font-bold leading-none mt-0.5" style={{ fontSize: "8px" }}>~</span>}
                  {!isFuture && dot.status === "none"    && <span className="text-white font-bold leading-none mt-0.5" style={{ fontSize: "8px" }}>✕</span>}
                </div>
              );
            })}
            {!stats && Array.from({ length: 30 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-md bg-gray-100 animate-pulse" />
            ))}
          </div>
          <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-500 inline-block" /> Concluído</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-yellow-400 inline-block" /> Parcial</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-400 inline-block" /> Não estudou</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-gray-100 border border-gray-200 inline-block" /> Futuro</span>
          </div>
        </div>

        {/* ── Painel disciplinas + coluna direita ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Tabela disciplinas clicável */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-base font-semibold">Painel por Disciplina</h2>
              <span className="text-xs text-gray-400">Clique para ver detalhes</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                    <th className="text-left px-5 py-3 font-semibold">Disciplina</th>
                    <th className="text-right px-3 py-3 font-semibold">Tempo</th>
                    <th className="text-right px-3 py-3 font-semibold text-green-600">✓</th>
                    <th className="text-right px-3 py-3 font-semibold text-red-500">✗</th>
                    <th className="text-right px-3 py-3 font-semibold">Total</th>
                    <th className="text-right px-5 py-3 font-semibold">%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {stats?.subjectStats.map(s => (
                    <tr key={s.name}
                      onClick={() => setModalSubject({ id: s.id, name: s.name })}
                      className="hover:bg-teal-50 transition-colors cursor-pointer group">
                      <td className="px-5 py-3 font-medium group-hover:text-teal-700 transition-colors" style={{ color: BG }}>
                        <span className="flex items-center gap-1.5">
                          {s.name}
                          <svg className="w-3 h-3 opacity-30 group-hover:opacity-70 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right text-gray-600">{s.hours > 0 ? fmtH(s.hours) : <span className="text-gray-300">-</span>}</td>
                      <td className="px-3 py-3 text-right text-green-600 font-semibold">{s.correct > 0 ? s.correct : <span className="text-gray-300">0</span>}</td>
                      <td className="px-3 py-3 text-right text-red-500 font-semibold">{s.wrong > 0 ? s.wrong : <span className="text-gray-300">0</span>}</td>
                      <td className="px-3 py-3 text-right text-gray-600">{s.questions > 0 ? s.questions : <span className="text-gray-300">-</span>}</td>
                      <td className="px-5 py-3 text-right">
                        {s.accuracy !== null ? (
                          <span className={`font-bold text-xs px-2 py-0.5 rounded-full ${s.accuracy >= 70 ? "bg-green-100 text-green-700" : s.accuracy >= 50 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>{s.accuracy}%</span>
                        ) : <span className="text-gray-300 text-xs">-</span>}
                      </td>
                    </tr>
                  ))}
                  {!stats && Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>{Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-3 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                    ))}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Coluna direita */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-4">Metas de Estudo Semanal</h2>
              {!stats ? (
                <div className="space-y-3">{[1,2].map(i=><div key={i} className="h-6 bg-gray-100 rounded animate-pulse"/>)}</div>
              ) : (
                <MetasSemanal weekTotalHours={weekTotalHours} weekTotalQ={weekTotalQ} weeklyGoalHours={stats.weeklyGoalHours ?? 0} userId={session?.user?.id ?? undefined} />
              )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Estudo Semanal</h2>
                <div className="flex items-center gap-1">
                  <button onClick={() => setWeekOffset(w => Math.min(w + 1, maxWeekOffset))} disabled={weekOffset >= maxWeekOffset} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 transition-colors">
                    <ChevronLeft className="w-3.5 h-3.5 text-gray-500" />
                  </button>
                  <span className="text-xs text-gray-500 min-w-[80px] text-center">{weekLabel}</span>
                  <button onClick={() => setWeekOffset(w => Math.max(w - 1, 0))} disabled={weekOffset === 0} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 transition-colors">
                    <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
                  </button>
                </div>
              </div>
              <div className="flex gap-2 mb-3">
                {(["hours","questions"] as const).map(m => (
                  <button key={m} onClick={() => setChartMode(m)}
                    className="px-3 py-1 rounded-lg text-xs font-semibold transition-colors"
                    style={chartMode === m ? { backgroundColor: m === "hours" ? BG : "#10B981", color: "#fff" } : { backgroundColor: "#F3F4F6", color: "#6B7280" }}>
                    {m === "hours" ? "Tempo" : "Questões"}
                  </button>
                ))}
              </div>
              {chartData.length > 0 ? (
                chartMode === "hours" ? (
                  <ResponsiveContainer width="100%" height={170}>
                    <BarChart data={chartData} margin={{ top: 22, right: 0, left: -30, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                      <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} domain={[0, (max: number) => Math.ceil(max * 1.2)]} />
                      <Tooltip formatter={(v: number) => [`${v.toFixed(1)}h`, "Horas"]} />
                      <Bar dataKey="hours" radius={[3,3,0,0] as [number,number,number,number]} fill={BG} maxBarSize={40}
                        label={{ position: "top", fontSize: 9, fill: "#6B7280", formatter: (v: number) => v > 0 ? `${v.toFixed(1)}h` : "" }} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <ResponsiveContainer width="100%" height={170}>
                    <BarChart data={chartData} margin={{ top: 22, right: 0, left: -30, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                      <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} domain={[0, (max: number) => Math.ceil(max * 1.2)]} />
                      <Tooltip formatter={(v: number, name: string) => [v, name === "correct" ? "Acertos" : "Erros"]} />
                      <Bar dataKey="correct" stackId="q" fill="#22c55e" name="correct" radius={[0,0,0,0] as [number,number,number,number]} />
                      <Bar dataKey="wrong"   stackId="q" fill="#ef4444" name="wrong"   radius={[3,3,0,0] as [number,number,number,number]}
                        label={{ position: "top", fontSize: 9, fill: "#6B7280", formatter: (_: number, __: string, props: any) => { const t = (props?.correct ?? 0) + (props?.wrong ?? 0); return t > 0 ? t : ""; }}} />
                    </BarChart>
                  </ResponsiveContainer>
                )
              ) : (
                <div className="h-36 flex items-center justify-center text-xs text-gray-400">Sem registros nesta semana</div>
              )}
              {chartMode === "questions" && (
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-500 inline-block" /> Acertos</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block" /> Erros</span>
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Estudos do Dia</h2>
                {stats && stats.todayHours > 0 && <span className="text-xs font-semibold" style={{ color: BG }}>{fmtH(stats.todayHours)}</span>}
              </div>
              {stats?.todayBySubject && stats.todayBySubject.length > 0 ? (
                <ResponsiveContainer width="100%" height={170}>
                  <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                    <Pie data={stats.todayBySubject} dataKey="hours" nameKey="name" cx="50%" cy="42%" innerRadius={42} outerRadius={62} paddingAngle={2}>
                      {stats.todayBySubject.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number, name: string) => [fmtH(v), name]} />
                    <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 10, paddingTop: 4 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-36 flex flex-col items-center justify-center text-center gap-2">
                  <BookOpen className="w-6 h-6 text-gray-200" />
                  <p className="text-xs text-gray-400">Nenhuma sessão hoje</p>
                  <Link href="/sessao" className="text-xs text-white px-3 py-1.5 rounded-lg" style={{ backgroundColor: BG }}>Iniciar sessão</Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Revisões pendentes ── */}
        {stats && stats.pendingReviews > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-blue-500" /> Revisões
              </h2>
              <Link href="/revisoes" className="text-xs text-blue-600 hover:underline">Ver todas</Link>
            </div>
            <div className="flex gap-4">
              {[
                { label: "Atrasadas", value: stats.lateReviews,                       color: "text-red-600"  },
                { label: "Pendentes", value: stats.pendingReviews - stats.lateReviews, color: "text-blue-600" },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-gray-50 rounded-xl px-5 py-3 text-center">
                  <p className="text-xs text-gray-400 mb-1">{label}</p>
                  <p className={`text-2xl font-bold ${color}`}>{value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Método Davi Lago ── */}
        <div className="text-white rounded-2xl p-6" style={{ backgroundColor: BG }}>
          <h2 className="text-base font-semibold mb-4">💡 Método de estudo — Davi Lago</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { title: "Leitura ativa",      desc: "Leia o PDF com atenção, anote dúvidas e marque os pontos principais." },
              { title: "Questões imediatas", desc: "Após cada tópico, resolva questões. Registre erros no Caderno de Erros." },
              { title: "Revisão espaçada",   desc: "Revise em 24h, 7 dias e 30 dias. O sistema agenda automaticamente." },
            ].map(tip => (
              <div key={tip.title} className="rounded-xl p-4" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
                <p className="font-semibold text-sm mb-1">{tip.title}</p>
                <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>{tip.desc}</p>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Modal por matéria */}
      {modalSubject && (
        <SubjectModal subjectId={modalSubject.id} subjectName={modalSubject.name} onClose={() => setModalSubject(null)} />
      )}
    </div>
  );
}
