"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  LineChart, Line,
} from "recharts";
import { BookOpen, Target, TrendingUp } from "lucide-react";

interface SubjectStat {
  name: string; hours: number; questions: number;
  correct: number; wrong: number; accuracy: number | null;
}
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
  resolvedErrors:  number;
  pendingReviews:  number;
  lateReviews:     number;
  subjectStats:    SubjectStat[];
  weeklyHours:     { day: string; hours: number }[];
  weeksData:       WeekData[];
  criticalErrors:  { title: string; subject: string; difficulty: string; reviewCount: number; wrongCount: number }[];
}

function EmptyCard({ icon: Icon, title, description, action }: {
  icon: React.ElementType; title: string; description: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mb-3">
        <Icon className="w-6 h-6 text-gray-400" />
      </div>
      <p className="text-sm font-semibold text-gray-700 mb-1">{title}</p>
      <p className="text-xs text-gray-400 max-w-xs leading-relaxed">{description}</p>
      {action && (
        <Link href={action.href}
          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-gray-900 hover:bg-gray-700 text-white text-xs font-semibold rounded-lg transition-colors">
          {action.label}
        </Link>
      )}
    </div>
  );
}

function fmtH(h: number) {
  const hh = Math.floor(h); const mm = Math.round((h - hh) * 60);
  return mm > 0 ? `${hh}h${mm.toString().padStart(2,"0")}min` : `${hh}h`;
}

function fmtDate(ds: string) {
  return new Date(ds + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

// Tooltip customizado para o gráfico de horas por disciplina
const HorasTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-xs">
      <p className="font-bold text-gray-900 mb-1">{label}</p>
      <p className="text-gray-600">{fmtH(payload[0].value)}</p>
    </div>
  );
};

// Tooltip customizado para Desempenho
const DesempenhoTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const correct = payload.find((p: any) => p.dataKey === "correct")?.value ?? 0;
  const wrong   = payload.find((p: any) => p.dataKey === "wrong")?.value ?? 0;
  const total   = correct + wrong;
  const pct     = total > 0 ? Math.round((correct / total) * 100) : 0;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-xs min-w-[140px]">
      <p className="font-bold text-gray-900 mb-2">{label}</p>
      <p className="text-green-600">Acertos: <strong>{correct} questões</strong></p>
      <p className="text-red-500">Erros: <strong>{wrong} questões</strong></p>
      {total > 0 && <p className="text-gray-500 mt-1">Acurácia: <strong>{pct}%</strong></p>}
    </div>
  );
};

