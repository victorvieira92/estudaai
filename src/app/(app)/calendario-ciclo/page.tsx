"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarDays, Zap, Plus, Trash2, Check, X, Settings,
  ChevronLeft, ChevronRight,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Subject { id: string; name: string; }

interface StudyBlock {
  id?: string;
  dayOfWeek: number;
  hours: number;
  subjectId: string | null;
  subjectName?: string;
  blockType: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_LABEL: Record<number, string> = {
  0: "Domingo", 1: "Segunda", 2: "Terça", 3: "Quarta",
  4: "Quinta",  5: "Sexta",   6: "Sábado",
};
const DAY_SHORT: Record<number, string> = {
  0: "Dom", 1: "Seg", 2: "Ter", 3: "Qua", 4: "Qui", 5: "Sex", 6: "Sáb",
};

const BLOCK_TYPES = [
  { value: "leitura",       label: "Leitura PDF"    },
  { value: "exercicios",    label: "Exercícios"     },
  { value: "revisao7d",     label: "Revisão 7d"     },
  { value: "revisao14_30d", label: "Revisão 14/30d" },
];

const SUBJECT_COLORS = [
  { bg: "bg-rose-100",   text: "text-rose-800",   border: "border-rose-200"   },
  { bg: "bg-blue-100",   text: "text-blue-800",   border: "border-blue-200"   },
  { bg: "bg-amber-100",  text: "text-amber-800",  border: "border-amber-200"  },
  { bg: "bg-green-100",  text: "text-green-800",  border: "border-green-200"  },
  { bg: "bg-violet-100", text: "text-violet-800", border: "border-violet-200" },
  { bg: "bg-cyan-100",   text: "text-cyan-800",   border: "border-cyan-200"   },
  { bg: "bg-orange-100", text: "text-orange-800", border: "border-orange-200" },
  { bg: "bg-pink-100",   text: "text-pink-800",   border: "border-pink-200"   },
];

const REVISION_COLOR = {
  bg: "bg-yellow-50", text: "text-yellow-800", border: "border-yellow-200",
};

function formatHours(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  if (mm === 0) return `${hh}h`;
  return `${hh}h${mm.toString().padStart(2, "0")}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CalendarioCicloPage() {
  const [subjects,   setSubjects]   = useState<Subject[]>([]);
  const [blocks,     setBlocks]     = useState<StudyBlock[]>([]);
  const [draft,      setDraft]      = useState<StudyBlock[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/subjects").then(r => r.json()).catch(() => []),
      fetch("/api/study-blocks").then(r => r.json()).catch(() => []),
    ]).then(([subjectsRaw, blocksRaw]) => {
      const su = Array.isArray(subjectsRaw)
        ? subjectsRaw
        : subjectsRaw?.subjects ?? [];
      setSubjects(su);

      const bl = Array.isArray(blocksRaw)
        ? blocksRaw.map((b: any) => ({
            id:          b.id,
            dayOfWeek:   b.dayOfWeek,
            hours:       b.hours,
            subjectId:   b.subjectId,
            subjectName: b.subject?.name ?? null,
            blockType:   b.blockType,
          }))
        : [];

      setBlocks(bl);
      setDraft(bl);
      if (bl.length === 0) setShowConfig(true);
    }).finally(() => setLoading(false));
  }, []);

  const subjectColorMap = new Map<string, typeof SUBJECT_COLORS[0]>();
  subjects.forEach((s, i) =>
    subjectColorMap.set(s.id, SUBJECT_COLORS[i % SUBJECT_COLORS.length])
  );

  // ── Totais calculados sempre a partir dos study-blocks ────────────────────
  // ✅ FIX: uma única fonte de verdade para horas semanais
  const totalWeekHours  = blocks.reduce((a, b) => a + b.hours, 0);
  const daysWithStudy   = new Set(blocks.map(b => b.dayOfWeek)).size;

  // Blocos agrupados por dia
  const blocksByDay = DAY_ORDER.map(day => ({
    day,
    blocks:     blocks.filter(b => b.dayOfWeek === day),
    totalHours: blocks.filter(b => b.dayOfWeek === day).reduce((a, b) => a + b.hours, 0),
  }));

  // ── Draft helpers ─────────────────────────────────────────────────────────
  const draftByDay = (day: number) => draft.filter(b => b.dayOfWeek === day);

  const addBlock = (day: number) => {
    setDraft(d => [
      ...d,
      {
        dayOfWeek:   day,
        hours:       1,
        subjectId:   subjects[0]?.id ?? null,
        subjectName: subjects[0]?.name,
        blockType:   "leitura",
      },
    ]);
  };

  const removeBlock = (day: number, idx: number) => {
    setDraft(d => {
      const dayBlocks = d.filter(b => b.dayOfWeek === day);
      const toRemove  = dayBlocks[idx];
      if (!toRemove) return d;
      const removeIdx = d.indexOf(toRemove);
      return d.filter((_, i) => i !== removeIdx);
    });
  };

  const updateBlock = (
    day: number,
    idx: number,
    field: keyof StudyBlock,
    value: any,
  ) => {
    setDraft(d => {
      const result    = [...d];
      const dayBlocks = result.filter(b => b.dayOfWeek === day);
      const target    = dayBlocks[idx];
      const globalIdx = result.indexOf(target);
      if (globalIdx === -1) return d;
      if (field === "subjectId") {
        const subj = subjects.find(s => s.id === value);
        result[globalIdx] = {
          ...result[globalIdx],
          subjectId:   value,
          subjectName: subj?.name,
        };
      } else {
        result[globalIdx] = { ...result[globalIdx], [field]: value };
      }
      return result;
    });
  };

  // ── Total do draft (exibido no painel de edição) ──────────────────────────
  // ✅ FIX: mostra o total real dos blocos cadastrados, não uma meta separada
  const draftTotal = draft.reduce((a, b) => a + b.hours, 0);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/study-blocks", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(draft),
      });
      if (res.ok) {
        const saved  = await res.json();
        const mapped = saved.map((b: any) => ({
          id:          b.id,
          dayOfWeek:   b.dayOfWeek,
          hours:       b.hours,
          subjectId:   b.subjectId,
          subjectName: b.subject?.name ?? null,
          blockType:   b.blockType,
        }));
        setBlocks(mapped);
        setDraft(mapped);
        setShowConfig(false);
      }
    } finally {
      setSaving(false);
    }
  };

  // ── Semana atual ──────────────────────────────────────────────────────────
  const today      = new Date(); today.setHours(0, 0, 0, 0);
  const dayOfWeek  = today.getDay();
  const diffToMon  = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday     = new Date(today);
  monday.setDate(today.getDate() + diffToMon + weekOffset * 7);
  const sunday     = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const weekLabel  = `${monday.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} – ${sunday.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}.`;

  if (loading)
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ── */}
      <div className="bg-gray-950 text-white px-8 py-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <CalendarDays className="w-6 h-6 text-gray-400" />
              <h1 className="text-3xl font-bold">Calendário do Ciclo</h1>
            </div>
            {/* ✅ FIX: subtítulo usa totalWeekHours dos study-blocks — fonte única */}
            <p className="text-gray-400 text-sm">
              {blocks.length > 0
                ? `${formatHours(totalWeekHours)} semanais · ${daysWithStudy} dias de estudo`
                : "Configure seu planejamento semanal"}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setDraft(blocks);
                setShowConfig(!showConfig);
                setSelectedDay(null);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                showConfig
                  ? "bg-white text-gray-900"
                  : "bg-gray-800 hover:bg-gray-700 text-white"
              }`}
            >
              <Settings className="w-4 h-4" />
              {showConfig ? "Fechar" : "Editar planejamento"}
            </button>
            <Link
              href="/ciclo"
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-xl transition-colors"
            >
              <Zap className="w-4 h-4" /> Fila de prioridade
            </Link>
          </div>
        </div>

