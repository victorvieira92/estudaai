"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarDays, Zap, Clock, ChevronLeft, ChevronRight, Settings, Check, X
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Subject {
  id: string; name: string; editalWeight: number; criticality: number;
  recurrence: number; studyHours: number; totalQuestions: number;
  correctQuestions: number; lastStudyAt: string | null;
}
interface Review { completed: boolean; pdf?: { topic?: { subject?: { id: string } } }; }
interface ErrorNote { resolved: boolean; subjectId: string; }
interface CycleConfig {
  sun: number | null; mon: number | null; tue: number | null;
  wed: number | null; thu: number | null; fri: number | null; sat: number | null;
}
interface DayBlock {
  subjectId: string; subjectName: string; hours: number; score: number;
  priority: "alta" | "media" | "normal"; action: string;
  pendingReviews: number; pendingErrors: number;
}
interface CalendarDay {
  date: Date; dayName: string; dayNum: number; totalHours: number;
  blocks: DayBlock[]; isToday: boolean; isPast: boolean; isOff: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_KEYS: (keyof CycleConfig)[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_NAMES_SHORT = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const DAY_NAMES_FULL = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
// Mapeamento: índice do grid (0=Seg) → getDay() (0=Dom)
const GRID_TO_GETDAY = [1, 2, 3, 4, 5, 6, 0];

const DEFAULT_CONFIG: CycleConfig = {
  mon: 3.25, tue: 3.25, wed: 3.25, thu: 3.25, fri: 3.25, sat: 6.0, sun: 7.75,
};

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function configToHoursArray(config: CycleConfig): (number | null)[] {
  // Retorna [seg, ter, qua, qui, sex, sab, dom]
  return [config.mon, config.tue, config.wed, config.thu, config.fri, config.sat, config.sun];
}

function calcScore(s: Subject, pendingRevs: number, pendingErrs: number, dayOffset: number): number {
  const daysSince = s.lastStudyAt
    ? Math.max(0, Math.floor((Date.now() - new Date(s.lastStudyAt).getTime()) / 86400000) + dayOffset)
    : 30 + dayOffset;
  const accuracy = s.totalQuestions > 0 ? (s.correctQuestions / s.totalQuestions) * 100 : 50;
  return (
    s.editalWeight * 10 + s.criticality * 8 + s.recurrence * 5 +
    pendingRevs * 15 + pendingErrs * 12 + daysSince * 2 + (100 - accuracy) * 0.5
  );
}

function buildCalendar(
  weekOffset: number, subjects: Subject[], reviews: Review[],
  errors: ErrorNote[], hoursArray: (number | null)[]
): CalendarDay[] {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dayOfWeek = today.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() + diffToMonday + weekOffset * 7);

  return DAY_KEYS.map((_, i) => {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    date.setHours(0, 0, 0, 0);

    const totalHours = hoursArray[i];
    const isOff = totalHours == null || totalHours <= 0;
    const dayOffset = Math.floor((date.getTime() - today.getTime()) / 86400000);
    const isPast = date < today;
    const isToday = date.getTime() === today.getTime();

    const blocks: DayBlock[] = [];
    if (!isOff && totalHours) {
      const maxSubjects = i >= 5 ? 3 : 2; // sáb/dom até 3
      const scored = subjects.map((s) => {
        const pendingRevs = reviews.filter((r) => !r.completed && r.pdf?.topic?.subject?.id === s.id).length;
        const pendingErrs = errors.filter((e) => !e.resolved && e.subjectId === s.id).length;
        const score = calcScore(s, pendingRevs, pendingErrs, Math.max(0, dayOffset));
        const accuracy = s.totalQuestions > 0 ? Math.round((s.correctQuestions / s.totalQuestions) * 100) : 50;
        const action =
          pendingRevs > 0 ? `${pendingRevs} revisão${pendingRevs > 1 ? "ões" : ""} pendente${pendingRevs > 1 ? "s" : ""}` :
          pendingErrs > 0 ? `${pendingErrs} erro${pendingErrs > 1 ? "s" : ""} no caderno` :
          accuracy < 60 ? "Foco em exercícios" : "Avançar leitura";
        const priority: "alta" | "media" | "normal" = score > 300 ? "alta" : score > 200 ? "media" : "normal";
        return { s, score, pendingRevs, pendingErrs, action, priority };
      }).sort((a, b) => b.score - a.score).slice(0, maxSubjects);

      const totalScore = scored.reduce((sum, x) => sum + x.score, 0);
      scored.forEach((x) => {
        blocks.push({
          subjectId: x.s.id, subjectName: x.s.name,
          hours: totalScore > 0 ? parseFloat(((x.score / totalScore) * totalHours).toFixed(2)) : totalHours / scored.length,
          score: Math.round(x.score), priority: x.priority, action: x.action,
          pendingReviews: x.pendingRevs, pendingErrors: x.pendingErrs,
        });
      });
    }

    return {
      date, dayName: DAY_NAMES_SHORT[i], dayNum: date.getDate(),
      totalHours: totalHours ?? 0, blocks, isToday, isPast, isOff,
    };
  });
}

function formatHours(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  if (mm === 0) return `${hh}h`;
  return `${hh}h${mm.toString().padStart(2, "0")}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function CalendarioCicloPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [errors, setErrors] = useState<ErrorNote[]>([]);
  const [config, setConfig] = useState<CycleConfig>(DEFAULT_CONFIG);
  const [draftConfig, setDraftConfig] = useState<CycleConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/subjects").then((r) => r.json()).catch(() => []),
      fetch("/api/reviews").then((r) => r.json()).catch(() => []),
      fetch("/api/error-notes").then((r) => r.json()).catch(() => []),
      fetch("/api/cycle-config").then((r) => r.json()).catch(() => null),
    ]).then(([subjectsRaw, reviewsRaw, errorsRaw, configRaw]) => {
      const list = Array.isArray(subjectsRaw) ? subjectsRaw : subjectsRaw?.subjects ?? [];
      setSubjects(list);
      setReviews(Array.isArray(reviewsRaw) ? reviewsRaw : []);
      setErrors(Array.isArray(errorsRaw) ? errorsRaw : []);
      if (configRaw && configRaw.mon !== undefined) {
        setConfig(configRaw);
        setDraftConfig(configRaw);
      } else {
        // Primeira vez: mostrar config para o usuário configurar
        setShowConfig(true);
      }
    }).finally(() => setLoading(false));
  }, []);

  const saveConfig = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/cycle-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftConfig),
      });
      if (res.ok) {
        setConfig(draftConfig);
        setShowConfig(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const hoursArray = configToHoursArray(config);
  const calendar = buildCalendar(weekOffset, subjects, reviews, errors, hoursArray);
  const totalWeekHours = hoursArray.reduce((a, h) => a + (h ?? 0), 0);

  const subjectColorMap = new Map<string, typeof SUBJECT_COLORS[0]>();
  subjects.forEach((s, i) => subjectColorMap.set(s.id, SUBJECT_COLORS[i % SUBJECT_COLORS.length]));

  const weekLabel = (() => {
    const first = calendar[0]?.date;
    const last = calendar[6]?.date;
    if (!first || !last) return "";
    return `${first.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} – ${last.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}`;
  })();

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
    </div>
  );

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
              Distribuição automática por score de prioridade — {formatHours(totalWeekHours)} semanais
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setDraftConfig(config); setShowConfig(!showConfig); setSelectedDay(null); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${showConfig ? "bg-white text-gray-900" : "bg-gray-800 hover:bg-gray-700 text-white"}`}
            >
              <Settings className="w-4 h-4" />
              {showConfig ? "Fechar config" : "Configurar ciclo"}
            </button>
            <Link href="/ciclo" className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-xl transition-colors">
              <Zap className="w-4 h-4" /> Fila de prioridade
            </Link>
          </div>
        </div>