export default function EstatisticasPage() {
  const [data,    setData]    = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/statistics")
      .then(r => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!data) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center text-red-500">
      Erro ao carregar estatísticas.
    </div>
  );

  const hasStudyData   = data.totalHours > 0 || data.totalQuestions > 0;
  const hasQuestions   = data.totalQuestions > 0;
  const hasWeeklyData  = data.weeklyHours.some(d => d.hours > 0);
  const hasSubjectData = data.subjectStats.some(s => s.hours > 0);
  const hasQuestData   = data.subjectStats.some(s => s.questions > 0);

  const accuracyDisplay = hasQuestions ? `${(data.accuracy ?? 0).toFixed(1)}%` : "—";
  const accuracyColor   = hasQuestions
    ? (data.accuracy ?? 0) >= 70 ? "text-green-600"
      : (data.accuracy ?? 0) >= 50 ? "text-yellow-600"
      : "text-red-600"
    : "text-gray-400";

  // Linha do tempo: horas acumuladas por semana (últimas 8 semanas, da mais antiga para a mais recente)
  const lineData = [...(data.weeksData ?? [])]
    .reverse()
    .map(w => ({
      label: `${fmtDate(w.startDate)}`,
      horas: parseFloat(w.days.reduce((a, d) => a + d.hours, 0).toFixed(1)),
      questoes: w.days.reduce((a, d) => a + d.questions, 0),
    }));

  // Dados para desempenho por disciplina — apenas quem tem questões
  const desempenhoData = data.subjectStats
    .filter(s => s.questions > 0)
    .map(s => ({ name: s.name, correct: s.correct, wrong: s.wrong }));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="text-white px-8" style={{ backgroundColor: "#1B4040", minHeight: "124px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <h1 className="text-3xl font-bold">Estatísticas</h1>
        <p className="text-gray-400 text-sm mt-1">Seu desempenho completo</p>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">

        {!hasStudyData && (
          <div className="text-white rounded-2xl p-6 flex items-start gap-4" style={{ backgroundColor: "#1B4040" }}>
            <div className="w-10 h-10 bg-gray-800 rounded-xl flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="font-semibold mb-1">Suas estatísticas aparecerão aqui</p>
              <p className="text-gray-400 text-sm leading-relaxed">
                Registre sua primeira sessão de estudo para ver horas, questões, acurácia e evolução.
              </p>
              <Link href="/sessao"
                className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-white text-gray-900 text-sm font-semibold rounded-xl hover:bg-gray-100 transition-colors">
                Iniciar sessão agora →
              </Link>
            </div>
          </div>
        )}

        {/* ── KPIs ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            ["Horas líquidas",     `${data.totalHours.toFixed(1)}h`,              "text-gray-900"],
            ["Questões",           data.totalQuestions,                            "text-gray-900"],
            ["% Acertos",          accuracyDisplay,                                accuracyColor],
            ["Erros",              data.totalWrong,                                data.totalWrong > 0 ? "text-red-600" : "text-gray-900"],
            ["PDFs concluídos",    `${data.completedPdfs}/${data.totalPdfs}`,      "text-gray-900"],
            ["Erros pendentes",    data.pendingErrors,                             data.pendingErrors > 0 ? "text-red-600" : "text-gray-900"],
            ["Revisões pendentes", data.pendingReviews,                            "text-gray-900"],
            ["Revisões atrasadas", data.lateReviews,                               data.lateReviews > 0 ? "text-red-600" : "text-gray-900"],
          ].map(([l, v, c]) => (
            <div key={l as string} className="bg-white rounded-xl border border-gray-200 px-5 py-4">
              <p className="text-xs text-gray-500 mb-1">{l}</p>
              <p className={`text-3xl font-bold ${c}`}>{v}</p>
            </div>
          ))}
        </div>

        {/* ── NOVO: Disciplinas × Horas de Estudo (barras horizontais) ── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <p className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-5">
            Disciplinas × Horas de Estudo
          </p>
          {!hasSubjectData ? (
            <EmptyCard icon={BookOpen} title="Nenhuma hora por disciplina ainda"
              description="Após registrar sessões vinculadas a disciplinas, o gráfico aparecerá aqui." />
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(200, data.subjectStats.filter(s => s.hours > 0).length * 52)}>
              <BarChart
                data={data.subjectStats.filter(s => s.hours > 0).sort((a, b) => b.hours - a.hours)}
                layout="vertical"
                margin={{ top: 0, right: 80, left: 10, bottom: 0 }}
                barSize={28}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}h`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: "#374151" }} width={160} />
                <Tooltip content={<HorasTooltip />} />
                <Bar dataKey="hours" fill="#10B981" radius={[0, 6, 6, 0]}
                  label={{
                    position: "right",
                    formatter: (v: number) => fmtH(v),
                    fontSize: 11,
                    fill: "#374151",
                    fontWeight: 600,
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── NOVO: Disciplinas × Desempenho (barras empilhadas acertos/erros) ── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <p className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-1">
            Disciplinas × Desempenho
          </p>
          <p className="text-xs text-gray-400 mb-5">Acertos (verde) e Erros (vermelho) por disciplina</p>
          {!hasQuestData ? (
            <EmptyCard icon={Target} title="Nenhuma questão registrada por disciplina"
              description="Resolva questões nas sessões de estudo para ver o desempenho por disciplina." />
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(280, desempenhoData.length * 52)}>
              <BarChart
                data={desempenhoData}
                layout="vertical"
                margin={{ top: 0, right: 60, left: 10, bottom: 0 }}
                barSize={28}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: "#374151" }} width={160} />
                <Tooltip content={<DesempenhoTooltip />} />
                <Legend
                  iconType="circle" iconSize={10}
                  formatter={(value: string) => value === "correct" ? "Acertos" : "Erros"}
                  wrapperStyle={{ paddingTop: 12, fontSize: 12 }}
                />
                <Bar dataKey="correct" stackId="q" fill="#10B981" name="correct" radius={[0, 0, 0, 0]} />
                <Bar dataKey="wrong"   stackId="q" fill="#EF4444" name="wrong"   radius={[0, 6, 6, 0]}
                  label={{
                    position: "right",
                    formatter: (_: number, __: string, props: any) => {
                      const total = (props?.correct ?? 0) + (props?.wrong ?? 0);
                      return total > 0 ? total : "";
                    },
                    fontSize: 11, fill: "#374151", fontWeight: 600,
                  }}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── NOVO: Linha do tempo — evolução semanal de horas ── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <p className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-1">
            Evolução Semanal
          </p>
          <p className="text-xs text-gray-400 mb-5">Horas e questões nas últimas 8 semanas</p>
          {lineData.every(d => d.horas === 0) ? (
            <EmptyCard icon={TrendingUp} title="Dados insuficientes"
              description="Estude por pelo menos 2 semanas para ver a evolução temporal." />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={lineData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6B7280" }} />
                <YAxis yAxisId="horas"   tick={{ fontSize: 11 }} tickFormatter={v => `${v}h`} />
                <YAxis yAxisId="questoes" orientation="right" tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v: number, name: string) =>
                    name === "horas" ? [fmtH(v), "Horas"] : [v, "Questões"]}
                />
                <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 12 }}
                  formatter={(v: string) => v === "horas" ? "Horas" : "Questões"} />
                <Line yAxisId="horas"    type="monotone" dataKey="horas"
                  stroke="#10B981" strokeWidth={2.5} dot={{ r: 4, fill: "#10B981" }}
                  activeDot={{ r: 6 }} name="horas" />
                <Line yAxisId="questoes" type="monotone" dataKey="questoes"
                  stroke="#8B5CF6" strokeWidth={2.5} dot={{ r: 4, fill: "#8B5CF6" }}
                  activeDot={{ r: 6 }} name="questoes" strokeDasharray="5 3" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── Gráfico semanal (barras — semana atual) ── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <p className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-4">
            Horas Estudadas Esta Semana
          </p>
          {!hasWeeklyData ? (
            <EmptyCard icon={BookOpen} title="Nenhuma hora registrada esta semana"
              description="Registre sessões de estudo para ver sua evolução semanal aqui."
              action={{ label: "Iniciar sessão", href: "/sessao" }} />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.weeklyHours} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => [fmtH(v), "Horas"]} />
                <Bar dataKey="hours" fill="#1B4040" radius={[4, 4, 0, 0]}
                  label={{ position: "top", fontSize: 10, fill: "#6B7280",
                    formatter: (v: number) => v > 0 ? fmtH(v) : "" }} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── Donuts ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            {
              title: "Aproveitamento",
              data:  [
                { name: "Acertos", value: (data.totalQuestions ?? 0) - (data.totalWrong ?? 0) },
                { name: "Erros",   value: data.totalWrong ?? 0 },
              ],
              colors:   ["#10B981", "#EF4444"],
              emptyMsg: "Resolva questões nas sessões de estudo para ver seu aproveitamento.",
            },
            {
              title: "Erros",
              data:  [
                { name: "Pendentes",  value: data.pendingErrors  ?? 0 },
                { name: "Resolvidos", value: data.resolvedErrors ?? 0 },
              ],
              colors:   ["#EF4444", "#10B981"],
              emptyMsg: "Nenhum erro registrado no caderno ainda.",
            },
            {
              title: "PDFs",
              data:  [
                { name: "Concluídos", value: data.completedPdfs ?? 0 },
                { name: "Pendentes",  value: (data.totalPdfs ?? 0) - (data.completedPdfs ?? 0) },
              ],
              colors:   ["#1B4040", "#D1D5DB"],
              emptyMsg: "Cadastre PDFs nas matérias para acompanhar o progresso.",
            },
          ].map(({ title, data: d, colors, emptyMsg }) => {
            const total = d.reduce((a, x) => a + x.value, 0);
            return (
              <div key={title} className="bg-white rounded-2xl border border-gray-200 p-6">
                <p className="text-base font-semibold mb-2">{title}</p>
                {total === 0 ? (
                  <div className="h-36 flex flex-col items-center justify-center text-center gap-2 px-2">
                    <Target className="w-6 h-6 text-gray-300" />
                    <p className="text-xs text-gray-400 leading-relaxed">{emptyMsg}</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={d} cx="50%" cy="50%" innerRadius={45} outerRadius={65}
                        dataKey="value" paddingAngle={3}>
                        {d.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                      </Pie>
                      <Legend iconSize={10} />
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Erros críticos ── */}
        {data.criticalErrors.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <p className="text-base font-semibold mb-4">Erros mais críticos</p>
            <div className="space-y-2">
              {data.criticalErrors.map((e, i) => (
                <div key={i} className="flex items-start justify-between gap-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{e.title}</p>
                    <p className="text-xs text-gray-500">{e.subject}</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs shrink-0">
                    <span className={`px-2 py-0.5 rounded-full font-medium ${
                      e.difficulty === "Alta"   ? "bg-red-100 text-red-700"
                      : e.difficulty === "Media" ? "bg-yellow-100 text-yellow-700"
                      : "bg-green-100 text-green-700"
                    }`}>{e.difficulty}</span>
                    <span className="text-red-600 font-semibold">Errou {e.wrongCount}x</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