        {/* Navegação semana */}
        {!showConfig && (
          <div className="flex items-center justify-between mt-6">
            <button
              onClick={() => setWeekOffset(w => w - 1)}
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Anterior
            </button>
            <div className="text-center">
              <p className="text-sm font-semibold">{weekLabel}</p>
              {weekOffset !== 0 ? (
                <button
                  onClick={() => setWeekOffset(0)}
                  className="text-xs text-gray-400 hover:text-white underline mt-0.5 transition-colors"
                >
                  Voltar para hoje
                </button>
              ) : (
                <p className="text-xs text-gray-400 mt-0.5">Semana atual</p>
              )}
            </div>
            <button
              onClick={() => setWeekOffset(w => w + 1)}
              className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors"
            >
              Próxima <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* ── MODO EDIÇÃO ── */}
        {showConfig && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-gray-900">
                Monte seu planejamento semanal
              </h2>
              <p className="text-sm text-gray-400">
                Escolha matéria e horas para cada bloco
              </p>
            </div>

            {DAY_ORDER.map(day => {
              const dayBlocks = draftByDay(day);
              const dayTotal  = dayBlocks.reduce((a, b) => a + b.hours, 0);
              return (
                <div key={day} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <p className="font-bold text-gray-900">{DAY_LABEL[day]}</p>
                      {dayTotal > 0 && (
                        <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                          {formatHours(dayTotal)} total
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => addBlock(day)}
                      className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 transition-colors px-2 py-1 rounded-lg hover:bg-gray-100"
                    >
                      <Plus className="w-3.5 h-3.5" /> Adicionar bloco
                    </button>
                  </div>

                  {dayBlocks.length === 0 ? (
                    <div className="px-5 py-4 text-sm text-gray-300 italic">
                      Sem estudo — clique em "Adicionar bloco"
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {dayBlocks.map((block, idx) => (
                        <div key={idx} className="flex items-center gap-3 px-5 py-3">
                          <select
                            value={block.subjectId ?? ""}
                            onChange={e =>
                              updateBlock(day, idx, "subjectId", e.target.value || null)
                            }
                            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
                          >
                            <option value="">— Sem matéria fixa —</option>
                            {subjects.map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>

                          <select
                            value={block.blockType}
                            onChange={e =>
                              updateBlock(day, idx, "blockType", e.target.value)
                            }
                            className="w-36 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
                          >
                            {BLOCK_TYPES.map(t => (
                              <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                          </select>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <input
                              type="number" min="0.25" max="12" step="0.25"
                              value={block.hours}
                              onChange={e =>
                                updateBlock(
                                  day, idx, "hours",
                                  parseFloat(e.target.value) || 0.5,
                                )
                              }
                              className="w-16 border border-gray-200 rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-gray-900"
                            />
                            <span className="text-xs text-gray-400">h</span>
                          </div>

                          <button
                            onClick={() => removeBlock(day, idx)}
                            className="text-gray-300 hover:text-red-500 transition-colors shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Painel de ações */}
            <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-200 p-5">
              <div>
                {/* ✅ FIX: exibe o total real do draft, não uma meta externa */}
                <p className="text-sm text-gray-500">Total semanal</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatHours(draftTotal)}
                </p>
                {draftTotal !== totalWeekHours && blocks.length > 0 && (
                  <p className="text-xs text-amber-600 mt-0.5">
                    Atual salvo: {formatHours(totalWeekHours)}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setDraft(blocks); setShowConfig(false); }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors"
                >
                  <X className="w-4 h-4" /> Cancelar
                </button>
                <button
                  onClick={save}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 hover:bg-gray-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  {saving ? "Salvando..." : "Salvar planejamento"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── MODO VISUALIZAÇÃO ── */}
        {!showConfig && blocks.length > 0 && (
          <>
            {/* Legenda */}
            <div className="flex flex-wrap gap-2 mb-6">
              {subjects.map(s => {
                const color = subjectColorMap.get(s.id);
                return (
                  <span
                    key={s.id}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${color?.bg} ${color?.text} ${color?.border}`}
                  >
                    {s.name}
                  </span>
                );
              })}
            </div>

            {/* Grid semanal */}
            <div className="grid grid-cols-7 gap-2 mb-6">
              {DAY_ORDER.map((day, i) => {
                const dayDate = new Date(monday);
                dayDate.setDate(monday.getDate() + i);
                const isToday    = dayDate.getTime() === today.getTime();
                const isPast     = dayDate < today;
                const dayData    = blocksByDay.find(d => d.day === day)!;
                const isSelected = selectedDay === day;

                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDay(isSelected ? null : day)}
                    className={`relative flex flex-col items-center rounded-2xl border-2 p-2 transition-all cursor-pointer
                      ${isToday    ? "border-gray-900 shadow-md" : isSelected ? "border-gray-500" : "border-gray-200 hover:border-gray-300"}
                      ${isPast && !isToday ? "opacity-60" : ""}
                      ${dayData.totalHours === 0 ? "bg-gray-50" : "bg-white"}
                    `}
                  >
                    <p className={`text-xs font-semibold uppercase tracking-wide ${isToday ? "text-gray-900" : "text-gray-400"}`}>
                      {DAY_SHORT[day]}
                    </p>
                    <div className={`w-8 h-8 flex items-center justify-center rounded-full text-sm font-bold mt-0.5 mb-2 ${isToday ? "bg-gray-900 text-white" : "text-gray-700"}`}>
                      {dayDate.getDate()}
                    </div>

                    {dayData.totalHours === 0 ? (
                      <p className="text-[10px] text-gray-300">Folga</p>
                    ) : (
                      <>
                        <div className="w-full space-y-1">
                          {dayData.blocks.map((block, bi) => {
                            const isRevision =
                              block.blockType === "revisao7d" ||
                              block.blockType === "revisao14_30d";
                            const color = block.subjectId
                              ? subjectColorMap.get(block.subjectId)
                              : null;
                            const style  = isRevision ? REVISION_COLOR : color ?? SUBJECT_COLORS[0];
                            const label  = block.subjectName
                              || BLOCK_TYPES.find(t => t.value === block.blockType)?.label
                              || block.blockType;
                            return (
                              <div key={bi} className={`w-full rounded-lg px-1.5 py-1 ${style.bg}`}>
                                <p className={`text-[10px] font-semibold leading-tight truncate ${style.text}`}>
                                  {label}
                                </p>
                                <p className={`text-[10px] ${style.text} opacity-70`}>
                                  {formatHours(block.hours)}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                        <p className="text-[10px] text-gray-400 mt-2 font-medium">
                          {formatHours(dayData.totalHours)}
                        </p>
                      </>
                    )}

                    {isToday && (
                      <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-[9px] bg-gray-900 text-white px-2 py-0.5 rounded-full font-bold uppercase tracking-wide whitespace-nowrap">
                        Hoje
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Detalhe do dia selecionado */}
            {selectedDay !== null && (() => {
              const dayData = blocksByDay.find(d => d.day === selectedDay)!;
              return (
                <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
                  <div className="flex items-center justify-between mb-5">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">
                        {DAY_LABEL[selectedDay]}
                      </h2>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {formatHours(dayData.totalHours)} de estudo programadas
                      </p>
                    </div>
                    {selectedDay === today.getDay() && (
                      <Link
                        href="/sessao"
                        className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-700 text-white text-sm font-semibold rounded-xl transition-colors"
                      >
                        <Zap className="w-4 h-4" /> Começar agora
                      </Link>
                    )}
                  </div>
                  <div className="space-y-3">
                    {dayData.blocks.map((block, i) => {
                      const isRevision =
                        block.blockType === "revisao7d" ||
                        block.blockType === "revisao14_30d";
                      const color  = block.subjectId ? subjectColorMap.get(block.subjectId) : null;
                      const style  = isRevision ? REVISION_COLOR : color ?? SUBJECT_COLORS[0];
                      const label  = block.subjectName
                        || BLOCK_TYPES.find(t => t.value === block.blockType)?.label
                        || block.blockType;
                      const typeLabel = BLOCK_TYPES.find(t => t.value === block.blockType)?.label
                        ?? block.blockType;
                      const pct = dayData.totalHours > 0
                        ? Math.round((block.hours / dayData.totalHours) * 100)
                        : 0;
                      return (
                        <div key={i} className={`rounded-xl border p-4 ${style.bg} ${style.border}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white bg-gray-700">
                                {i + 1}º
                              </div>
                              <div>
                                <p className={`font-bold ${style.text}`}>{label}</p>
                                <p className={`text-xs ${style.text} opacity-70`}>{typeLabel}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={`text-lg font-bold ${style.text}`}>
                                {formatHours(block.hours)}
                              </p>
                              <p className={`text-xs ${style.text} opacity-60`}>{pct}% do dia</p>
                            </div>
                          </div>
                          <div className="mt-3 h-1.5 bg-white/50 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gray-400 opacity-50"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* KPIs — todos calculados a partir dos study-blocks */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Horas na semana", value: formatHours(totalWeekHours) },
                { label: "Dias com estudo", value: `${daysWithStudy} dias` },
                { label: "Blocos no ciclo", value: `${blocks.length}` },
                {
                  label: "Média por dia",
                  value: daysWithStudy > 0
                    ? formatHours(totalWeekHours / daysWithStudy)
                    : "—",
                },
              ].map(({ label, value }) => (
                <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">{value}</p>
                  <p className="text-xs text-gray-400 mt-1">{label}</p>
                </div>
              ))}
            </div>
          </>
        )}

        {!showConfig && blocks.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg font-medium mb-2">Nenhum planejamento configurado</p>
            <p className="text-sm">Clique em "Editar planejamento" para montar sua semana.</p>
          </div>
        )}
      </div>
    </div>
  );
}
