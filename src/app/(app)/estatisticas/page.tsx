"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { BookOpen, Target, TrendingUp } from "lucide-react";

interface Stats {
  totalHours:      number;
  totalQuestions:  number;
  accuracy:        number;
  totalWrong:      number;
  completedPdfs:   number;
  totalPdfs:       number;
  pendingErrors:   number;
  resolvedErrors:  number;
  pendingReviews:  number;
  lateReviews:     number;
  subjectStats:    { name: string; hours: number; accuracy: number; errors: number }[];
  weeklyHours:     { day: string; hours: number }[];
  criticalErrors:  { title: string; subject: string; difficulty: string; reviewCount: number; wrongCount: number }[];
}

// ── Estado vazio reutilizável ─────────────────────────────────────────────────
function EmptyCard({
  icon: Icon, title, description, action,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
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
        <Link
          href={action.href}
          className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-gray-900 hover:bg-gray-700 text-white text-xs font-semibold rounded-lg transition-colors"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}

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

  // ✅ Detecta se o usuário ainda não tem nenhum dado real
  const hasStudyData    = data.totalHours > 0 || data.totalQuestions > 0;
  const hasQuestions    = data.totalQuestions > 0;
  const hasWeeklyData   = data.weeklyHours.some(d => d.hours > 0);
  const hasSubjectData  = data.subjectStats.some(s => s.hours > 0);

  // ✅ Accuracy: null quando sem questões — nunca exibir "0.0%"
  const accuracyDisplay = hasQuestions
    ? `${data.accuracy.toFixed(1)}%`
    : "—";
  const accuracyColor = hasQuestions
    ? data.accuracy >= 70 ? "text-green-600"
      : data.accuracy >= 50 ? "text-yellow-600"
      : "text-red-600"
    : "text-gray-400";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="text-white px-8" style={{ backgroundColor: "#1B4040", minHeight: "124px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <h1 className="text-3xl font-bold">Estatísticas</h1>
        <p className="text-gray-400 text-sm mt-1">Seu desempenho completo</p>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">

        {/* ── Banner de onboarding — só aparece quando não há nenhum dado ── */}
        {!hasStudyData && (
          <div className="text-white rounded-2xl p-6 flex items-start gap-4">
            <div className="w-10 h-10 bg-gray-800 rounded-xl flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="font-semibold mb-1">Suas estatísticas aparecerão aqui</p>
              <p className="text-gray-400 text-sm leading-relaxed">
                Registre sua primeira sessão de estudo para começar a ver horas, questões,
                acurácia e evolução semanal.
              </p>
              <Link
                href="/sessao"
                className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-white text-gray-900 text-sm font-semibold rounded-xl hover:bg-gray-100 transition-colors"
              >
                Iniciar sessão agora →
              </Link>
            </div>
          </div>
        )}

        {/* ── KPIs ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            ["Horas líquidas",    `${data.totalHours.toFixed(1)}h`, "text-gray-900"],
            ["Questões",          data.totalQuestions,               "text-gray-900"],
            // ✅ Exibe "—" quando não há questões registradas
            ["% Acertos",        accuracyDisplay,                   accuracyColor],
            ["Erros",            data.totalWrong,                   data.totalWrong > 0 ? "text-red-600" : "text-gray-900"],
            ["PDFs concluídos",  `${data.completedPdfs}/${data.totalPdfs}`, "text-gray-900"],
            ["Erros pendentes",  data.pendingErrors,                data.pendingErrors > 0 ? "text-red-600" : "text-gray-900"],
            ["Revisões pendentes", data.pendingReviews,             "text-gray-900"],
            ["Revisões atrasadas", data.lateReviews,                data.lateReviews > 0 ? "text-red-600" : "text-gray-900"],
          ].map(([l, v, c]) => (
            <div key={l as string} className="bg-white rounded-xl border border-gray-200 px-5 py-4">
              <p className="text-xs text-gray-500 mb-1">{l}</p>
              <p className={`text-3xl font-bold ${c}`}>{v}</p>
            </div>
          ))}
        </div>

        {/* ── Gráfico semanal ── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <p className="text-base font-semibold mb-4">Horas estudadas esta semana</p>
          {/* ✅ Oculta o gráfico vazio — mostra orientação no lugar */}
          {!hasWeeklyData ? (
            <EmptyCard
              icon={BookOpen}
              title="Nenhuma hora registrada esta semana"
              description="Registre sessões de estudo para ver sua evolução semanal aqui."
              action={{ label: "Iniciar sessão", href: "/sessao" }}
            />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.weeklyHours} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => [`${v.toFixed(1)}h`, "Horas"]} />
                <Bar dataKey="hours" fill="#111827" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── Donuts ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            {
              title:  "Aproveitamento",
              data:   [
                { name: "Acertos", value: data.totalQuestions - data.totalWrong },
                { name: "Erros",   value: data.totalWrong },
              ],
              colors:  ["#10B981", "#EF4444"],
              // ✅ Estado vazio específico para aproveitamento
              emptyMsg: "Resolva questões nas sessões de estudo para ver seu aproveitamento.",
            },
            {
              title:  "Erros",
              data:   [
                { name: "Pendentes",  value: data.pendingErrors  },
                { name: "Resolvidos", value: data.resolvedErrors },
              ],
              colors:  ["#EF4444", "#10B981"],
              emptyMsg: "Nenhum erro registrado no caderno ainda.",
            },
            {
              title:  "PDFs",
              data:   [
                { name: "Concluídos", value: data.completedPdfs },
                { name: "Pendentes",  value: data.totalPdfs - data.completedPdfs },
              ],
              colors:  ["#111827", "#D1D5DB"],
              emptyMsg: "Cadastre PDFs nas matérias para acompanhar o progresso.",
            },
          ].map(({ title, data: d, colors, emptyMsg }) => {
            const total = d.reduce((a, x) => a + x.value, 0);
            return (
              <div key={title} className="bg-white rounded-2xl border border-gray-200 p-6">
                <p className="text-base font-semibold mb-2">{title}</p>
                {total === 0 ? (
                  // ✅ Estado vazio com mensagem útil em vez de só "Sem dados"
                  <div className="h-36 flex flex-col items-center justify-center text-center gap-2 px-2">
                    <Target className="w-6 h-6 text-gray-300" />
                    <p className="text-xs text-gray-400 leading-relaxed">{emptyMsg}</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={d}
                        cx="50%" cy="50%"
                        innerRadius={45} outerRadius={65}
                        dataKey="value"
                        paddingAngle={3}
                      >
                        {d.map((_, i) => (
                          <Cell key={i} fill={colors[i % colors.length]} />
                        ))}
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

        {/* ── Horas por disciplina ── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <p className="text-base font-semibold mb-4">Horas por disciplina</p>
          {!hasSubjectData ? (
            <EmptyCard
              icon={BookOpen}
              title="Nenhuma hora por disciplina ainda"
              description="Após registrar sessões vinculadas a disciplinas, o gráfico aparecerá aqui."
            />
          ) : (
            <ResponsiveContainer
              width="100%"
              height={Math.max(160, data.subjectStats.length * 48)}
            >
              <BarChart
                data={data.subjectStats}
                layout="vertical"
                margin={{ top: 5, right: 50, left: 80, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={80} />
                <Tooltip formatter={(v: number) => [`${v.toFixed(1)}h`, "Horas"]} />
                <Bar dataKey="hours" fill="#111827" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── Erros críticos ── */}
        {data.criticalErrors.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <p className="text-base font-semibold mb-4">Erros mais críticos</p>
            <div className="space-y-2">
              {data.criticalErrors.map((e, i) => (
                <div
                  key={i}
                  className="flex items-start justify-between gap-4 p-3 bg-gray-50 rounded-xl border border-gray-100"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{e.title}</p>
                    <p className="text-xs text-gray-500">{e.subject}</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs shrink-0">
                    <span className={`px-2 py-0.5 rounded-full font-medium ${
                      e.difficulty === "Alta"  ? "bg-red-100 text-red-700"
                      : e.difficulty === "Media" ? "bg-yellow-100 text-yellow-700"
                      : "bg-green-100 text-green-700"
                    }`}>
                      {e.difficulty}
                    </span>
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
