"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, Zap, Clock, CheckCircle2, Circle, ChevronLeft, ChevronRight } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Subject {
  id: string;
  name: string;
  editalWeight: number;
  criticality: number;
  recurrence: number;
  studyHours: number;
  totalQuestions: number;
  correctQuestions: number;
  lastStudyAt: string | null;
}

interface Review {
  completed: boolean;
  reviewDate: string;
  pdf?: { topic?: { subject?: { id: string } } };
}

interface ErrorNote {
  resolved: boolean;
  subjectId: string;
}

interface DayBlock {
  subjectId: string;
  subjectName: string;
  hours: number;
  score: number;
  priority: "alta" | "media" | "normal";
  action: string;
  pendingReviews: number;
  pendingErrors: number;
}

interface CalendarDay {
  date: Date;
  dayName: string;
  dayNum: number;
  totalHours: number;
  blocks: DayBlock[];
  isToday: boolean;
  isPast: boolean;
}

// ─── Config ──────────────────────────────────────────────────────────────────

// Carga horária por dia da semana (0=Dom, 1=Seg ... 6=Sáb)
const DAILY_HOURS: Record<number, number> = {
  0: 7.75,  // Domingo 7h45
  1: 3.25,  // Segunda 3h15
  2: 3.25,  // Terça
  3: 3.25,  // Quarta
  4: 3.25,  // Quinta
  5: 3.25,  // Sexta
  6: 6.0,   // Sábado 6h
};

const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DAY_NAMES_FULL = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

// Cor por matéria (baseado no índice na fila de score)
const SUBJECT_COLORS = [
  { bg: "bg-violet-100", text: "text-violet-800", border: "border-violet-300", dot: "bg-violet-500", badge: "bg-violet-500" },
  { bg: "bg-blue-100",   text: "text-blue-800",   border: "border-blue-300",   dot: "bg-blue-500",   badge: "bg-blue-500"   },
  { bg: "bg-amber-100",  text: "text-amber-800",  border: "border-amber-300",  dot: "bg-amber-500",  badge: "bg-amber-500"  },
  { bg: "bg-green-100",  text: "text-green-800",  border: "border-green-300",  dot: "bg-green-500",  badge: "bg-green-500"  },
  { bg: "bg-rose-100",   text: "text-rose-800",   border: "border-rose-300",   dot: "bg-rose-500",   badge: "bg-rose-500"   },
  { bg: "bg-cyan-100",   text: "text-cyan-800",   border: "border-cyan-300",   dot: "bg-cyan-500",   badge: "bg-cyan-500"   },
  { bg: "bg-orange-100", text: "text-orange-800", border: "border-orange-300", dot: "bg-orange-500", badge: "bg-orange-500" },
  { bg: "bg-pink-100",   text: "text-pink-800",   border: "border-pink-300",   dot: "bg-pink-500",   badge: "bg-pink-500"   },
];

// ─── Score calc (mesma lógica do CicloPage) ───────────────────────────────────

function calcScore(
  s: Subject,
  pendingRevs: number,
  pendingErrs: number,
  dayOffset: number // dias desde hoje (para simular lastStudyAt futuro)
): number {
  const daysSince = s.lastStudyAt
    ? Math.max(0, Math.floor((Date.now() - new Date(s.lastStudyAt).getTime()) / (1000 * 60 * 60 * 24)) + dayOffset)
    : 30 + dayOffset;
  const accuracy = s.totalQuestions > 0 ? (s.correctQuestions / s.totalQuestions) * 100 : 50;
  return (
    s.editalWeight * 10 +
    s.criticality * 8 +
    s.recurrence * 5 +
    pendingRevs * 15 +
    pendingErrs * 12 +
    daysSince * 2 +
    (100 - accuracy) * 0.5
  );
}

// ─── Calendar builder ────────────────────────────────────────────────────────

