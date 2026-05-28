"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  LineChart, Line,
} from "recharts";
import { BookOpen, Target, TrendingUp, Map } from "lucide-react";

interface SubjectStat {
  name: string; hours: number; questions: number;
  correct: number; wrong: number; accuracy: number | null;
}
interface WeekDay { day: string; date: string; hours: number; questions: number; correct: number; wrong: number; }
interface WeekData { weekOffset: number; startDate: string; endDate: string; days: WeekDay[]; }
interface Stats {
  totalHours: number; totalQuestions: number; totalCorrect: number; totalWrong: number;
  accuracy: number | null; completedPdfs: number; totalPdfs: number;
  pendingErrors: number; resolvedErrors: number; pendingReviews: number; lateReviews: number;
  subjectStats: SubjectStat[]; weeklyHours: { day: string; hours: number }[];
  weeksData: WeekData[];
  criticalErrors: { title: string; subject: string; difficulty: string; reviewCount: number; wrongCount: number }[];
}

// ── Dados do histórico para mapa de dificuldades ──────────────────────────────
interface HistoricoSession {
  subjectId: string; subjectName: string;
  topicName: string; pdfTitle: string;
  questions: number; correct: number; wrong: number; hours: number;
}

interface TopicStat {
  topicName: string; subjectName: string;
  questions: number; correct: number; wrong: number; hours: number;
  accuracy: number | null;
  level: "critica" | "atencao" | "ok" | "sem_dados";
}

function fmtH(h: number) {
  const hh = Math.floor(h); const mm = Math.round((h - hh) * 60);
  return mm > 0 ? `${hh}h${mm.toString().padStart(2,"0")}min` : `${hh}h`;
}
function fmtDate(ds: string) {
  return new Date(ds + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
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

const HorasTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-xs">
      <p className="font-bold text-gray-900 mb-1">{label}</p>
      <p className="text-gray-600">{fmtH(payload[0].value)}</p>
    </div>
  );
};

const DesempenhoTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const correct = payload.find((p: any) => p.dataKey === "correct")?.value ?? 0;
  const wrong   = payload.find((p: any) => p.dataKey === "wrong")?.value ?? 0;
  const total   = correct + wrong;
  const pct     = total > 0 ? Math.round((correct / total) * 100) : 0;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-xs min-w-[140px]">
      <p className="font-bold text-gray-900 mb-2">{label}</p>
      <p className="text-green-600">Acertos: <strong>{correct}</strong></p>
      <p className="text-red-500">Erros: <strong>{wrong}</strong></p>
      {total > 0 && <p className="text-gray-500 mt-1">Acurácia: <strong>{pct}%</strong></p>}
    </div>
  );
};

