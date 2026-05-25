"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Target,
  Zap,
  BookOpen,
  ArrowRight,
} from "lucide-react";

interface SubjectPriority {
  id: string;
  name: string;
  editalWeight: number;
  criticality: number;
  studyHours: number;
  totalQuestions: number;
  correctQuestions: number;
  wrongQuestions: number;
  accuracy: number | null;   // null = sem dados
  errorRate: number | null;  // null = sem dados
  pendingErrors: number;
  pendingReviews: number;
  lastStudyAt: string | null;
  difficultyScore: number;
  priorityScore: number;
  level: "critica" | "atencao" | "ok" | "sem_dados";
  recommendation: string;
}

function calcPriority(
  s: any,
  pendingRevs: number,
  pendingErrs: number
): SubjectPriority {
  const totalQ   = s.totalQuestions   ?? 0;
  const correctQ = s.correctQuestions ?? 0;
  const wrongQ   = s.wrongQuestions   ?? 0;
  const hasData  = totalQ > 0;

  // ✅ FIX: accuracy e errorRate são null quando não há questões
  // Nunca usar 50 como fallback — isso distorcia o ranking inteiro
  const accuracy:   number | null = hasData ? Math.round((correctQ / totalQ) * 100) : null;
  const errorRate:  number | null = hasData ? Math.round((wrongQ   / totalQ) * 100) : null;

  // ✅ FIX: difficultyScore sem default 50 para sem_dados
  // Quando não há dados reais, o componente de dificuldade é excluído do score
  const difficultyScore = hasData
    ? Math.round(
        errorRate! * 0.7 +
        (100 - Math.min((s.studyHours ?? 0) * 5, 100)) * 0.3
      )
    : 0; // zero = sem influência no score quando sem dados

  // ✅ FIX: score composto com redistribuição de pesos quando sem dados
  // Com dados:    Peso edital (30%) + Criticidade (25%) + Dificuldade real (30%) + Pendências (15%)
  // Sem dados:    Peso edital (43%) + Criticidade (36%) + Pendências (21%)
  let priorityScore: number;
  const pendingFactor = Math.min((pendingRevs + pendingErrs) * 2, 15);

  if (hasData) {
    const editalFactor  = (s.editalWeight / 10) * 30;
    const critFactor    = (s.criticality  / 10) * 25;
    const diffFactor    = (difficultyScore / 100) * 30;
    priorityScore = Math.round(editalFactor + critFactor + diffFactor + pendingFactor);
  } else {
    // Redistribui os 30% de dificuldade nos outros componentes
    const editalFactor  = (s.editalWeight / 10) * 43;
    const critFactor    = (s.criticality  / 10) * 36;
    const pendingRedistr = Math.min((pendingRevs + pendingErrs) * 2, 21);
    priorityScore = Math.round(editalFactor + critFactor + pendingRedistr);
  }

  // Classificação — apenas quando há dados reais
  let level: SubjectPriority["level"] = "sem_dados";
  if (hasData) {
    if (accuracy! < 60)      level = "critica";
    else if (accuracy! < 75) level = "atencao";
    else                     level = "ok";
  }

  // Recomendação
  let recommendation = "";
  if (level === "sem_dados")
    recommendation = "Comece a registrar questões para gerar métricas";
  else if (level === "critica")
    recommendation = `Taxa de erro de ${errorRate}% — foque em revisão e caderno de erros`;
  else if (level === "atencao")
    recommendation = `${errorRate}% de erro — continue praticando, ainda há margem`;
  else
    recommendation = `${accuracy}% de acerto — manter ritmo e avançar conteúdo`;

  return {
    id: s.id,
    name: s.name,
    editalWeight: s.editalWeight,
    criticality: s.criticality,
    studyHours: s.studyHours ?? 0,
    totalQuestions: totalQ,
    correctQuestions: correctQ,
    wrongQuestions: wrongQ,
    accuracy,
    errorRate,
    pendingErrors: pendingErrs,
    pendingReviews: pendingRevs,
    lastStudyAt: s.lastStudyAt,
    difficultyScore,
    priorityScore,
    level,
    recommendation,
  };
}

const LEVEL_CONFIG = {
  critica:   { label: "Crítica",   color: "text-red-600",    bg: "bg-red-50",    border: "border-red-200",    bar: "bg-red-500",    icon: AlertTriangle },
  atencao:   { label: "Atenção",   color: "text-yellow-600", bg: "bg-yellow-50", border: "border-yellow-200", bar: "bg-yellow-500", icon: AlertTriangle },
  ok:        { label: "Em dia",    color: "text-green-600",  bg: "bg-green-50",  border: "border-green-200",  bar: "bg-green-500",  icon: CheckCircle   },
  sem_dados: { label: "Sem dados", color: "text-gray-400",   bg: "bg-gray-50",   border: "border-gray-200",   bar: "bg-gray-300",   icon: BookOpen      },
};