function buildWeekCalendar(
  weekOffset: number,
  subjects: Subject[],
  reviews: Review[],
  errors: ErrorNote[]
): CalendarDay[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Início da semana (segunda-feira)
  const startOfWeek = new Date(today);
  const dayOfWeek = today.getDay(); // 0=Dom
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  startOfWeek.setDate(today.getDate() + diffToMonday + weekOffset * 7);

  const days: CalendarDay[] = [];

  // Gerar os 7 dias (Seg→Dom)
  for (let d = 0; d < 7; d++) {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + d);
    date.setHours(0, 0, 0, 0);

    const dayIndex = date.getDay(); // 0=Dom
    const totalHours = DAILY_HOURS[dayIndex];
    const dayOffset = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const isPast = date < today;
    const isToday = date.getTime() === today.getTime();

    // Calcular score de cada matéria para este dia
    const scored = subjects
      .map((s) => {
        const pendingRevs = reviews.filter(
          (r) => !r.completed && r.pdf?.topic?.subject?.id === s.id
        ).length;
        const pendingErrs = errors.filter((e) => !e.resolved && e.subjectId === s.id).length;
        const score = calcScore(s, pendingRevs, pendingErrs, Math.max(0, dayOffset));
        const accuracy = s.totalQuestions > 0 ? Math.round((s.correctQuestions / s.totalQuestions) * 100) : 50;
        const action =
          pendingRevs > 0
            ? `${pendingRevs} revisão${pendingRevs > 1 ? "ões" : ""} pendente${pendingRevs > 1 ? "s" : ""}`
            : pendingErrs > 0
            ? `${pendingErrs} erro${pendingErrs > 1 ? "s" : ""} no caderno`
            : accuracy < 60
            ? "Foco em exercícios"
            : "Avançar leitura";

        const priority: "alta" | "media" | "normal" =
          score > 300 ? "alta" : score > 200 ? "media" : "normal";

        return { s, score, pendingRevs, pendingErrs, action, priority };
      })
      .sort((a, b) => b.score - a.score);

    // Distribuir horas do dia entre as matérias com maior score
    // Domingo e Sábado: até 3 matérias. Dia útil: até 2 matérias.
    const maxSubjects = dayIndex === 0 || dayIndex === 6 ? 3 : 2;
    const topSubjects = scored.slice(0, maxSubjects);
    const totalScore = topSubjects.reduce((sum, x) => sum + x.score, 0);

    const blocks: DayBlock[] = topSubjects.map((x, i) => ({
      subjectId: x.s.id,
      subjectName: x.s.name,
      hours: totalScore > 0 ? parseFloat(((x.score / totalScore) * totalHours).toFixed(2)) : totalHours / maxSubjects,
      score: Math.round(x.score),
      priority: x.priority,
      action: x.action,
      pendingReviews: x.pendingRevs,
      pendingErrors: x.pendingErrs,
    }));

    days.push({
      date,
      dayName: DAY_NAMES[dayIndex],
      dayNum: date.getDate(),
      totalHours,
      blocks,
      isToday,
      isPast,
    });
  }

  return days;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function CalendarioCicloPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [errors, setErrors] = useState<ErrorNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/subjects").then((r) => r.json()).catch(() => []),
      fetch("/api/reviews").then((r) => r.json()).catch(() => []),
      fetch("/api/error-notes").then((r) => r.json()).catch(() => []),
    ]).then(([subjectsRaw, reviewsRaw, errorsRaw]) => {
      const list = Array.isArray(subjectsRaw) ? subjectsRaw : subjectsRaw?.subjects ?? [];
      setSubjects(list);
      setReviews(Array.isArray(reviewsRaw) ? reviewsRaw : []);
      setErrors(Array.isArray(errorsRaw) ? errorsRaw : []);
    }).finally(() => setLoading(false));
  }, []);

  const calendar = buildWeekCalendar(weekOffset, subjects, reviews, errors);

  // Mapa de cores por subject (estável)
  const subjectColorMap = new Map<string, (typeof SUBJECT_COLORS)[0]>();
  subjects.forEach((s, i) => {
    subjectColorMap.set(s.id, SUBJECT_COLORS[i % SUBJECT_COLORS.length]);
  });

  const totalWeekHours = Object.values(DAILY_HOURS).reduce((a, b) => a + b, 0);

  const weekLabel = (() => {
    const first = calendar[0]?.date;
    const last = calendar[6]?.date;
    if (!first || !last) return "";
    const fmt = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
    return `${fmt(first)} – ${fmt(last)}`;
  })();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gray-950 text-white px-8 py-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <CalendarDays className="w-6 h-6 text-gray-400" />
              <h1 className="text-3xl font-bold">Calendário do Ciclo</h1>
            </div>
            <p className="text-gray-400 text-sm">
              Distribuição automática por score de prioridade — {totalWeekHours.toFixed(1)}h semanais
            </p>
          </div>
          <Link
            href="/ciclo-inteligente"
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <Zap className="w-4 h-4" />
            Ver fila de prioridade
          </Link>
        </div>

        {/* Navegação de semana */}
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={() => { setWeekOffset((w) => w - 1); setSelectedDay(null); }}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Semana anterior
          </button>
          <div className="text-center">
            <p className="text-sm font-semibold">{weekLabel}</p>
            {weekOffset === 0 && (
              <p className="text-xs text-gray-400 mt-0.5">Semana atual</p>
            )}
            {weekOffset !== 0 && (
              <button
                onClick={() => { setWeekOffset(0); setSelectedDay(null); }}
                className="text-xs text-gray-400 hover:text-white underline mt-0.5 transition-colors"
              >
                Voltar para hoje
              </button>
            )}
          </div>
          <button
            onClick={() => { setWeekOffset((w) => w + 1); setSelectedDay(null); }}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors"
          >
            Próxima semana <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Legenda de matérias */}
        {subjects.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {subjects.map((s) => {
              const color = subjectColorMap.get(s.id);
              return (
                <span
                  key={s.id}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${color?.bg} ${color?.text}`}
                >
                  <span className={`w-2 h-2 rounded-full ${color?.dot}`} />
                  {s.name}
                </span>
              );
            })}
          </div>
        )}

        {/* Grid semanal */}
        <div className="grid grid-cols-7 gap-2 mb-6">
          {calendar.map((day, i) => {
            const isSelected = selectedDay?.date.getTime() === day.date.getTime();
            return (
              <button
                key={i}
                onClick={() => setSelectedDay(isSelected ? null : day)}
                className={`
                  relative flex flex-col items-center rounded-2xl border-2 p-2 transition-all text-left
                  ${day.isToday ? "border-gray-900 shadow-md" : isSelected ? "border-gray-400" : "border-gray-200 hover:border-gray-300"}
                  ${day.isPast ? "opacity-60" : ""}
                  bg-white cursor-pointer
                `}
              >
                {/* Dia */}
                <p className={`text-xs font-semibold uppercase tracking-wide ${day.isToday ? "text-gray-900" : "text-gray-400"}`}>
                  {day.dayName}
                </p>
                <div className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold mt-0.5 mb-2 ${day.isToday ? "bg-gray-900 text-white" : "text-gray-700"}`}>
                  {day.dayNum}
                </div>

                {/* Blocos de matéria (compacto) */}
                <div className="w-full space-y-1">
                  {day.blocks.map((block) => {
                    const color = subjectColorMap.get(block.subjectId);
                    return (
                      <div
                        key={block.subjectId}
                        className={`w-full rounded-lg px-1.5 py-1 ${color?.bg}`}
                      >
                        <p className={`text-[10px] font-semibold leading-tight truncate ${color?.text}`}>
                          {block.subjectName}
                        </p>
                        <p className={`text-[10px] ${color?.text} opacity-70`}>
                          {block.hours.toFixed(1)}h
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Horas totais */}
                <p className="text-[10px] text-gray-400 mt-2 font-medium">
                  {day.totalHours.toFixed(1)}h
                </p>

                {/* Indicador hoje */}
                {day.isToday && (
                  <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-[9px] bg-gray-900 text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
                    Hoje
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Detalhe do dia selecionado */}
        {selectedDay && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 animate-in fade-in duration-200">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {DAY_NAMES_FULL[selectedDay.date.getDay()]} — {selectedDay.date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })}
                </h2>
                <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {selectedDay.totalHours.toFixed(1)}h de estudo programadas
                </p>
              </div>
              {selectedDay.isToday && (
                <Link
                  href="/sessao"
                  className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-700 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  <Zap className="w-4 h-4" /> Começar agora
                </Link>
              )}
            </div>

            <div className="space-y-3">
              {selectedDay.blocks.map((block, i) => {
                const color = subjectColorMap.get(block.subjectId);
                const pct = Math.round((block.hours / selectedDay.totalHours) * 100);
                return (
                  <div key={block.subjectId} className={`rounded-xl border p-4 ${color?.bg} ${color?.border}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white ${color?.badge}`}>
                          {i + 1}º
                        </div>
                        <div>
                          <p className={`font-bold ${color?.text}`}>{block.subjectName}</p>
                          <p className={`text-xs mt-0.5 ${color?.text} opacity-70`}>{block.action}</p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-lg font-bold ${color?.text}`}>{block.hours.toFixed(1)}h</p>
                        <p className={`text-xs ${color?.text} opacity-60`}>{pct}% do dia</p>
                      </div>
                    </div>

                    {/* Barra de proporção */}
                    <div className="mt-3 h-1.5 bg-white/50 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${color?.badge} opacity-70`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    {/* Badges de pendências */}
                    {(block.pendingReviews > 0 || block.pendingErrors > 0) && (
                      <div className="flex gap-2 mt-3">
                        {block.pendingReviews > 0 && (
                          <span className="text-xs bg-white/60 px-2 py-0.5 rounded-full font-medium text-gray-700">
                            📋 {block.pendingReviews} revisão{block.pendingReviews > 1 ? "ões" : ""}
                          </span>
                        )}
                        {block.pendingErrors > 0 && (
                          <span className="text-xs bg-white/60 px-2 py-0.5 rounded-full font-medium text-gray-700">
                            ⚠️ {block.pendingErrors} erro{block.pendingErrors > 1 ? "s" : ""} pendente{block.pendingErrors > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Score */}
                    <p className={`text-xs mt-2 ${color?.text} opacity-50`}>
                      Score de prioridade: {block.score}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Resumo da semana */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Horas na semana", value: `${totalWeekHours.toFixed(1)}h` },
            { label: "Dias com estudo", value: "7 dias" },
            { label: "Matérias no ciclo", value: `${subjects.length}` },
            { label: "Carga média/dia", value: `${(totalWeekHours / 7).toFixed(1)}h` },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-400 mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* Info sobre o algoritmo */}
        <div className="bg-gray-950 text-white rounded-2xl p-6">
          <h3 className="font-semibold mb-3">⚡ Como o calendário é calculado</h3>
          <div className="grid md:grid-cols-2 gap-3 text-sm text-gray-400">
            {[
              "O score combina peso no edital, criticidade, revisões pendentes, erros no caderno e dias sem estudar.",
              "Matérias com maior score recebem mais horas no dia — proporcionalmente ao score acumulado.",
              "Dias úteis têm 3h15 com até 2 matérias. Sábado 6h e Domingo 7h45 com até 3 matérias.",
              "Clique em qualquer dia do calendário para ver o plano detalhado com ações recomendadas.",
            ].map((t, i) => (
              <p key={i} className="flex gap-2">
                <span className="text-gray-600 shrink-0">•</span> {t}
              </p>
            ))}
          </div>
        </div>

        {subjects.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            Cadastre matérias para gerar o calendário do ciclo.
          </div>
        )}
      </div>
    </div>
  );
}