// ── MAPA DE DIFICULDADES ──────────────────────────────────────────────────────
function MapaDificuldades({ sessions }: { sessions: HistoricoSession[] }) {
  const [filterSubject, setFilterSubject] = useState("Todas");
  const [sortBy, setSortBy] = useState<"accuracy" | "questions" | "hours">("accuracy");

  // Agrupa por tópico — usa objeto em vez de Map para compatibilidade com ES5
  const topics: TopicStat[] = useMemo(() => {
    const topicObj: Record<string, TopicStat> = {};
    for (const s of sessions) {
      if (!s.topicName?.trim()) continue;
      const key = `${s.subjectName}|||${s.topicName}`;
      if (!topicObj[key]) {
        topicObj[key] = { topicName: s.topicName, subjectName: s.subjectName, questions: 0, correct: 0, wrong: 0, hours: 0, accuracy: null, level: "sem_dados" };
      }
      topicObj[key].questions += s.questions;
      topicObj[key].correct   += s.correct;
      topicObj[key].wrong     += s.wrong;
      topicObj[key].hours     += s.hours;
    }
    return Object.values(topicObj).map(t => {
      const acc = t.questions > 0 ? Math.round((t.correct / t.questions) * 100) : null;
      const level: TopicStat["level"] = acc === null ? "sem_dados"
        : acc < 60 ? "critica"
        : acc < 75 ? "atencao"
        : "ok";
      return { ...t, accuracy: acc, level };
    });
  }, [sessions]);

  const subjects = ["Todas", ...Array.from(new Set(topics.map(t => t.subjectName))).sort()];
  const filtered = topics
    .filter(t => filterSubject === "Todas" || t.subjectName === filterSubject)
    .sort((a, b) => {
      if (sortBy === "accuracy") {
        const aVal = a.accuracy ?? 101; const bVal = b.accuracy ?? 101;
        return aVal - bVal;
      }
      if (sortBy === "questions") return b.questions - a.questions;
      return b.hours - a.hours;
    });

  const criticos  = topics.filter(t => t.level === "critica").length;
  const atencao   = topics.filter(t => t.level === "atencao").length;
  const ok        = topics.filter(t => t.level === "ok").length;

  const LEVEL = {
    critica:   { label: "Crítico",  bg: "bg-red-100",    text: "text-red-700",    dot: "bg-red-500"    },
    atencao:   { label: "Atenção",  bg: "bg-yellow-100", text: "text-yellow-700", dot: "bg-yellow-500" },
    ok:        { label: "Ok",       bg: "bg-green-100",  text: "text-green-700",  dot: "bg-green-500"  },
    sem_dados: { label: "Sem dados",bg: "bg-gray-100",   text: "text-gray-500",   dot: "bg-gray-300"   },
  };

  if (topics.length === 0) return (
    <EmptyCard icon={Map} title="Nenhum tópico com dados ainda"
      description="Registre sessões de estudo com o campo Tópico preenchido para ver o mapa de dificuldades." />
  );

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Críticos", value: criticos, color: "text-red-600",    bg: "bg-red-50"    },
          { label: "Atenção",  value: atencao,  color: "text-yellow-600", bg: "bg-yellow-50" },
          { label: "Ok",       value: ok,       color: "text-green-600",  bg: "bg-green-50"  },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`${bg} rounded-xl p-3 text-center`}>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap items-center">
        <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900">
          {subjects.map(s => <option key={s}>{s}</option>)}
        </select>
        <div className="flex gap-1">
          {([["accuracy","Menor acerto"],["questions","Mais questões"],["hours","Mais horas"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setSortBy(k)}
              className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${sortBy === k ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de tópicos */}
      <div className="space-y-2">
        {filtered.map((t, i) => {
          const cfg = LEVEL[t.level];
          return (
            <div key={i} className="bg-white rounded-xl border border-gray-200 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{t.topicName}</p>
                    <p className="text-xs text-gray-400">{t.subjectName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0 text-right">
                  <div className="text-xs text-gray-500">
                    <p className="font-medium text-gray-700">{t.questions > 0 ? t.questions : "—"}</p>
                    <p>questões</p>
                  </div>
                  <div className="text-xs text-gray-500">
                    <p className="font-medium text-gray-700">{fmtH(t.hours)}</p>
                    <p>horas</p>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${cfg.bg} ${cfg.text} min-w-[52px] text-center`}>
                    {t.accuracy !== null ? `${t.accuracy}%` : "—"}
                  </span>
                </div>
              </div>
              {/* Barra de acurácia */}
              {t.accuracy !== null && (
                <div className="mt-2 h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${t.accuracy >= 75 ? "bg-green-500" : t.accuracy >= 60 ? "bg-yellow-500" : "bg-red-500"}`}
                    style={{ width: `${t.accuracy}%` }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────
type Tab = "visao_geral" | "mapa_dificuldades";

export default function EstatisticasPage() {
  const [data,     setData]     = useState<Stats | null>(null);
  const [sessions, setSessions] = useState<HistoricoSession[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState<Tab>("visao_geral");

  useEffect(() => {
    Promise.all([
      fetch("/api/statistics").then(r => r.json()),
      fetch("/api/historico").then(r => r.json()),
    ]).then(([stats, historico]) => {
      setData(stats);
      if (Array.isArray(historico)) {
        const all: HistoricoSession[] = historico.flatMap((d: any) => d.sessions ?? []);
        setSessions(all);
      }
    }).catch(console.error)
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
      : (data.accuracy ?? 0) >= 50 ? "text-yellow-600" : "text-red-600"
    : "text-gray-400";

  const lineData = [...(data.weeksData ?? [])].reverse().map(w => ({
    label: `${fmtDate(w.startDate)}`,
    horas: parseFloat(w.days.reduce((a, d) => a + d.hours, 0).toFixed(1)),
    questoes: w.days.reduce((a, d) => a + d.questions, 0),
  }));

  const desempenhoData = data.subjectStats
    .filter(s => s.questions > 0)
    .map(s => ({ name: s.name, correct: s.correct, wrong: s.wrong }));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="text-white px-8" style={{ backgroundColor: "#1B4040", minHeight: "124px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <h1 className="text-3xl font-bold">Estatísticas</h1>
        <p className="text-gray-400 text-sm mt-1">Seu desempenho completo</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 flex gap-0">
          {([
            ["visao_geral",       "Visão Geral",          TrendingUp],
            ["mapa_dificuldades", "Mapa de Dificuldades", Map],
          ] as const).map(([key, label, Icon]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-5 py-4 text-sm font-medium border-b-2 transition-colors ${
                tab === key ? "border-gray-900 text-gray-900" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}>
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">

        {tab === "visao_geral" && (<>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              ["Horas líquidas",     `${data.totalHours.toFixed(1)}h`,         "text-gray-900"],
              ["Questões",           data.totalQuestions,                       "text-gray-900"],
              ["% Acertos",          accuracyDisplay,                           accuracyColor],
              ["Erros",              data.totalWrong,                           data.totalWrong > 0 ? "text-red-600" : "text-gray-900"],
              ["PDFs concluídos",    `${data.completedPdfs}/${data.totalPdfs}`, "text-gray-900"],
              ["Erros pendentes",    data.pendingErrors,                        data.pendingErrors > 0 ? "text-red-600" : "text-gray-900"],
              ["Revisões pendentes", data.pendingReviews,                       "text-gray-900"],
              ["Revisões atrasadas", data.lateReviews,                          data.lateReviews > 0 ? "text-red-600" : "text-gray-900"],
            ].map(([l, v, c]) => (
              <div key={l as string} className="bg-white rounded-xl border border-gray-200 px-5 py-4">
                <p className="text-xs text-gray-500 mb-1">{l}</p>
                <p className={`text-3xl font-bold ${c}`}>{v}</p>
              </div>
            ))}
          </div>

          {/* Disciplinas × Horas */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <p className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-5">Disciplinas × Horas de Estudo</p>
            {!hasSubjectData ? (
              <EmptyCard icon={BookOpen} title="Nenhuma hora por disciplina ainda"
                description="Após registrar sessões vinculadas a disciplinas, o gráfico aparecerá aqui." />
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(200, data.subjectStats.filter(s => s.hours > 0).length * 52)}>
                <BarChart data={data.subjectStats.filter(s => s.hours > 0).sort((a, b) => b.hours - a.hours)}
                  layout="vertical" margin={{ top: 0, right: 80, left: 10, bottom: 0 }} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `${v}h`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: "#374151" }} width={160} />
                  <Tooltip content={<HorasTooltip />} />
                  <Bar dataKey="hours" fill="#10B981" radius={[0, 6, 6, 0]}
                    label={{ position: "right", formatter: (v: number) => fmtH(v), fontSize: 11, fill: "#374151", fontWeight: 600 }} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Disciplinas × Desempenho */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <p className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-1">Disciplinas × Desempenho</p>
            <p className="text-xs text-gray-400 mb-5">Acertos (verde) e Erros (vermelho) por disciplina</p>
            {!hasQuestData ? (
              <EmptyCard icon={Target} title="Nenhuma questão registrada por disciplina"
                description="Resolva questões nas sessões de estudo para ver o desempenho por disciplina." />
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(280, desempenhoData.length * 52)}>
                <BarChart data={desempenhoData} layout="vertical" margin={{ top: 0, right: 60, left: 10, bottom: 0 }} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: "#374151" }} width={160} />
                  <Tooltip content={<DesempenhoTooltip />} />
                  <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
                    formatter={(v: string) => v === "correct" ? "Acertos" : "Erros"} />
                  <Bar dataKey="correct" stackId="q" fill="#10B981" name="correct" />
                  <Bar dataKey="wrong"   stackId="q" fill="#EF4444" name="wrong" radius={[0, 6, 6, 0]}
                    label={{ position: "right", formatter: (_: number, __: string, props: any) => {
                      const total = (props?.correct ?? 0) + (props?.wrong ?? 0);
                      return total > 0 ? total : "";
                    }, fontSize: 11, fill: "#374151", fontWeight: 600 }} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Evolução semanal */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <p className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-1">Evolução Semanal</p>
            <p className="text-xs text-gray-400 mb-5">Horas e questões nas últimas 8 semanas</p>
            {lineData.every(d => d.horas === 0) ? (
              <EmptyCard icon={TrendingUp} title="Dados insuficientes"
                description="Estude por pelo menos 2 semanas para ver a evolução temporal." />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={lineData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6B7280" }} />
                  <YAxis yAxisId="horas" tick={{ fontSize: 11 }} tickFormatter={v => `${v}h`} />
                  <YAxis yAxisId="questoes" orientation="right" tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number, name: string) => name === "horas" ? [fmtH(v), "Horas"] : [v, "Questões"]} />
                  <Legend iconType="circle" iconSize={10} wrapperStyle={{ fontSize: 12 }}
                    formatter={(v: string) => v === "horas" ? "Horas" : "Questões"} />
                  <Line yAxisId="horas"    type="monotone" dataKey="horas"    stroke="#10B981" strokeWidth={2.5} dot={{ r: 4, fill: "#10B981" }} activeDot={{ r: 6 }} name="horas" />
                  <Line yAxisId="questoes" type="monotone" dataKey="questoes" stroke="#8B5CF6" strokeWidth={2.5} dot={{ r: 4, fill: "#8B5CF6" }} activeDot={{ r: 6 }} name="questoes" strokeDasharray="5 3" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Horas semana atual */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <p className="text-sm font-bold uppercase tracking-wide text-gray-500 mb-4">Horas Esta Semana</p>
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
                    label={{ position: "top", fontSize: 10, fill: "#6B7280", formatter: (v: number) => v > 0 ? fmtH(v) : "" }} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Donuts */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { title: "Aproveitamento", data: [{ name: "Acertos", value: (data.totalQuestions ?? 0) - (data.totalWrong ?? 0) }, { name: "Erros", value: data.totalWrong ?? 0 }], colors: ["#10B981", "#EF4444"], emptyMsg: "Resolva questões para ver seu aproveitamento." },
              { title: "Erros",          data: [{ name: "Pendentes", value: data.pendingErrors ?? 0 }, { name: "Resolvidos", value: data.resolvedErrors ?? 0 }], colors: ["#EF4444", "#10B981"], emptyMsg: "Nenhum erro registrado ainda." },
              { title: "PDFs",           data: [{ name: "Concluídos", value: data.completedPdfs ?? 0 }, { name: "Pendentes", value: (data.totalPdfs ?? 0) - (data.completedPdfs ?? 0) }], colors: ["#1B4040", "#D1D5DB"], emptyMsg: "Cadastre PDFs nas matérias." },
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
                        <Pie data={d} cx="50%" cy="50%" innerRadius={45} outerRadius={65} dataKey="value" paddingAngle={3}>
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

          {/* Erros críticos */}
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
                      <span className={`px-2 py-0.5 rounded-full font-medium ${e.difficulty === "Alta" ? "bg-red-100 text-red-700" : e.difficulty === "Media" ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"}`}>
                        {e.difficulty}
                      </span>
                      <span className="text-red-600 font-semibold">Errou {e.wrongCount}x</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>)}

        {tab === "mapa_dificuldades" && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="mb-5">
              <h2 className="text-base font-bold text-gray-900">Mapa de Dificuldades por Tópico</h2>
              <p className="text-xs text-gray-400 mt-1">
                Baseado nas sessões de estudo com tópico preenchido. Crítico &lt;60% · Atenção 60-75% · Ok ≥75%
              </p>
            </div>
            <MapaDificuldades sessions={sessions} />
          </div>
        )}
      </div>
    </div>
  );
}
