"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Clock, Target, CheckCircle, XCircle,
  Flame, TrendingUp, RefreshCw, AlertCircle, BookOpen,
} from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
         BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

const BG = "#1B4040";

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
  consistencyDots: { date: string; studied: boolean }[];
  todayHours:      number;
  todayQuestions:  number;
  todayBySubject:  { name: string; hours: number }[];
  subjectStats:    { name: string; hours: number; questions: number; correct: number; wrong: number; accuracy: number | null }[];
  weeklyHours:     { day: string; hours: number }[];
  weekStats?: { hours: number; targetHours: number; questions: number };
}

const PIE_COLORS = [BG,"#3B82F6","#10B981","#F59E0B","#EF4444","#8B5CF6","#EC4899","#14B8A6"];

function fmtH(h: number) {
  const hh = Math.floor(h); const mm = Math.round((h - hh) * 60);
  return mm > 0 ? `${hh}h${mm.toString().padStart(2,"0")}min` : `${hh}h`;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [stats,   setStats]   = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/statistics").then(r => r.json()).then(setStats).catch(console.error).finally(() => setLoading(false));
  }, []);

  const hasStudyData = (stats?.totalHours ?? 0) > 0;

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

        {/* ── KPIs topo — estilo Estudei ── */}
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
                ? `${stats.accuracy}%`
                : "—",
              color: stats?.accuracy !== null && stats?.accuracy !== undefined
                ? stats.accuracy >= 70 ? "text-green-600"
                  : stats.accuracy >= 50 ? "text-yellow-600"
                  : "text-red-600"
                : "text-gray-400",
            },
            {
              label: "Progresso no Edital",
              sub:   stats
                ? `${stats.completedPdfs} PDFs concluídos · ${stats.totalPdfs - stats.completedPdfs} pendentes`
                : "",
              value: stats && stats.totalPdfs > 0
                ? `${Math.round((stats.completedPdfs / stats.totalPdfs) * 100)}%`
                : "—",
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
            {stats?.consistencyDots.map((dot, i) => (
              <div key={i} title={dot.date}
                className={`w-6 h-6 rounded-md flex items-center justify-center ${dot.studied ? "bg-green-500" : "bg-gray-100"}`}>
                {dot.studied && <CheckCircle className="w-3.5 h-3.5 text-white" />}
              </div>
            ))}
            {!stats && Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="w-6 h-6 rounded-md bg-gray-100 animate-pulse" />
            ))}
          </div>
          <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-500 inline-block" /> Estudou</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-gray-100 border border-gray-200 inline-block" /> Não estudou</span>
          </div>
        </div>

        {/* ── Painel disciplinas + Estudos do dia ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Painel disciplinas — estilo tabela do Estudei */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
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
                    <tr key={s.name} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 font-medium" style={{ color: BG }}>{s.name}</td>
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

            {/* Metas de estudo semanal */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Metas de Estudo Semanal</h2>
              </div>
              {stats ? (
                <div className="space-y-3">
                  {stats.weeklyHours.some(w => w.hours > 0) ? (
                    <>
                      <div>
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Horas</span>
                          <span>{fmtH(stats.weeklyHours.reduce((a, w) => a + w.hours, 0))}</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{
                            width: `${Math.min(100, (stats.weeklyHours.reduce((a, w) => a + w.hours, 0) / 20) * 100)}%`,
                            backgroundColor: BG,
                          }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Questões</span>
                          <span>{stats.weeklyHours.length > 0 ? stats.totalQuestions : 0}</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-purple-500" style={{
                            width: `${Math.min(100, (stats.totalQuestions / 300) * 100)}%`,
                          }} />
                        </div>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-gray-400 text-center py-3">Sem dados esta semana</p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {[1, 2].map(i => <div key={i} className="h-6 bg-gray-100 rounded animate-pulse" />)}
                </div>
              )}
            </div>

            {/* Estudo semanal — gráfico de barras */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 mb-4">Estudo Semanal</h2>
              {stats?.weeklyHours.some(w => w.hours > 0) ? (
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={stats.weeklyHours} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: number) => [`${v.toFixed(1)}h`, "Horas"]} />
                    <Bar dataKey="hours" radius={[3,3,0,0]} fill={BG} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-36 flex items-center justify-center text-xs text-gray-400">
                  Sem registros esta semana
                </div>
              )}
            </div>

            {/* Estudos do dia */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Estudos do Dia</h2>
                {stats && stats.todayHours > 0 && (
                  <span className="text-xs font-semibold" style={{ color: BG }}>{fmtH(stats.todayHours)}</span>
                )}
              </div>
              {stats?.todayBySubject && stats.todayBySubject.length > 0 ? (
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie data={stats.todayBySubject} dataKey="hours" nameKey="name"
                      cx="50%" cy="50%" innerRadius={35} outerRadius={55} paddingAngle={3}>
                      {stats.todayBySubject.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => [`${fmtH(v)}`, "Horas"]} />
                    <Legend iconSize={8} />
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
                { label: "Atrasadas", value: stats.lateReviews,                              color: "text-red-600"  },
                { label: "Pendentes", value: stats.pendingReviews - stats.lateReviews,        color: "text-blue-600" },
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
    </div>
  );
}
