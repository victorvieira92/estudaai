"use client";
import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
  LineChart, Line,
} from "recharts";
import {
  X, TrendingUp, Clock, FileText, AlertCircle,
  ChevronLeft, ChevronRight, RefreshCw,
} from "lucide-react";

const BG = "#1B4040";

// ── Tipos ────────────────────────────────────────────────────────────────────
interface SubjectStat {
  id: string; name: string; hours: number; questions: number;
  correct: number; wrong: number; accuracy: number | null;
}

interface WeekDay { day: string; date: string; hours: number; questions: number; correct: number; wrong: number; }
interface WeekData { weekOffset: number; startDate: string; endDate: string; days: WeekDay[]; }

interface Stats {
  totalHours: number; totalQuestions: number; totalCorrect: number; totalWrong: number;
  accuracy: number | null; completedPdfs: number; totalPdfs: number;
  pendingErrors: number; pendingReviews: number; lateReviews: number;
  streak: number; studiedDays: number; totalDays: number; consistency: number;
  todayHours: number; todayQuestions: number;
  subjectStats: SubjectStat[];
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
  sessionHistory: { id: string; date: string; hours: number; questions: number; correct: number; wrong: number; accuracy: number | null; pdfTitle: string; topicName: string }[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtH(h: number) {
  const hh = Math.floor(h); const mm = Math.round((h - hh) * 60);
  return mm > 0 ? `${hh}h${mm.toString().padStart(2, "0")}min` : `${hh}h`;
}

const ERROR_COLORS: Record<string, string> = {
  desatencao: "#BA7517", nao_estudei: "#185FA5", nao_lembrei: "#534AB7",
  confundi_conceitos: "#E24B4A", interpretacao: "#1D9E75", pegadinha: "#D85A30",
  outro: "#888780", decoreba: "#9333ea",
};

// ── Componente gráfico de questões por PDF (acertos/erros empilhados) ────────
function PdfQuestionsChart({ byPdf }: {
  byPdf: { title: string; questions: number; correct: number; pages: number; hours: number; accuracy: number | null }[]
}) {
  const data = byPdf
    .filter(p => p.questions > 0)
    .map(p => ({ title: p.title, acertos: p.correct, erros: Math.max(0, p.questions - p.correct) }));
  if (!data.length) return <p className="text-xs text-gray-400 text-center py-4">Nenhuma questão registrada por PDF.</p>;
  return (
    <ResponsiveContainer width="100%" height={Math.max(data.length * 44 + 20, 120)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 36, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 10 }} />
        <YAxis type="category" dataKey="title" width={90} tick={{ fontSize: 10 }} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
        <Bar dataKey="acertos" fill="#1D9E75" name="Acertos" stackId="q" />
        <Bar dataKey="erros"   fill="#E24B4A" name="Erros"   stackId="q" radius={[0, 4, 4, 0] as [number,number,number,number]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Modal de estatísticas por matéria ────────────────────────────────────────
function SubjectModal({ subjectId, subjectName, onClose }: {
  subjectId: string; subjectName: string; onClose: () => void;
}) {
  const [period, setPeriod] = useState(30);
  const [data, setData]     = useState<SubjectDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/statistics/subject?subjectId=${subjectId}&period=${period}`)
      .then(r => r.json()).then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [subjectId, period]);

  const accColor = (a: number | null) =>
    a === null ? "text-gray-400" : a >= 70 ? "text-green-600" : a >= 50 ? "text-yellow-600" : "text-red-600";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-6 pb-6 px-4"
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

          {!loading && data && (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { icon: Clock,        label: "Tempo total",      value: fmtH(data.totalHours),       sub: `${data.totalSessions} sessões` },
                  { icon: TrendingUp,   label: "Questões",         value: String(data.totalQuestions),  sub: data.accuracy !== null ? `${data.accuracy}% de acerto` : "sem questões" },
                  { icon: FileText,     label: "Páginas lidas",    value: String((data.byPdf ?? []).reduce((a,p)=>a+p.pages,0)||"—"), sub: `${(data.byPdf ?? []).length} PDFs` },
                  { icon: AlertCircle,  label: "Erros no caderno", value: String(data.totalErrors),     sub: `${data.pendingErrors} pendentes` },
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
                  <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-3 h-0.5 bg-green-500 inline-block rounded" />Acertos</span>
                  <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-3 h-0.5 bg-red-400 inline-block rounded" style={{ backgroundImage: "repeating-linear-gradient(to right,#f87171 0,#f87171 4px,transparent 4px,transparent 7px)" }} />Erros</span>
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
                        <Bar dataKey="hours" fill={BG} radius={[0, 4, 4, 0] as [number,number,number,number]} name="Horas" />
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
                            {data.errorDistribution.map(e => (
                              <Cell key={e.type} fill={ERROR_COLORS[e.type] ?? "#888"} />
                            ))}
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

// ── Componente de metas semanais ──────────────────────────────────────────────
function MetasSemanal({ weekTotalHours, weekTotalQ, weeklyGoalHours, userId }: {
  weekTotalHours: number; weekTotalQ: number; weeklyGoalHours: number; userId?: string;
}) {
  const storageKey = userId ? `estudaai_meta_q_${userId}` : "estudaai_meta_q";
  const [metaQ,    setMetaQ]    = useState(150);
  const [editingQ, setEditingQ] = useState(false);
  const [inputQ,   setInputQ]   = useState("");

  useEffect(() => {
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

// ── Página principal ──────────────────────────────────────────────────────────
const PIE_COLORS = [BG,"#3B82F6","#10B981","#F59E0B","#EF4444","#8B5CF6","#EC4899","#14B8A6"];

export default function EstatisticasPage() {
  const { data: session } = useSession();
  const [stats,      setStats]      = useState<Stats | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const [chartMode,  setChartMode]  = useState<"hours" | "questions">("hours");
  const [modalSubject, setModalSubject] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    fetch("/api/statistics").then(r => r.json()).then(d => { setStats(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const currentWeek = stats?.weeksData?.find(w => w.weekOffset === weekOffset);
  const weekTotalHours = currentWeek?.days.reduce((a, d) => a + d.hours, 0) ?? 0;
  const weekTotalQ     = currentWeek?.days.reduce((a, d) => a + d.questions, 0) ?? 0;

  const weekBarData = currentWeek?.days.map(d => ({
    day: d.day,
    horas: parseFloat(d.hours.toFixed(2)),
    questoes: d.questions,
    acertos: d.correct,
    erros: d.wrong,
  })) ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Cabeçalho */}
      <div className="text-white px-8" style={{ backgroundColor: BG, minHeight: "124px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <h1 className="text-3xl font-bold">Estatísticas</h1>
        <p className="text-gray-400 text-sm mt-1">Acompanhe seu desempenho detalhado</p>
      </div>

      <div className="px-8 py-8 space-y-6">

        {/* ── KPIs globais ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {loading ? Array.from({length:4}).map((_,i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-200 p-6 h-28 animate-pulse" />
          )) : [
            { label: "Tempo total",        value: fmtH(stats?.totalHours ?? 0),                            sub: `${stats?.subjectStats?.length ?? 0} disciplinas` },
            { label: "Questões resolvidas", value: String(stats?.totalQuestions ?? 0),                     sub: stats?.accuracy !== null && stats?.accuracy !== undefined ? `${stats.accuracy}% de acerto` : "sem dados" },
            { label: "PDFs em progresso",   value: `${stats?.completedPdfs ?? 0} / ${stats?.totalPdfs ?? 0}`, sub: "concluídos" },
            { label: "Erros pendentes",     value: String(stats?.pendingErrors ?? 0),                      sub: `${stats?.lateReviews ?? 0} revisões atrasadas` },
          ].map(({ label, value, sub }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-200 p-6">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
              <p className="text-3xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-400 mt-1">{sub}</p>
            </div>
          ))}
        </div>

        {/* ── Painel por disciplina + coluna direita ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Tabela disciplinas */}
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
                          <span className={`font-bold text-xs px-2 py-0.5 rounded-full ${
                            s.accuracy >= 70 ? "bg-green-100 text-green-700"
                            : s.accuracy >= 50 ? "bg-yellow-100 text-yellow-700"
                            : "bg-red-100 text-red-700"}`}>{s.accuracy}%</span>
                        ) : <span className="text-gray-300 text-xs">-</span>}
                      </td>
                    </tr>
                  ))}
                  {loading && Array.from({length:5}).map((_,i) => (
                    <tr key={i}>{Array.from({length:6}).map((_,j) => (
                      <td key={j} className="px-3 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                    ))}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Coluna direita */}
          <div className="space-y-4">
            {/* Metas semanais */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-4">Metas de Estudo Semanal</h2>
              {!stats ? (
                <div className="space-y-3">{[1,2].map(i=><div key={i} className="h-6 bg-gray-100 rounded animate-pulse"/>)}</div>
              ) : (
                <MetasSemanal weekTotalHours={weekTotalHours} weekTotalQ={weekTotalQ} weeklyGoalHours={stats.weeklyGoalHours ?? 0} userId={session?.user?.id ?? undefined} />
              )}
            </div>

            {/* Gráfico semanal */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Estudo Semanal</h2>
                <div className="flex items-center gap-2">
                  <button onClick={() => setWeekOffset(p => p - 1)} className="p-1 hover:bg-gray-100 rounded transition-colors"><ChevronLeft className="w-4 h-4 text-gray-400" /></button>
                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    {currentWeek ? `${currentWeek.startDate} – ${currentWeek.endDate}` : "—"}
                  </span>
                  <button onClick={() => setWeekOffset(p => Math.min(0, p + 1))} disabled={weekOffset >= 0} className="p-1 hover:bg-gray-100 rounded transition-colors disabled:opacity-30"><ChevronRight className="w-4 h-4 text-gray-400" /></button>
                </div>
              </div>
              <div className="flex gap-1 mb-3">
                {(["hours","questions"] as const).map(m => (
                  <button key={m} onClick={() => setChartMode(m)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${chartMode === m ? "text-white" : "bg-gray-100 text-gray-500"}`}
                    style={chartMode === m ? { backgroundColor: BG } : {}}>
                    {m === "hours" ? "Tempo" : "Questões"}
                  </button>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={weekBarData} margin={{ top: 4, right: 0, left: -28, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => chartMode === "hours" ? `${v}h` : String(v)} />
                  <Tooltip formatter={(v: number) => chartMode === "hours" ? [`${v.toFixed(1)}h`, "Horas"] : [v, "Questões"]} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  {chartMode === "hours" ? (
                    <Bar dataKey="horas" fill={BG} radius={[4,4,0,0] as [number,number,number,number]} name="Horas" />
                  ) : (
                    <>
                      <Bar dataKey="acertos" fill="#10B981" radius={[0,0,0,0] as [number,number,number,number]} name="Acertos" stackId="q" />
                      <Bar dataKey="erros"   fill="#EF4444" radius={[4,4,0,0] as [number,number,number,number]} name="Erros"   stackId="q" />
                    </>
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Pizza por disciplina */}
            {stats && stats.subjectStats.some(s => s.hours > 0) && (
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Distribuição de tempo</h2>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={stats.subjectStats.filter(s => s.hours > 0)} dataKey="hours" nameKey="name" cx="50%" cy="50%" outerRadius={65} innerRadius={30}>
                      {stats.subjectStats.filter(s => s.hours > 0).map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => [fmtH(v), "Tempo"]} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                  {stats.subjectStats.filter(s => s.hours > 0).map((s, i) => (
                    <span key={s.name} className="flex items-center gap-1 text-[10px] text-gray-500">
                      <span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Método Davi Lago */}
            <div className="text-white rounded-2xl p-5" style={{ backgroundColor: BG }}>
              <h2 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "#9FE1CB" }}>Método de estudo — Davi Lago</h2>
              <div className="space-y-3">
                {[
                  { title: "Leitura ativa",      desc: "Leia o PDF com atenção, anote dúvidas e marque os pontos principais." },
                  { title: "Questões imediatas",  desc: "Após cada tópico, resolva questões. Registre erros no Caderno de Erros." },
                  { title: "Revisão espaçada",    desc: "Revise em 24h, 7 dias e 30 dias. O sistema agenda automaticamente." },
                ].map(tip => (
                  <div key={tip.title} className="rounded-xl p-3" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
                    <p className="font-semibold text-xs mb-1">{tip.title}</p>
                    <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.6)" }}>{tip.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal por matéria */}
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
