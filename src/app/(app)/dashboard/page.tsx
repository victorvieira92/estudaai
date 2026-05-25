"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Clock, Target, RefreshCw, AlertCircle,
  BookOpen, TrendingUp, Flame, CheckCircle,
} from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface Stats {
  totalHours:      number;
  totalQuestions:  number;
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
}

const PIE_COLORS = ["#111827","#3B82F6","#10B981","#F59E0B","#EF4444","#8B5CF6","#EC4899","#14B8A6"];

function fmt(h: number) {
  const hh = Math.floor(h); const mm = Math.round((h - hh) * 60);
  return mm > 0 ? `${hh}h${mm.toString().padStart(2,"0")}min` : `${hh}h`;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/statistics").then(r => r.json()).then(setStats).catch(console.error);
  }, []);

  const hasStudyData = (stats?.totalHours ?? 0) > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="text-white px-8 py-8" style={{ backgroundColor: "#1B4040" }}>
        <p className="text-gray-400 text-sm">Bem-vindo de volta,</p>
        <h1 className="text-3xl font-bold mt-1">{session?.user?.name ?? "Concurseiro"} 👋</h1>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">

        {/* ── KPIs gerais ── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: "Horas líquidas",    value: stats ? fmt(stats.totalHours)                                    : "—",  icon: Clock,        color: "text-blue-600"   },
            { label: "Questões",          value: stats?.totalQuestions ?? "—",                                            icon: Target,       color: "text-purple-600" },
            { label: "% Acertos",         value: stats ? (stats.accuracy !== null ? `${stats.accuracy}%` : "—")   : "—",  icon: BookOpen,     color: stats?.accuracy != null ? (stats.accuracy >= 70 ? "text-green-600" : "text-red-600") : "text-gray-400" },
            { label: "PDFs concluídos",   value: stats ? `${stats.completedPdfs}/${stats.totalPdfs}`              : "—",  icon: BookOpen,     color: "text-gray-700"   },
            { label: "Revisões pendentes",value: stats?.pendingReviews ?? "—",                                            icon: RefreshCw,    color: (stats?.lateReviews ?? 0) > 0 ? "text-red-600" : "text-gray-700" },
            { label: "Erros pendentes",   value: stats?.pendingErrors  ?? "—",                                            icon: AlertCircle,  color: (stats?.pendingErrors ?? 0) > 0 ? "text-red-600" : "text-gray-700" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className={`w-3.5 h-3.5 ${color}`} />
                <p className="text-xs text-gray-500">{label}</p>
              </div>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* ── Constância nos estudos ── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Flame className="w-5 h-5 text-orange-500" />
              <h2 className="text-lg font-semibold">Constância nos estudos</h2>
            </div>
            <div className="flex items-center gap-4 text-sm">
              {stats && (
                <>
                  <span className="flex items-center gap-1.5 font-semibold text-orange-500">
                    <Flame className="w-4 h-4" /> {stats.streak} dias seguidos
                  </span>
                  <span className="text-gray-400">{stats.studiedDays} de {stats.totalDays} dias estudados</span>
                  <span className={`font-semibold ${stats.consistency >= 70 ? "text-green-600" : stats.consistency >= 40 ? "text-yellow-600" : "text-red-600"}`}>
                    {stats.consistency}% constância
                  </span>
                </>
              )}
            </div>
          </div>
          {/* Dots de constância — últimos 30 dias */}
          <div className="flex flex-wrap gap-1.5">
            {stats?.consistencyDots.map((dot, i) => (
              <div
                key={i}
                title={dot.date}
                className={`w-6 h-6 rounded-md flex items-center justify-center ${
                  dot.studied ? "bg-green-500" : "bg-gray-100"
                }`}
              >
                {dot.studied && <CheckCircle className="w-3.5 h-3.5 text-white" />}
              </div>
            ))}
            {!stats && Array.from({ length: 30 }).map((_, i) => (
              <div key={i} className="w-6 h-6 rounded-md bg-gray-100 animate-pulse" />
            ))}
          </div>
          <div className="flex items-center gap-3 mt-3 text-xs text-gray-400">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-500 inline-block" /> Estudou</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-gray-100 inline-block border border-gray-200" /> Não estudou</span>
            <span className="ml-auto">Últimos 30 dias</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* ── Estudos do dia ── */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Estudos de hoje</h2>
              <Link href="/sessao" className="text-xs text-blue-600 hover:underline">+ Registrar</Link>
            </div>
            {stats?.todayBySubject && stats.todayBySubject.length > 0 ? (
              <>
                <div className="flex items-center gap-4 mb-4">
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{fmt(stats.todayHours)}</p>
                    <p className="text-xs text-gray-400">horas hoje</p>
                  </div>
                  {stats.todayQuestions > 0 && (
                    <div>
                      <p className="text-2xl font-bold text-purple-600">{stats.todayQuestions}</p>
                      <p className="text-xs text-gray-400">questões</p>
                    </div>
                  )}
                </div>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={stats.todayBySubject} dataKey="hours" nameKey="name"
                      cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3}>
                      {stats.todayBySubject.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => [`${fmt(v)}`, "Horas"]} />
                    <Legend iconSize={10} />
                  </PieChart>
                </ResponsiveContainer>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Clock className="w-8 h-8 text-gray-200 mb-2" />
                <p className="text-sm text-gray-400">Nenhuma sessão registrada hoje</p>
                <Link href="/sessao" className="mt-3 text-xs bg-gray-900 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors">
                  Iniciar sessão
                </Link>
              </div>
            )}
          </div>

          {/* ── Meta semanal ── */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-gray-400" />
              <h2 className="text-lg font-semibold">Esta semana</h2>
            </div>
            {stats ? (
              <div className="space-y-4">
                {stats.weeklyHours.map(({ day, hours }) => (
                  <div key={day}>
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>{day}</span>
                      <span>{hours > 0 ? fmt(hours) : "—"}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gray-900 transition-all"
                        style={{ width: `${Math.min(100, (hours / 8) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="h-4 bg-gray-100 rounded animate-pulse" />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Painel de disciplinas ── */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold">Painel por disciplina</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="text-left px-6 py-3 font-semibold">Disciplina</th>
                  <th className="text-right px-4 py-3 font-semibold">Tempo</th>
                  <th className="text-right px-4 py-3 font-semibold text-green-600">✓</th>
                  <th className="text-right px-4 py-3 font-semibold text-red-500">✗</th>
                  <th className="text-right px-4 py-3 font-semibold">Total</th>
                  <th className="text-right px-6 py-3 font-semibold">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {stats?.subjectStats.map(s => (
                  <tr key={s.name} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3 font-medium text-gray-900">{s.name}</td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {s.hours > 0 ? fmt(s.hours) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-green-600 font-semibold">
                      {s.correct > 0 ? s.correct : <span className="text-gray-300">0</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-red-500 font-semibold">
                      {s.wrong > 0 ? s.wrong : <span className="text-gray-300">0</span>}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {s.questions > 0 ? s.questions : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-6 py-3 text-right">
                      {s.accuracy !== null ? (
                        <span className={`font-bold px-2 py-0.5 rounded-full text-xs ${
                          s.accuracy >= 70 ? "bg-green-100 text-green-700"
                          : s.accuracy >= 50 ? "bg-yellow-100 text-yellow-700"
                          : "bg-red-100 text-red-700"
                        }`}>{s.accuracy}%</span>
                      ) : (
                        <span className="text-gray-300 text-xs">sem dados</span>
                      )}
                    </td>
                  </tr>
                ))}
                {!stats && Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Método Davi Lago ── */}
        <div className="text-white rounded-2xl p-6" style={{ backgroundColor: "#1B4040" }}>
          <h2 className="text-lg font-semibold mb-4">💡 Método de estudo — Davi Lago</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { title: "Leitura ativa",       desc: "Leia o PDF com atenção, anote dúvidas e marque os pontos principais. Não apenas passe os olhos." },
              { title: "Questões imediatas",  desc: "Após cada tópico, resolva questões. O erro agora é aprendizado. Registre tudo no Caderno de Erros." },
              { title: "Revisão espaçada",    desc: "Revise em 24h, 7 dias e 30 dias. O sistema já agenda automaticamente para você." },
            ].map(tip => (
              <div key={tip.title} className="bg-gray-800 rounded-xl p-4">
                <p className="font-semibold text-sm mb-1">{tip.title}</p>
                <p className="text-gray-400 text-xs leading-relaxed">{tip.desc}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
