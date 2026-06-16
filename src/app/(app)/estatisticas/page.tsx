"use client";
import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  CheckCircle, Flame, RefreshCw, BookOpen,
  ChevronLeft, ChevronRight, X, TrendingUp, Clock, FileText, AlertCircle,
} from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
} from "recharts";

const BG = "#1B4040";

interface WeekDay { day: string; date: string; hours: number; questions: number; correct: number; wrong: number; }
interface WeekData { weekOffset: number; startDate: string; endDate: string; days: WeekDay[]; }

interface Stats {
  totalHours:      number;
  totalQuestions:  number;
  totalCorrect:    number;
  totalWrong:      number;
  accuracy:        number | null;
  completedPdfs:   number;
  totalPdfs:       number;
  pendingErrors:   number;
  pendingReviews:  number;
  lateReviews:     number;
  streak:          number;
  studiedDays:     number;
  totalDays:       number;
  consistency:     number;
  consistencyDots: { date: string; studied: boolean; status: "done" | "partial" | "none" }[];
  todayHours:      number;
  todayQuestions:  number;
  todayBySubject:  { name: string; hours: number }[];
  subjectStats:    { id: string; name: string; hours: number; questions: number; correct: number; wrong: number; accuracy: number | null }[];
  weeklyHours:     { day: string; hours: number }[];
  weeksData:       WeekData[];
  weeklyGoalHours: number;
}

const PIE_COLORS = [BG,"#3B82F6","#10B981","#F59E0B","#EF4444","#8B5CF6","#EC4899","#14B8A6"];