export default function PrioridadesPage() {
  const [subjects, setSubjects] = useState<SubjectPriority[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"priority" | "difficulty" | "accuracy">("priority");

  useEffect(() => {
    Promise.all([
      fetch("/api/subjects").then((r) => r.json()).catch(() => []),
      fetch("/api/reviews").then((r) => r.json()).catch(() => []),
      fetch("/api/error-notes").then((r) => r.json()).catch(() => []),
    ]).then(([subjectsRaw, reviewsRaw, errorsRaw]) => {
      const list    = Array.isArray(subjectsRaw) ? subjectsRaw : subjectsRaw?.subjects ?? [];
      const reviews = Array.isArray(reviewsRaw)  ? reviewsRaw  : [];
      const errors  = Array.isArray(errorsRaw)   ? errorsRaw   : [];

      const scored = list.map((s: any) => {
        const pendingRevs = reviews.filter(
          (r: any) => !r.completed && r.pdf?.topic?.subject?.id === s.id
        ).length;
        const pendingErrs = errors.filter(
          (e: any) => !e.resolved && e.subjectId === s.id
        ).length;
        return calcPriority(s, pendingRevs, pendingErrs);
      });

      setSubjects(scored);
    }).finally(() => setLoading(false));
  }, []);

  const sorted = [...subjects].sort((a, b) => {
    if (sortBy === "priority")   return b.priorityScore - a.priorityScore;
    if (sortBy === "difficulty") return b.difficultyScore - a.difficultyScore;
    if (sortBy === "accuracy") {
      // ✅ FIX: null vai para o final na ordenação por acerto
      const aVal = a.accuracy !== null ? a.accuracy : 101;
      const bVal = b.accuracy !== null ? b.accuracy : 101;
      return aVal - bVal;
    }
    return 0;
  });

  const maxPriority = Math.max(...sorted.map((s) => s.priorityScore), 1);

  // KPIs gerais — apenas matérias com dados reais
  const totalQuestions = subjects.reduce((a, s) => a + s.totalQuestions, 0);
  const totalCorrect   = subjects.reduce((a, s) => a + s.correctQuestions, 0);
  const globalAccuracy = totalQuestions > 0
    ? Math.round((totalCorrect / totalQuestions) * 100)
    : null; // ✅ null quando sem dados globais
  const critical  = subjects.filter((s) => s.level === "critica").length;
  const attention = subjects.filter((s) => s.level === "atencao").length;

  if (loading)
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="text-white px-8 py-8" style={{ backgroundColor: "#1B4040" }}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <TrendingUp className="w-6 h-6 text-gray-400" />
              <h1 className="text-3xl font-bold">Prioridades Inteligentes</h1>
            </div>
            <p className="text-gray-400 text-sm">
              Ranking baseado em dificuldade real + peso no edital — onde você deve focar agora
            </p>
          </div>
          <Link
            href="/ciclo"
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <Zap className="w-4 h-4" /> Ver ciclo de estudos
          </Link>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* KPIs gerais */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              label: "Total de questões",
              value: totalQuestions.toString(),
              sub: "registradas",
            },
            {
              label: "Acurácia global",
              // ✅ FIX: exibe "—" quando não há dados, não "0%"
              value: globalAccuracy !== null ? `${globalAccuracy}%` : "—",
              sub:
                globalAccuracy !== null
                  ? globalAccuracy >= 70
                    ? "✓ Boa"
                    : globalAccuracy >= 50
                    ? "⚠ Regular"
                    : "✗ Crítica"
                  : "sem dados",
              color:
                globalAccuracy !== null
                  ? globalAccuracy >= 70
                    ? "text-green-600"
                    : globalAccuracy >= 50
                    ? "text-yellow-600"
                    : "text-red-600"
                  : "text-gray-400",
            },
            {
              label: "Matérias críticas",
              value: critical.toString(),
              sub: "abaixo de 60%",
              color: critical > 0 ? "text-red-600" : "text-gray-900",
            },
            {
              label: "Matérias em atenção",
              value: attention.toString(),
              sub: "entre 60-75%",
              color: attention > 0 ? "text-yellow-600" : "text-gray-900",
            },
          ].map(({ label, value, sub, color }) => (
            <div
              key={label}
              className="bg-white rounded-xl border border-gray-200 p-4 text-center"
            >
              <p className="text-xs text-gray-400 mb-1">{label}</p>
              <p className={`text-2xl font-bold ${color ?? "text-gray-900"}`}>
                {value}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
            </div>
          ))}
        </div>

        {/* Ordenação */}
        <div className="flex items-center gap-2">
          <p className="text-sm text-gray-500 mr-2">Ordenar por:</p>
          {[
            { key: "priority",   label: "Prioridade composta" },
            { key: "difficulty", label: "Dificuldade real" },
            { key: "accuracy",   label: "Menor acerto" },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSortBy(key as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                sortBy === key
                  ? "bg-gray-900 text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:border-gray-400"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Ranking */}
        <div className="space-y-4">
          {sorted.map((s, i) => {
            const cfg  = LEVEL_CONFIG[s.level];
            const Icon = cfg.icon;
            const barWidth = Math.round((s.priorityScore / maxPriority) * 100);

            return (
              <div
                key={s.id}
                className={`bg-white rounded-2xl border-2 p-6 ${
                  i === 0 && sortBy === "priority"
                    ? "border-gray-900 shadow-md"
                    : "border-gray-200"
                }`}
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold shrink-0 ${
                        i === 0 && sortBy === "priority"
                          ? "bg-gray-900 text-white"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {i + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-gray-900 text-lg">{s.name}</p>
                        <span
                          className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color} border ${cfg.border}`}
                        >
                          <Icon className="w-3 h-3" /> {cfg.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {s.lastStudyAt
                          ? `Último estudo: ${new Date(s.lastStudyAt).toLocaleDateString("pt-BR")}`
                          : "Ainda não estudado"}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-2xl font-bold text-gray-900">{s.priorityScore}</p>
                    <p className="text-xs text-gray-400">score de prioridade</p>
                  </div>
                </div>

                {/* Barra de prioridade */}
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Prioridade relativa</span>
                    <span>{barWidth}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${cfg.bar}`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>

                {/* Métricas */}
                <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mt-4">
                  {[
                    { label: "Peso edital", value: `${s.editalWeight}/10` },
                    { label: "Criticidade", value: `${s.criticality}/10` },
                    {
                      label: "Questões",
                      value: s.totalQuestions > 0 ? s.totalQuestions.toString() : "—",
                    },
                    {
                      // ✅ FIX: exibe "—" quando accuracy é null, nunca "50%"
                      label: "% Acerto",
                      value: s.accuracy !== null ? `${s.accuracy}%` : "—",
                      color:
                        s.accuracy !== null
                          ? s.accuracy >= 70
                            ? "text-green-600"
                            : s.accuracy >= 50
                            ? "text-yellow-600"
                            : "text-red-600"
                          : "text-gray-400",
                    },
                    {
                      label: "Erros",
                      value: s.wrongQuestions > 0 ? s.wrongQuestions.toString() : "—",
                      color: s.wrongQuestions > 0 ? "text-red-600" : "",
                    },
                    { label: "Horas", value: `${s.studyHours.toFixed(1)}h` },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-gray-50 rounded-lg p-2 text-center">
                      <p className="text-xs text-gray-400">{label}</p>
                      <p className={`text-sm font-semibold ${color ?? "text-gray-900"}`}>
                        {value}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Recomendação */}
                <div
                  className={`mt-4 flex items-center justify-between p-3 rounded-xl ${cfg.bg} border ${cfg.border}`}
                >
                  <div className="flex items-start gap-2">
                    <Target className={`w-4 h-4 mt-0.5 shrink-0 ${cfg.color}`} />
                    <div>
                      <p className={`text-xs font-semibold uppercase tracking-wide ${cfg.color}`}>
                        Recomendação
                      </p>
                      <p className="text-sm font-medium text-gray-800 mt-0.5">
                        {s.recommendation}
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/sessao"
                    className="flex items-center gap-1.5 px-3 py-2 bg-gray-900 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors shrink-0"
                  >
                    Estudar <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {/* Legenda */}
        <div className="text-white rounded-2xl p-6" style={{ backgroundColor: "#1B4040" }}>
          <h3 className="font-semibold mb-3">📊 Como o score é calculado</h3>
          <div className="grid md:grid-cols-2 gap-3 text-sm text-gray-400">
            {[
              "Peso no edital (30%) — matérias mais cobradas têm prioridade maior.",
              "Criticidade (25%) — definida por você ao cadastrar a matéria.",
              "Dificuldade real (30%) — baseada na sua taxa de erros registrados.",
              "Pendências (15%) — revisões e erros no caderno aumentam a urgência.",
            ].map((t, i) => (
              <p key={i} className="flex gap-2">
                <span className="text-gray-600 shrink-0">•</span>
                {t}
              </p>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-3">
            * Quando não há questões registradas, a dificuldade real é excluída e os outros componentes redistribuem os pesos.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {Object.entries(LEVEL_CONFIG).map(([key, cfg]) => (
              <span
                key={key}
                className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full ${cfg.bg} ${cfg.color}`}
              >
                <cfg.icon className="w-3 h-3" /> {cfg.label}
                {key === "critica"   && " — abaixo de 60%"}
                {key === "atencao"   && " — entre 60-75%"}
                {key === "ok"        && " — acima de 75%"}
                {key === "sem_dados" && " — sem questões registradas"}
              </span>
            ))}
          </div>
        </div>

        {subjects.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            Cadastre matérias para gerar o ranking de prioridades.
          </div>
        )}
      </div>
    </div>
  );
}
