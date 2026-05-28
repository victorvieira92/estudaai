"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  TrendingUp, AlertTriangle, CheckCircle,
  Target, Zap, BookOpen, ArrowRight,
} from "lucide-react";

interface SubjectPriority {
  id: string; name: string; editalWeight: number; criticality: number;
  studyHours: number; totalQuestions: number; correctQuestions: number; wrongQuestions: number;
  accuracy: number | null; errorRate: number | null;
  pendingErrors: number; pendingReviews: number; lastStudyAt: string | null;
  difficultyScore: number; priorityScore: number;
  level: "critica" | "atencao" | "ok" | "sem_dados";
  recommendation: string;
}

function fmtH(h: number) {
  const hh = Math.floor(h); const mm = Math.round((h - hh) * 60);
  return mm > 0 ? `${hh}h${mm.toString().padStart(2,"0")}min` : `${hh}h`;
}

function calcPriority(s: any, pendingRevs: number, pendingErrs: number): SubjectPriority {
  const totalQ   = s.totalQuestions   ?? 0;
  const correctQ = s.correctQuestions ?? 0;
  const wrongQ   = s.wrongQuestions   ?? 0;
  const hasData  = totalQ > 0;

  const accuracy:  number | null = hasData ? Math.round((correctQ / totalQ) * 100) : null;
  const errorRate: number | null = hasData ? Math.round((wrongQ   / totalQ) * 100) : null;

  const difficultyScore = hasData
    ? Math.round(errorRate! * 0.7 + (100 - Math.min((s.studyHours ?? 0) * 5, 100)) * 0.3)
    : 0;

  const pendingFactor = Math.min((pendingRevs + pendingErrs) * 2, 15);
  let priorityScore: number;

  if (hasData) {
    priorityScore = Math.round(
      (s.editalWeight / 10) * 30 +
      (s.criticality  / 10) * 25 +
      (difficultyScore / 100) * 30 +
      pendingFactor
    );
  } else {
    priorityScore = Math.round(
      (s.editalWeight / 10) * 43 +
      (s.criticality  / 10) * 36 +
      Math.min((pendingRevs + pendingErrs) * 2, 21)
    );
  }

  let level: SubjectPriority["level"] = "sem_dados";
  if (hasData) {
    if (accuracy! < 60)      level = "critica";
    else if (accuracy! < 75) level = "atencao";
    else                     level = "ok";
  }

  let recommendation = "";
  if (level === "sem_dados")  recommendation = "Comece a registrar questões para gerar métricas";
  else if (level === "critica") recommendation = `Taxa de erro de ${errorRate}% — foque em revisão e caderno de erros`;
  else if (level === "atencao") recommendation = `${errorRate}% de erro — continue praticando, ainda há margem`;
  else                          recommendation = `${accuracy}% de acerto — manter ritmo e avançar conteúdo`;

  return {
    id: s.id, name: s.name, editalWeight: s.editalWeight, criticality: s.criticality,
    studyHours: s.studyHours ?? 0, totalQuestions: totalQ,
    correctQuestions: correctQ, wrongQuestions: wrongQ,
    accuracy, errorRate, pendingErrors: pendingErrs, pendingReviews: pendingRevs,
    lastStudyAt: s.lastStudyAt, difficultyScore, priorityScore, level, recommendation,
  };
}