function fmtH(h: number) {
  const hh = Math.floor(h); const mm = Math.round((h - hh) * 60);
  return mm > 0 ? `${hh}h${mm.toString().padStart(2,"0")}min` : `${hh}h`;
}
function fmtDate(ds: string) {
  const d = new Date(ds + "T12:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}


// Componente de Metas Semanais com meta de questões editável
function MetasSemanal({ weekTotalHours, weekTotalQ, weeklyGoalHours, userId }: {
  weekTotalHours:  number;
  weekTotalQ:      number;
  weeklyGoalHours: number;
  userId?:         string;
}) {
  const storageKey = userId ? `estudaai_meta_q_${userId}` : "estudaai_meta_q";
  const [metaQ,      setMetaQ]      = React.useState(150);
  const [editingQ,   setEditingQ]   = React.useState(false);
  const [inputQ,     setInputQ]     = React.useState("");

  // Carrega meta de questões do localStorage
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setMetaQ(parseInt(saved) || 150);
    } catch {}
  }, [storageKey]);

  const saveMetaQ = () => {
    const v = parseInt(inputQ);
    if (v > 0) {
      setMetaQ(v);
      try { localStorage.setItem(storageKey, String(v)); } catch {}
    }
    setEditingQ(false);
  };

  // weeklyGoalHours vem dos StudyBlocks — exatamente como configurado, sem arredondar
  const horasMeta = weeklyGoalHours;
  const pctHoras  = horasMeta > 0 ? Math.min(100, Math.round((weekTotalHours / horasMeta) * 100)) : 0;
  const pctQ     = Math.min(100, Math.round((weekTotalQ / metaQ) * 100));

  const Bar = ({ pct, color }: { pct: number; color: string }) => (
    <div className="relative h-5 bg-gray-100 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all flex items-center justify-end pr-2"
        style={{ width: `${Math.max(pct, 8)}%`, backgroundColor: color }}>
        {pct >= 15 && <span className="text-white text-[10px] font-bold">{pct}%</span>}
      </div>
      {pct < 15 && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 text-[10px] font-bold">{pct}%</span>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1.5">
          <span className="font-medium">Horas de Estudo</span>
          <span className="font-semibold text-gray-700">
            {fmtH(weekTotalHours)}{horasMeta > 0 ? ` / ${fmtH(horasMeta)}` : ""}
          </span>
        </div>
        <Bar pct={pctHoras} color={BG} />
      </div>
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1.5">
          <span className="font-medium">Questões</span>
          <div className="flex items-center gap-1.5">
            {editingQ ? (
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  type="number" min="1" value={inputQ}
                  onChange={e => setInputQ(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") saveMetaQ(); if (e.key === "Escape") setEditingQ(false); }}
                  className="w-16 text-center text-xs border border-gray-300 rounded-lg px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  placeholder={String(metaQ)}
                />
                <button onClick={saveMetaQ}
                  className="text-[10px] text-white px-1.5 py-0.5 rounded bg-gray-900 font-bold">✓</button>
                <button onClick={() => setEditingQ(false)}
                  className="text-[10px] text-gray-400 hover:text-gray-600">✕</button>
              </div>
            ) : (
              <>
                <span className="font-semibold text-gray-700">{weekTotalQ} / {metaQ}</span>
                <button onClick={() => { setInputQ(String(metaQ)); setEditingQ(true); }}
                  title="Editar meta de questões"
                  className="text-gray-300 hover:text-gray-500 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>
        <Bar pct={pctQ} color="#8B5CF6" />
      </div>
    </div>
  );
}


const ERROR_COLORS: Record<string, string> = {
  desatencao: "#BA7517", nao_estudei: "#185FA5", nao_lembrei: "#534AB7",
  confundi_conceitos: "#E24B4A", interpretacao: "#1D9E75", pegadinha: "#D85A30",
  outro: "#888780", decoreba: "#9333ea",
};

interface SubjectDetail {
  subjectName: string; totalHours: number; totalQuestions: number;
  totalCorrect: number; totalWrong: number; accuracy: number | null;
  pendingErrors: number; totalErrors: number; totalSessions: number;
  byPdf:   { title: string; hours: number; pages: number; questions: number; correct: number; accuracy: number | null }[];
  byTopic: { name: string; hours: number; questions: number; accuracy: number | null }[];
  weeklyEvolution: { label: string; correct: number; wrong: number; hours: number }[];
  errorDistribution: { type: string; label: string; count: number }[];
  sessionHistory: { id: string; date: string; hours: number; questions: number; correct: number; wrong: number; accuracy: number | null; pdfTitle: string; topicName: string }[];
}

function PdfQuestionsChart({ byPdf }: { byPdf: { title: string; questions: number; correct: number; pages: number; hours: number; accuracy: number | null }[] }) {
  const pdfQData = byPdf
    .filter(p => p.questions > 0)
    .map(p => ({
      title:   p.title,
      acertos: p.correct,
      erros:   Math.max(0, p.questions - p.correct),
    }));
  if (pdfQData.length === 0) {
    return <p className="text-xs text-gray-400 text-center py-4">Nenhuma questão registrada por PDF.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={Math.max(pdfQData.length * 44 + 20, 120)}>
      <BarChart data={pdfQData} layout="vertical" margin={{ top: 0, right: 36, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 10 }} />
        <YAxis type="category" dataKey="title" width={90} tick={{ fontSize: 10 }} />
        <Tooltip formatter={(v: number, name: string) => [v, name]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        <Bar dataKey="acertos" fill="#1D9E75" radius={[0,0,0,0] as [number,number,number,number]} name="Acertos" stackId="q" />
        <Bar dataKey="erros"   fill="#E24B4A" radius={[0,4,4,0] as [number,number,number,number]} name="Erros"   stackId="q" />
      </BarChart>
    </ResponsiveContainer>
  );
}

function SubjectModal({ subjectId, subjectName, onClose }: { subjectId: string; subjectName: string; onClose: () => void }) {
  const [period, setPeriod] = React.useState(30);
  const [data, setData] = React.useState<SubjectDetail | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    setLoading(true);
    fetch(`/api/statistics/subject?subjectId=${subjectId}&period=${period}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [subjectId, period]);

  const fmtAcc = (a: number | null) => a !== null ? `${a}%` : "-";
  const accColor = (a: number | null) => a === null ? "text-gray-400" : a >= 70 ? "text-green-600" : a >= 50 ? "text-yellow-600" : "text-red-600";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-6 pb-6 px-4" style={{ backgroundColor: "rgba(0,0,0,0.55)" }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 rounded-t-2xl shrink-0" style={{ backgroundColor: BG }}>
          <div>
            <p className="text-xs font-medium uppercase tracking-widest mb-1" style={{ color: "#9FE1CB" }}>Estatísticas detalhadas</p>
            <h2 className="text-xl font-bold text-white">{subjectName}</h2>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={period}
              onChange={e => setPeriod(Number(e.target.value))}
              className="text-sm rounded-xl px-3 py-2 border-0 focus:outline-none focus:ring-2 focus:ring-white/30"
              style={{ backgroundColor: "rgba(255,255,255,0.12)", color: "#fff" }}>
              <option value={30} style={{ color: "#000" }}>Últimos 30 dias</option>
              <option value={90} style={{ color: "#000" }}>Últimos 90 dias</option>
              <option value={0}  style={{ color: "#000" }}>Todo o período</option>
            </select>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 transition-colors text-white">
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

          {!loading && data && (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { icon: Clock,       label: "Tempo total",        value: fmtH(data.totalHours),          sub: `${data.totalSessions} sessões` },
                  { icon: TrendingUp,  label: "Questões",           value: String(data.totalQuestions),    sub: `${fmtAcc(data.accuracy)} de acerto` },
                  { icon: FileText,    label: "Páginas lidas",      value: String(data.byPdf.reduce((a,p)=>a+p.pages,0)||"-"), sub: `${data.byPdf.length} PDFs` },
                  { icon: AlertCircle, label: "Erros no caderno",   value: String(data.totalErrors),       sub: `${data.pendingErrors} pendentes` },
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
                <h3 className="text-sm font-semibold text-gray-700 mb-1">Evolução — acertos e erros por semana</h3>
                <div className="flex gap-4 mb-3">
                  <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-3 h-0.5 bg-green-500 inline-block rounded" />Acertos</span>
                  <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-3 h-0.5 inline-block rounded" style={{ backgroundColor: "#E24B4A" }} />Erros</span>
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

              {/* Tempo por PDF + Páginas por PDF */}
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
                        <Bar dataKey="hours" fill={BG} radius={[0, 4, 4, 0]} name="Horas" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>

                <div className="bg-white rounded-2xl border border-gray-200 p-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Questões por PDF</h3>
                    <PdfQuestionsChart byPdf={data.byPdf} />
                </div>
              </div>

              {/* Distribuição de erros + Tópicos */}
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
                            {data.errorDistribution.map(e => (
                              <Cell key={e.type} fill={ERROR_COLORS[e.type] ?? "#888"} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v: number, name: string) => [v, name]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
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
                        const maxH = Math.max(...data.byTopic.map(x=>x.hours), 0.1);
                        const pct  = Math.round((t.hours / maxH) * 100);
                        return (
                          <div key={t.name}>
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-xs text-gray-700 truncate max-w-[200px]">{t.name}</span>
                              <div className="flex items-center gap-2 shrink-0 ml-2">
                                <span className="text-xs text-gray-500">{fmtH(t.hours)}</span>
                                {t.accuracy !== null && (
                                  <span className={`text-xs font-semibold ${accColor(t.accuracy)}`}>{t.accuracy}%</span>
                                )}
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

              {/* Histórico de sessões */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-700">Histórico de sessões</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                        <th className="text-left px-5 py-3 font-semibold">Data</th>
                        <th className="text-left px-3 py-3 font-semibold">PDF / Tópico</th>
                        <th className="text-right px-3 py-3 font-semibold">Tempo</th>
                        <th className="text-right px-3 py-3 font-semibold text-green-600">✓</th>
                        <th className="text-right px-3 py-3 font-semibold text-red-500">✗</th>
                        <th className="text-right px-5 py-3 font-semibold">%</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {data.sessionHistory.map(s => (
                        <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-5 py-3 text-gray-500 text-xs whitespace-nowrap">
                            {new Date(s.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                          </td>
                          <td className="px-3 py-3">
                            <p className="font-medium text-gray-800 text-xs truncate max-w-[200px]">{s.pdfTitle || "—"}</p>
                            {s.topicName && <p className="text-xs text-gray-400 truncate max-w-[200px]">{s.topicName}</p>}
                          </td>
                          <td className="px-3 py-3 text-right text-gray-600 text-xs">{s.hours > 0 ? fmtH(s.hours) : "-"}</td>
                          <td className="px-3 py-3 text-right text-green-600 font-semibold text-xs">{s.correct > 0 ? s.correct : <span className="text-gray-300">0</span>}</td>
                          <td className="px-3 py-3 text-right text-red-500 font-semibold text-xs">{s.wrong > 0 ? s.wrong : <span className="text-gray-300">0</span>}</td>
                          <td className="px-5 py-3 text-right">
                            {s.accuracy !== null ? (
                              <span className={`font-bold text-xs px-2 py-0.5 rounded-full ${
                                s.accuracy >= 70 ? "bg-green-100 text-green-700"
                                : s.accuracy >= 50 ? "bg-yellow-100 text-yellow-700"
                                : "bg-red-100 text-red-700"
                              }`}>{s.accuracy}%</span>
                            ) : <span className="text-gray-300 text-xs">-</span>}
                          </td>
                        </tr>
                      ))}
                      {data.sessionHistory.length === 0 && (
                        <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400 text-sm">Nenhuma sessão no período selecionado.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [stats,      setStats]      = useState<Stats | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const [chartMode,  setChartMode]  = useState<"hours" | "questions">("hours");
  const [modalSubject, setModalSubject] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    fetch("/api/statistics")
      .then(r => r.json())
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const currentWeek   = stats?.weeksData?.find(w => w.weekOffset === weekOffset);
  const chartData     = currentWeek?.days ?? [];
  const weekLabel     = currentWeek ? `${fmtDate(currentWeek.startDate)} – ${fmtDate(currentWeek.endDate)}` : "";
  const maxWeekOffset = (stats?.weeksData?.length ?? 1) - 1;

  // Metas semanais — soma da semana atual (weekOffset=0)
  const currentWeekData = stats?.weeksData?.find(w => w.weekOffset === 0);
  const weekTotalHours  = currentWeekData?.days.reduce((a, d) => a + d.hours, 0) ?? 0;
  const weekTotalQ      = currentWeekData?.days.reduce((a, d) => a + d.questions, 0) ?? 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div
        className="text-white px-8"
        style={{ backgroundColor: BG, minHeight: "124px", display: "flex", flexDirection: "column", justifyContent: "center" }}
      >
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>Bem-vindo de volta,</p>
        <h1 className="text-3xl font-bold mt-0.5">{session?.user?.name ?? "Concurseiro"} 👋</h1>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">

        {/* ── KPIs topo ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              label: "Tempo de Estudo",
              value: stats ? fmtH(stats.totalHours) : "—",
              color: "text-gray-900",
            },
            {
              label: "Desempenho",
              sub:   stats && stats.totalQuestions > 0
                ? `${stats.totalCorrect} Acertos · ${stats.totalWrong} Erros`
                : "sem dados",
              value: stats?.accuracy !== null && stats?.accuracy !== undefined
                ? `${stats.accuracy}%` : "—",
              color: stats?.accuracy !== null && stats?.accuracy !== undefined
                ? stats.accuracy >= 70 ? "text-green-600"
                  : stats.accuracy >= 50 ? "text-yellow-600"
                  : "text-red-600"
                : "text-gray-400",
            },
            {
              label: "Progresso no Edital",
              sub:   stats ? `${stats.completedPdfs} concluídos · ${stats.totalPdfs - stats.completedPdfs} pendentes` : "",
              value: stats && stats.totalPdfs > 0
                ? `${Math.round((stats.completedPdfs / stats.totalPdfs) * 100)}%` : "—",
              color: "text-gray-900",
            },
            {
              label: "Revisões Pendentes",
              value: stats?.pendingReviews ?? "—",
              sub:   stats?.lateReviews ? `${stats.lateReviews} atrasadas` : "em dia",
              color: (stats?.lateReviews ?? 0) > 0 ? "text-red-600" : "text-gray-900",
            },
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
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {stats?.consistencyDots.map((dot, i) => {
              const isFuture = dot.date > new Date().toISOString().slice(0,10);
              return (
                <div key={i} title={dot.date}
                  className={`w-6 h-6 rounded-md flex items-center justify-center ${
                    isFuture              ? "bg-gray-100"
                    : dot.status === "done"    ? "bg-green-500"
                    : dot.status === "partial" ? "bg-yellow-400"
                    : "bg-red-400"
                  }`}>
                  {dot.status === "done" && <CheckCircle className="w-3.5 h-3.5 text-white" />}
                  {dot.status === "partial" && <span className="text-white font-bold text-[10px]">~</span>}
                  {dot.status === "none" && !isFuture && <span className="text-white font-bold text-[10px]">✕</span>}
                </div>
              );
            })}
            {!stats && Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="w-6 h-6 rounded-md bg-gray-100 animate-pulse" />
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

          {/* Tabela disciplinas */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold">Painel por Disciplina</h2>
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
                    <tr key={s.name} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setModalSubject({ id: s.id, name: s.name })}>
                      <td className="px-5 py-3 font-medium flex items-center gap-1.5" style={{ color: BG }}>
                        {s.name}
                        <TrendingUp className="w-3 h-3 opacity-40" />
                      </td>
                      <td className="px-3 py-3 text-right text-gray-600">
                        {s.hours > 0 ? fmtH(s.hours) : <span className="text-gray-300">-</span>}
                      </td>
                      <td className="px-3 py-3 text-right text-green-600 font-semibold">
                        {s.correct > 0 ? s.correct : <span className="text-gray-300">0</span>}
                      </td>
                      <td className="px-3 py-3 text-right text-red-500 font-semibold">
                        {s.wrong > 0 ? s.wrong : <span className="text-gray-300">0</span>}
                      </td>
                      <td className="px-3 py-3 text-right text-gray-600">
                        {s.questions > 0 ? s.questions : <span className="text-gray-300">-</span>}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {s.accuracy !== null ? (
                          <span className={`font-bold text-xs px-2 py-0.5 rounded-full ${
                            s.accuracy >= 70 ? "bg-green-100 text-green-700"
                            : s.accuracy >= 50 ? "bg-yellow-100 text-yellow-700"
                            : "bg-red-100 text-red-700"
                          }`}>{s.accuracy}%</span>
                        ) : <span className="text-gray-300 text-xs">-</span>}
                      </td>
                    </tr>
                  ))}
                  {!stats && Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-3 py-3">
                          <div className="h-4 bg-gray-100 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Coluna direita */}
          <div className="space-y-4">

            {/* Metas semanal — calculadas da semana atual */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-4">Metas de Estudo Semanal</h2>
              {!stats ? (
                <div className="space-y-3">
                  {[1,2].map(i => <div key={i} className="h-6 bg-gray-100 rounded animate-pulse" />)}
                </div>
              ) : (
                <MetasSemanal weekTotalHours={weekTotalHours} weekTotalQ={weekTotalQ} weeklyGoalHours={stats.weeklyGoalHours ?? 0} userId={session?.user?.id ?? undefined} />
              )}
            </div>

            {/* Gráfico semanal com acertos/erros empilhados */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Estudo Semanal</h2>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setWeekOffset(w => Math.min(w + 1, maxWeekOffset))}
                    disabled={weekOffset >= maxWeekOffset}
                    className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5 text-gray-500" />
                  </button>
                  <span className="text-xs text-gray-500 min-w-[80px] text-center">{weekLabel}</span>
                  <button
                    onClick={() => setWeekOffset(w => Math.max(w - 1, 0))}
                    disabled={weekOffset === 0}
                    className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 transition-colors"
                  >
                    <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
                  </button>
                </div>
              </div>

              {/* Botões Tempo / Questões */}
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setChartMode("hours")}
                  className="px-3 py-1 rounded-lg text-xs font-semibold transition-colors"
                  style={chartMode === "hours"
                    ? { backgroundColor: BG, color: "#fff" }
                    : { backgroundColor: "#F3F4F6", color: "#6B7280" }}
                >
                  Tempo
                </button>
                <button
                  onClick={() => setChartMode("questions")}
                  className="px-3 py-1 rounded-lg text-xs font-semibold transition-colors"
                  style={chartMode === "questions"
                    ? { backgroundColor: "#10B981", color: "#fff" }
                    : { backgroundColor: "#F3F4F6", color: "#6B7280" }}
                >
                  Questões
                </button>
              </div>

              {chartData.length > 0 ? (
                chartMode === "hours" ? (
                  // Modo Tempo — barra simples
                  <ResponsiveContainer width="100%" height={140}>
                    <BarChart data={chartData} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                      <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => [`${v.toFixed(1)}h`, "Horas"]} />
                      <Bar dataKey="hours" radius={[3,3,0,0]} fill={BG}
                        label={{ position: "top", fontSize: 9, fill: "#6B7280",
                          formatter: (v: number) => v > 0 ? `${v.toFixed(1)}h` : "" }} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  // Modo Questões — barras empilhadas: acertos (verde) + erros (vermelho)
                  <ResponsiveContainer width="100%" height={140}>
                    <BarChart data={chartData} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                      <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip
                        formatter={(v: number, name: string) => [
                          v,
                          name === "correct" ? "Acertos" : name === "wrong" ? "Erros" : "Questões",
                        ]}
                      />
                      <Bar dataKey="correct" stackId="q" fill="#22c55e" name="correct"
                        radius={[0,0,0,0]} />
                      <Bar dataKey="wrong" stackId="q" fill="#ef4444" name="wrong"
                        radius={[3,3,0,0]}
                        label={{ position: "top", fontSize: 9, fill: "#6B7280",
                          formatter: (_: number, __: string, props: any) => {
                            const total = (props?.correct ?? 0) + (props?.wrong ?? 0);
                            return total > 0 ? total : "";
                          }}} />
                    </BarChart>
                  </ResponsiveContainer>
                )
              ) : (
                <div className="h-36 flex items-center justify-center text-xs text-gray-400">
                  Sem registros nesta semana
                </div>
              )}

              {/* Legenda do gráfico de questões */}
              {chartMode === "questions" && (
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-500 inline-block" /> Acertos</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block" /> Erros</span>
                </div>
              )}
            </div>

            {/* Estudos do dia */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Estudos do Dia</h2>
                {stats && stats.todayHours > 0 && (
                  <span className="text-xs font-semibold" style={{ color: BG }}>{fmtH(stats.todayHours)}</span>
                )}
              </div>
              {stats?.todayBySubject && stats.todayBySubject.length > 0 ? (
                <ResponsiveContainer width="100%" height={170}>
                  <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                    <Pie
                      data={stats.todayBySubject}
                      dataKey="hours"
                      nameKey="name"
                      cx="50%"
                      cy="42%"
                      innerRadius={42}
                      outerRadius={62}
                      paddingAngle={2}
                    >
                      {stats.todayBySubject.map((entry, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number, name: string) => [fmtH(v), name]}
                    />
                    <Legend
                      iconSize={8}
                      iconType="circle"
                      wrapperStyle={{ fontSize: 10, paddingTop: 4 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-36 flex flex-col items-center justify-center text-center gap-2">
                  <BookOpen className="w-6 h-6 text-gray-200" />
                  <p className="text-xs text-gray-400">Nenhuma sessão hoje</p>
                  <Link href="/sessao"
                    className="text-xs text-white px-3 py-1.5 rounded-lg"
                    style={{ backgroundColor: BG }}>
                    Iniciar sessão
                  </Link>
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
                <RefreshCw className="w-4 h-4 text-blue-500" />
                Revisões
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

      {modalSubject && (
        <SubjectModal
          subjectId={modalSubject.id}
          subjectName={modalSubject.name}
          onClose={() => setModalSubject(null)}
        />
      )}
    </div>
  );
}