        {/* Navegação de semana */}
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={() => { setWeekOffset((w) => w - 1); setSelectedDay(null); }}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Anterior
          </button>
          <div className="text-center">
            <p className="text-sm font-semibold">{weekLabel}</p>
            {weekOffset === 0
              ? <p className="text-xs text-gray-400 mt-0.5">Semana atual</p>
              : <button onClick={() => { setWeekOffset(0); setSelectedDay(null); }} className="text-xs text-gray-400 hover:text-white underline mt-0.5 transition-colors">Voltar para hoje</button>
            }
          </div>
          <button
            onClick={() => { setWeekOffset((w) => w + 1); setSelectedDay(null); }}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors"
          >
            Próxima <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* ── Painel de configuração ── */}
        {showConfig && (
          <div className="bg-white rounded-2xl border-2 border-gray-900 p-6 mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Configure seu ciclo semanal</h2>
            <p className="text-sm text-gray-500 mb-5">
              Defina quantas horas você estuda em cada dia. Deixe em branco ou zero para dias sem estudo.
            </p>
            <div className="grid grid-cols-7 gap-3">
              {DAY_KEYS.map((key, i) => {
                const val = draftConfig[key];
                const isActive = val != null && val > 0;
                return (
                  <div key={key} className="flex flex-col items-center gap-2">
                    <button
                      onClick={() => setDraftConfig((d) => ({
                        ...d,
                        [key]: isActive ? null : (DEFAULT_CONFIG[key] ?? 3.25),
                      }))}
                      className={`w-full py-2 rounded-xl text-xs font-bold transition-colors ${isActive ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-400 hover:bg-gray-200"}`}
                    >
                      {DAY_NAMES_SHORT[i]}
                    </button>
                    {isActive ? (
                      <input
                        type="number" min="0.5" max="16" step="0.25"
                        value={val ?? ""}
                        onChange={(e) => setDraftConfig((d) => ({ ...d, [key]: parseFloat(e.target.value) || null }))}
                        className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-gray-900"
                      />
                    ) : (
                      <div className="w-full border border-dashed border-gray-200 rounded-lg py-1.5 text-center text-xs text-gray-300">
                        Folga
                      </div>
                    )}
                    {isActive && val && (
                      <p className="text-xs text-gray-400">{formatHours(val)}</p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Total semanal */}
            <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4">
              <div>
                <p className="text-sm text-gray-500">Total semanal</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatHours(DAY_KEYS.reduce((a, k) => a + (draftConfig[k] ?? 0), 0))}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setDraftConfig(config); setShowConfig(false); }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors"
                >
                  <X className="w-4 h-4" /> Cancelar
                </button>
                <button
                  onClick={saveConfig}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 hover:bg-gray-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  {saving ? "Salvando..." : "Salvar ciclo"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Legenda de matérias */}
        {subjects.length > 0 && !showConfig && (
          <div className="flex flex-wrap gap-2 mb-6">
            {subjects.map((s) => {
              const color = subjectColorMap.get(s.id);
              return (
                <span key={s.id} className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${color?.bg} ${color?.text}`}>
                  <span className={`w-2 h-2 rounded-full ${color?.dot}`} />
                  {s.name}
                </span>
              );
            })}
          </div>
        )}

        {/* ── Grid semanal ── */}
        {!showConfig && (
          <>
            <div className="grid grid-cols-7 gap-2 mb-6">
              {calendar.map((day, i) => {
                const isSelected = selectedDay?.date.getTime() === day.date.getTime();
                return (
                  <button
                    key={i}
                    onClick={() => !day.isOff && setSelectedDay(isSelected ? null : day)}
                    className={`
                      relative flex flex-col items-center rounded-2xl border-2 p-2 transition-all
                      ${day.isToday ? "border-gray-900 shadow-md" : isSelected ? "border-gray-400" : "border-gray-200 hover:border-gray-300"}
                      ${day.isPast && !day.isToday ? "opacity-60" : ""}
                      ${day.isOff ? "bg-gray-50 cursor-default" : "bg-white cursor-pointer"}
                    `}
                  >
                    <p className={`text-xs font-semibold uppercase tracking-wide ${day.isToday ? "text-gray-900" : "text-gray-400"}`}>
                      {day.dayName}
                    </p>
                    <div className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold mt-0.5 mb-2 ${day.isToday ? "bg-gray-900 text-white" : "text-gray-700"}`}>
                      {day.dayNum}
                    </div>

                    {day.isOff ? (
                      <p className="text-[10px] text-gray-300 font-medium">Folga</p>
                    ) : (
                      <>
                        <div className="w-full space-y-1">
                          {day.blocks.map((block) => {
                            const color = subjectColorMap.get(block.subjectId);
                            return (
                              <div key={block.subjectId} className={`w-full rounded-lg px-1.5 py-1 ${color?.bg}`}>
                                <p className={`text-[10px] font-semibold leading-tight truncate ${color?.text}`}>{block.subjectName}</p>
                                <p className={`text-[10px] ${color?.text} opacity-70`}>{formatHours(block.hours)}</p>
                              </div>
                            );
                          })}
                        </div>
                        <p className="text-[10px] text-gray-400 mt-2 font-medium">{formatHours(day.totalHours)}</p>
                      </>
                    )}

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
              <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      {DAY_NAMES_FULL[calendar.findIndex((d) => d.date.getTime() === selectedDay.date.getTime())]} — {selectedDay.date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })}
                    </h2>
                    <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {formatHours(selectedDay.totalHours)} de estudo programadas
                    </p>
                  </div>
                  {selectedDay.isToday && (
                    <Link href="/sessao" className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-700 text-white text-sm font-semibold rounded-xl transition-colors">
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
                            <p className={`text-lg font-bold ${color?.text}`}>{formatHours(block.hours)}</p>
                            <p className={`text-xs ${color?.text} opacity-60`}>{pct}% do dia</p>
                          </div>
                        </div>
                        <div className="mt-3 h-1.5 bg-white/50 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${color?.badge} opacity-70`} style={{ width: `${pct}%` }} />
                        </div>
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
                        <p className={`text-xs mt-2 ${color?.text} opacity-50`}>Score de prioridade: {block.score}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Resumo da semana */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: "Horas na semana", value: formatHours(totalWeekHours) },
                { label: "Dias com estudo", value: `${hoursArray.filter(Boolean).length} dias` },
                { label: "Matérias no ciclo", value: `${subjects.length}` },
                { label: "Carga média/dia", value: hoursArray.filter(Boolean).length > 0 ? formatHours(totalWeekHours / hoursArray.filter(Boolean).length) : "—" },
              ].map(({ label, value }) => (
                <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">{value}</p>
                  <p className="text-xs text-gray-400 mt-1">{label}</p>
                </div>
              ))}
            </div>

            {/* Info */}
            <div className="bg-gray-950 text-white rounded-2xl p-6">
              <h3 className="font-semibold mb-3">⚡ Como o calendário é calculado</h3>
              <div className="grid md:grid-cols-2 gap-3 text-sm text-gray-400">
                {[
                  "O score combina peso no edital, criticidade, revisões pendentes, erros no caderno e dias sem estudar.",
                  "Matérias com maior score recebem mais horas no dia — proporcionalmente ao score acumulado.",
                  "Cada usuário configura seus próprios dias e horas de estudo clicando em 'Configurar ciclo'.",
                  "Clique em qualquer dia do calendário para ver o plano detalhado com ações recomendadas.",
                ].map((t, i) => (
                  <p key={i} className="flex gap-2"><span className="text-gray-600 shrink-0">•</span> {t}</p>
                ))}
              </div>
            </div>
          </>
        )}

        {subjects.length === 0 && !showConfig && (
          <div className="text-center py-12 text-gray-400">
            Cadastre matérias para gerar o calendário do ciclo.
          </div>
        )}
      </div>
    </div>
  );
}