const LEVEL_CONFIG = {
  critica:   { label: "Crítica",   color: "text-red-600",    bg: "bg-red-50",    border: "border-red-200",    bar: "bg-red-500",    icon: AlertTriangle },
  atencao:   { label: "Atenção",   color: "text-yellow-600", bg: "bg-yellow-50", border: "border-yellow-200", bar: "bg-yellow-500", icon: AlertTriangle },
  ok:        { label: "Em dia",    color: "text-green-600",  bg: "bg-green-50",  border: "border-green-200",  bar: "bg-green-500",  icon: CheckCircle   },
  sem_dados: { label: "Sem dados", color: "text-gray-400",   bg: "bg-gray-50",   border: "border-gray-200",   bar: "bg-gray-300",   icon: BookOpen      },
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export default function PrioridadesPage() {
  const [subjects, setSubjects] = useState<SubjectPriority[]>([]);
  const [loading, setLoading]   = useState(true);
  const [sortBy, setSortBy]     = useState<"priority" | "difficulty" | "accuracy">("priority");

  useEffect(() => {
    Promise.all([
      fetch("/api/subjects").then(r => r.json()).catch(() => []),
      fetch("/api/reviews").then(r => r.json()).catch(() => []),
      fetch("/api/error-notes").then(r => r.json()).catch(() => []),
      // ← Busca StudySessions para calcular métricas reais (não depende do cache do Subject)
      fetch("/api/historico").then(r => r.json()).catch(() => []),
    ]).then(([subjectsRaw, reviewsRaw, errorsRaw, historicoRaw]) => {
      const list    = Array.isArray(subjectsRaw) ? subjectsRaw : (subjectsRaw?.subjects ?? []);
      const reviews = Array.isArray(reviewsRaw)  ? reviewsRaw  : [];
      const errors  = Array.isArray(errorsRaw)   ? errorsRaw   : [];

      // Flatten todas as sessões do histórico
      const allSessions: any[] = Array.isArray(historicoRaw)
        ? historicoRaw.flatMap((d: any) => d.sessions ?? [])
        : [];

      const scored = list.map((s: any) => {
        // Calcula métricas direto das StudySessions (fonte correta — não o cache do Subject)
        const subjectSessions = allSessions.filter((ss: any) => ss.subjectId === s.id);
        const totalQuestions   = subjectSessions.reduce((a: number, ss: any) => a + (ss.questions ?? 0), 0);
        const correctQuestions = subjectSessions.reduce((a: number, ss: any) => a + (ss.correct ?? 0), 0);
        const wrongQuestions   = subjectSessions.reduce((a: number, ss: any) => a + (ss.wrong ?? 0), 0);
        const studyHours       = subjectSessions.reduce((a: number, ss: any) => a + (ss.hours ?? 0), 0);
        const lastStudyAt      = subjectSessions.length > 0
          ? subjectSessions.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0].createdAt
          : s.lastStudyAt;

        const pendingRevs = reviews.filter(
          (r: any) => !r.completed && r.pdf?.topic?.subject?.id === s.id
        ).length;
        const pendingErrs = errors.filter(
          (e: any) => !e.resolved && e.subjectId === s.id
        ).length;

        return calcPriority(
          { ...s, totalQuestions, correctQuestions, wrongQuestions, studyHours, lastStudyAt },
          pendingRevs, pendingErrs
        );
      });

      setSubjects(scored);
    }).finally(() => setLoading(false));
  }, []);

  const sorted = [...subjects].sort((a, b) => {
    if (sortBy === "priority")   return b.priorityScore - a.priorityScore;
    if (sortBy === "difficulty") return b.difficultyScore - a.difficultyScore;
    if (sortBy === "accuracy") {
      const aVal = a.accuracy !== null ? a.accuracy : 101;
      const bVal = b.accuracy !== null ? b.accuracy : 101;
      return aVal - bVal;
    }
    return 0;
  });

  const maxPriority    = Math.max(...sorted.map(s => s.priorityScore), 1);
  const totalQuestions = subjects.reduce((a, s) => a + s.totalQuestions, 0);
  const totalCorrect   = subjects.reduce((a, s) => a + s.correctQuestions, 0);
  const globalAccuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : null;
  const critical       = subjects.filter(s => s.level === "critica").length;
  const attention      = subjects.filter(s => s.level === "atencao").length;

  if (loading) return (
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
          <Link href="/ciclo"
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-xl transition-colors">
            <Zap className="w-4 h-4 text-yellow-400" />
            Ver ciclo de estudos
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total de questões", value: totalQuestions, sub: "registradas",    color: "text-gray-900" },
            { label: "Acurácia global",   value: globalAccuracy !== null ? `${globalAccuracy}%` : "—",
              sub: globalAccuracy !== null ? (globalAccuracy >= 75 ? "✓ Boa" : globalAccuracy >= 60 ? "⚠ Regular" : "✗ Crítica") : "sem dados",
              color: globalAccuracy !== null ? (globalAccuracy >= 75 ? "text-green-600" : globalAccuracy >= 60 ? "text-yellow-600" : "text-red-600") : "text-gray-400" },
            { label: "Matérias críticas", value: critical,  sub: "abaixo de 60%",  color: critical  > 0 ? "text-red-600"    : "text-gray-900" },
            { label: "Matérias em atenção", value: attention, sub: "entre 60-75%", color: attention > 0 ? "text-yellow-600" : "text-gray-900" },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">{label}</p>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
            </div>
          ))}
        </div>

        {/* Ordenação */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-gray-500">Ordenar por:</span>
          {([
            ["priority",   "Prioridade composta"],
            ["difficulty", "Dificuldade real"],
            ["accuracy",   "Menor acerto"],
          ] as const).map(([key, label]) => (
            <button key={key} onClick={() => setSortBy(key)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                sortBy === key ? "bg-gray-900 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* Lista de matérias */}
        <div className="space-y-4">
          {sorted.map((s, idx) => {
            const cfg = LEVEL_CONFIG[s.level];
            const LevelIcon = cfg.icon;
            const relPct = Math.round((s.priorityScore / maxPriority) * 100);

            return (
              <div key={s.id} className={`bg-white rounded-2xl border ${cfg.border} overflow-hidden`}>
                <div className="p-5">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 rounded-full bg-gray-900 text-white text-sm font-bold flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-gray-900">{s.name}</h3>
                          <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                            <LevelIcon className="w-3 h-3" />
                            {cfg.label}
                          </span>
                        </div>
                        {s.lastStudyAt && (
                          <p className="text-xs text-gray-400 mt-0.5">Último estudo: {fmtDate(s.lastStudyAt)}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-2xl font-bold text-gray-900">{s.priorityScore}</p>
                      <p className="text-xs text-gray-400">score de prioridade</p>
                    </div>
                  </div>

                  {/* Barra de prioridade relativa */}
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>Prioridade relativa</span>
                      <span>{relPct}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${cfg.bar} transition-all`} style={{ width: `${relPct}%` }} />
                    </div>
                  </div>

                  {/* Métricas */}
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-4">
                    {[
                      { label: "Peso edital",  value: `${s.editalWeight}/10` },
                      { label: "Criticidade",  value: `${s.criticality}/10` },
                      { label: "Questões",     value: s.totalQuestions > 0 ? s.totalQuestions : "—" },
                      { label: "% Acerto",     value: s.accuracy  !== null ? <span className={s.accuracy  < 60 ? "text-red-600" : s.accuracy  < 75 ? "text-yellow-600" : "text-green-600"}>{s.accuracy}%</span>  : "—" },
                      { label: "Erros",        value: s.wrongQuestions > 0 ? s.wrongQuestions : "—" },
                      { label: "Horas",        value: s.studyHours > 0 ? fmtH(s.studyHours) : "0h" },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <p className="text-xs text-gray-400">{label}</p>
                        <p className="font-semibold text-gray-900 text-sm mt-0.5">{value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Recomendação + botão */}
                  <div className={`flex items-center justify-between gap-3 rounded-xl px-4 py-3 ${cfg.bg}`}>
                    <div className="flex items-start gap-2">
                      <Target className={`w-4 h-4 mt-0.5 shrink-0 ${cfg.color}`} />
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">Recomendação</p>
                        <p className="text-sm text-gray-700">{s.recommendation}</p>
                      </div>
                    </div>
                    <Link href="/sessao"
                      className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 hover:bg-gray-700 text-white text-xs font-bold rounded-xl transition-colors shrink-0">
                      Estudar <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}

          {sorted.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
              <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Nenhuma matéria cadastrada ainda.</p>
              <Link href="/materias" className="text-sm text-gray-900 font-medium underline mt-2 inline-block">
                Cadastrar matérias
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
