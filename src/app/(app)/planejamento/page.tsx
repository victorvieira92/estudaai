"use client";
import { useEffect, useState } from "react";
import { Settings, Plus, Trash2, Check, X, Info } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Subject {
  id: string; name: string; editalWeight: number; criticality: number;
  studyHours: number; totalQuestions: number; correctQuestions: number;
  lastStudyAt: string | null; recurrence: number;
}
interface Review { completed: boolean; pdf?: { topic?: { subject?: { id: string } } }; }
interface ErrorNote { resolved: boolean; subjectId: string; }

interface StudyBlock {
  id?: string;
  dayOfWeek: number; // 0=Dom,1=Seg,...,6=Sáb
  startTime: string;
  endTime: string;
  blockType: BlockType;
}

type BlockType = "leitura" | "exercicios" | "revisao7d" | "revisao14_30d";

// ─── Constants ────────────────────────────────────────────────────────────────

const BLOCK_TYPES: { value: BlockType; label: string; color: string; dot: string }[] = [
  { value: "leitura",      label: "Leitura PDF",   color: "bg-blue-100 text-blue-800 border-blue-200",   dot: "bg-blue-400"   },
  { value: "exercicios",   label: "Exercícios",    color: "bg-green-100 text-green-800 border-green-200", dot: "bg-green-400"  },
  { value: "revisao7d",    label: "Revisão 7d",    color: "bg-yellow-100 text-yellow-800 border-yellow-200", dot: "bg-yellow-400" },
  { value: "revisao14_30d",label: "Revisão 14/30d",color: "bg-pink-100 text-pink-800 border-pink-200",   dot: "bg-pink-400"   },
];

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Seg→Dom
const DAY_LABELS: Record<number, string> = {
  0: "Domingo", 1: "Segunda-feira", 2: "Terça-feira",
  3: "Quarta-feira", 4: "Quinta-feira", 5: "Sexta-feira", 6: "Sábado",
};
const DAY_SHORT: Record<number, string> = {
  0: "Dom", 1: "Seg", 2: "Ter", 3: "Qua", 4: "Qui", 5: "Sex", 6: "Sáb",
};

const SUBJECT_COLORS = [
  "bg-blue-100 text-blue-800 border-blue-200",
  "bg-violet-100 text-violet-800 border-violet-200",
  "bg-amber-100 text-amber-800 border-amber-200",
  "bg-green-100 text-green-800 border-green-200",
  "bg-rose-100 text-rose-800 border-rose-200",
  "bg-cyan-100 text-cyan-800 border-cyan-200",
  "bg-orange-100 text-orange-800 border-orange-200",
  "bg-pink-100 text-pink-800 border-pink-200",
];

// Blocos padrão (sua rotina) — usado apenas na primeira vez
const DEFAULT_BLOCKS: Omit<StudyBlock, "id">[] = [
  ...[1,2,3,4,5].flatMap(d => [
    { dayOfWeek: d, startTime: "04:15", endTime: "05:30", blockType: "leitura" as BlockType },
    { dayOfWeek: d, startTime: "07:00", endTime: "08:00", blockType: "exercicios" as BlockType },
    { dayOfWeek: d, startTime: "12:00", endTime: "13:00", blockType: "revisao7d" as BlockType },
  ]),
  { dayOfWeek: 6, startTime: "04:15", endTime: "05:30", blockType: "leitura" as BlockType },
  { dayOfWeek: 6, startTime: "07:00", endTime: "10:00", blockType: "exercicios" as BlockType },
  { dayOfWeek: 6, startTime: "10:00", endTime: "11:30", blockType: "revisao7d" as BlockType },
  { dayOfWeek: 0, startTime: "04:15", endTime: "06:15", blockType: "revisao7d" as BlockType },
  { dayOfWeek: 0, startTime: "07:00", endTime: "09:00", blockType: "revisao14_30d" as BlockType },
  { dayOfWeek: 0, startTime: "09:00", endTime: "12:45", blockType: "exercicios" as BlockType },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calcDuration(start: string, end: string): string {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins <= 0) return "";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}min`;
  return m > 0 ? `${h}h${m}min` : `${h}h`;
}

function totalHoursForDay(blocks: StudyBlock[]): string {
  const mins = blocks.reduce((acc, b) => {
    const [sh, sm] = b.startTime.split(":").map(Number);
    const [eh, em] = b.endTime.split(":").map(Number);
    return acc + Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
  }, 0);
  if (mins === 0) return "0h";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h${m}min` : `${h}h`;
}

function totalWeekMins(blocks: StudyBlock[]): number {
  return blocks.reduce((acc, b) => {
    const [sh, sm] = b.startTime.split(":").map(Number);
    const [eh, em] = b.endTime.split(":").map(Number);
    return acc + Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
  }, 0);
}

function formatTotalHours(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `~${h}h${m}min` : `~${h}h`;
}

function calcScore(s: Subject, pendingRevs: number, pendingErrs: number): number {
  const daysSince = s.lastStudyAt
    ? Math.floor((Date.now() - new Date(s.lastStudyAt).getTime()) / 86400000)
    : 30;
  const accuracy = s.totalQuestions > 0 ? (s.correctQuestions / s.totalQuestions) * 100 : 50;
  return s.editalWeight * 10 + s.criticality * 8 + s.recurrence * 5 +
    pendingRevs * 15 + pendingErrs * 12 + daysSince * 2 + (100 - accuracy) * 0.5;
}

function getBlockStyle(type: BlockType) {
  return BLOCK_TYPES.find(b => b.value === type) ?? BLOCK_TYPES[0];
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function PlanejamentoPage() {
  const [blocks, setBlocks] = useState<StudyBlock[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [errors, setErrors] = useState<ErrorNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConfig, setShowConfig] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftBlocks, setDraftBlocks] = useState<StudyBlock[]>([]);
  const [isFirstTime, setIsFirstTime] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/study-blocks").then(r => r.json()).catch(() => []),
      fetch("/api/subjects").then(r => r.json()).catch(() => []),
      fetch("/api/reviews").then(r => r.json()).catch(() => []),
      fetch("/api/error-notes").then(r => r.json()).catch(() => []),
    ]).then(([blocksRaw, subjectsRaw, reviewsRaw, errorsRaw]) => {
      const bl = Array.isArray(blocksRaw) ? blocksRaw : [];
      const su = Array.isArray(subjectsRaw) ? subjectsRaw : subjectsRaw?.subjects ?? [];
      setSubjects(su);
      setReviews(Array.isArray(reviewsRaw) ? reviewsRaw : []);
      setErrors(Array.isArray(errorsRaw) ? errorsRaw : []);

      if (bl.length === 0) {
        setIsFirstTime(true);
        setShowConfig(true);
        setDraftBlocks(DEFAULT_BLOCKS);
      } else {
        setBlocks(bl);
        setDraftBlocks(bl);
      }
    }).finally(() => setLoading(false));
  }, []);

  // Matérias ordenadas por score
  const scoredSubjects = [...subjects].map(s => {
    const pendingRevs = reviews.filter(r => !r.completed && r.pdf?.topic?.subject?.id === s.id).length;
    const pendingErrs = errors.filter(e => !e.resolved && e.subjectId === s.id).length;
    return { ...s, score: calcScore(s, pendingRevs, pendingErrs) };
  }).sort((a, b) => b.score - a.score);

  // Distribui matérias nos blocos de leitura/exercícios por dia
  function getSubjectForBlock(dayBlocks: StudyBlock[], blockIndex: number, type: BlockType): string {
    if (type === "revisao7d" || type === "revisao14_30d") return "";
    const studyBlocksOfType = dayBlocks.filter(b => b.blockType === type);
    const idx = studyBlocksOfType.findIndex((_, i) => i === blockIndex);
    return scoredSubjects[idx % Math.max(scoredSubjects.length, 1)]?.name ?? "";
  }

  // Agrupa blocos por dia
  const blocksByDay = DAY_ORDER.map(day => ({
    day,
    blocks: blocks.filter(b => b.dayOfWeek === day).sort((a, b) => a.startTime.localeCompare(b.startTime)),
  })).filter(d => d.blocks.length > 0);

  // Grupos de dias com mesma estrutura (para o header tipo "SEG A SEX — 3H15 POR DIA")
  function groupLabel(day: number, dayBlocks: StudyBlock[]): string {
    const total = totalHoursForDay(dayBlocks);
    const count = dayBlocks.length;
    return `${total} (${count} BLOCO${count > 1 ? "S" : ""})`;
  }

  const saveBlocks = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/study-blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draftBlocks),
      });
      if (res.ok) {
        const saved = await res.json();
        setBlocks(saved);
        setDraftBlocks(saved);
        setShowConfig(false);
        setIsFirstTime(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const addDraftBlock = () => {
    setDraftBlocks(d => [...d, { dayOfWeek: 1, startTime: "06:00", endTime: "07:00", blockType: "leitura" }]);
  };

  const removeDraftBlock = (i: number) => {
    setDraftBlocks(d => d.filter((_, idx) => idx !== i));
  };

  const updateDraftBlock = (i: number, field: keyof StudyBlock, value: any) => {
    setDraftBlocks(d => d.map((b, idx) => idx === i ? { ...b, [field]: value } : b));
  };

  const weekMins = totalWeekMins(blocks);
  const uniqueDays = new Set(blocks.map(b => b.dayOfWeek)).size;
  const cycleDays = scoredSubjects.length;

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
            <h1 className="text-3xl font-bold">Planejamento</h1>
            <p className="text-gray-400 text-sm mt-1">Defina seus blocos de estudo e acompanhe o ciclo semanal</p>
          </div>
          <button
            onClick={() => { setDraftBlocks(blocks); setShowConfig(!showConfig); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${showConfig ? "bg-white text-gray-900" : "bg-gray-800 hover:bg-gray-700 text-white"}`}
          >
            <Settings className="w-4 h-4" />
            {showConfig ? "Fechar" : "Configurar blocos"}
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* ── Configuração de blocos ── */}
        {showConfig && (
          <div className="bg-white rounded-2xl border-2 border-gray-900 p-6">
            <h2 className="text-lg font-bold mb-1">
              {isFirstTime ? "Configure seus blocos de estudo" : "Editar blocos de estudo"}
            </h2>
            <p className="text-sm text-gray-500 mb-5">
              {isFirstTime
                ? "Definimos sua rotina como ponto de partida. Ajuste os horários e tipos conforme sua realidade."
                : "Adicione, remova ou ajuste seus blocos de estudo semanais."
              }
            </p>

            {/* Tabela de blocos */}
            <div className="space-y-2 mb-4 max-h-96 overflow-y-auto">
              {/* Header */}
              <div className="grid grid-cols-12 gap-2 px-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                <div className="col-span-2">Dia</div>
                <div className="col-span-3">Início</div>
                <div className="col-span-3">Fim</div>
                <div className="col-span-3">Tipo</div>
                <div className="col-span-1"></div>
              </div>

              {draftBlocks
                .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime))
                .map((b, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center bg-gray-50 rounded-xl px-3 py-2">
                  <div className="col-span-2">
                    <select
                      value={b.dayOfWeek}
                      onChange={e => updateDraftBlock(i, "dayOfWeek", Number(e.target.value))}
                      className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
                    >
                      {DAY_ORDER.map(d => <option key={d} value={d}>{DAY_SHORT[d]}</option>)}
                    </select>
                  </div>
                  <div className="col-span-3">
                    <input type="time" value={b.startTime}
                      onChange={e => updateDraftBlock(i, "startTime", e.target.value)}
                      className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>
                  <div className="col-span-3">
                    <input type="time" value={b.endTime}
                      onChange={e => updateDraftBlock(i, "endTime", e.target.value)}
                      className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                  </div>
                  <div className="col-span-3">
                    <select value={b.blockType}
                      onChange={e => updateDraftBlock(i, "blockType", e.target.value as BlockType)}
                      className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
                    >
                      {BLOCK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div className="col-span-1 flex justify-center">
                    <button onClick={() => removeDraftBlock(i)} className="text-gray-300 hover:text-red-500 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button onClick={addDraftBlock}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-5"
            >
              <Plus className="w-4 h-4" /> Adicionar bloco
            </button>

            <div className="flex items-center justify-between border-t border-gray-100 pt-4">
              <p className="text-sm text-gray-500">
                {draftBlocks.length} bloco{draftBlocks.length !== 1 ? "s" : ""} • {formatTotalHours(totalWeekMins(draftBlocks))} semanais
              </p>
              <div className="flex gap-2">
                <button onClick={() => { setDraftBlocks(blocks); setShowConfig(false); }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors"
                >
                  <X className="w-4 h-4" /> Cancelar
                </button>
                <button onClick={saveBlocks} disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 hover:bg-gray-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  {saving ? "Salvando..." : "Salvar planejamento"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Visualização semanal ── */}
        {!showConfig && blocks.length > 0 && (
          <>
            {/* Legenda */}
            <div className="flex flex-wrap items-center gap-3">
              {BLOCK_TYPES.map(t => (
                <span key={t.value} className="flex items-center gap-1.5 text-xs text-gray-600">
                  <span className={`w-3 h-3 rounded-sm ${t.dot}`} />
                  {t.label}
                </span>
              ))}
            </div>

            {/* Grid por dia */}
            {blocksByDay.map(({ day, blocks: dayBlocks }, dayIdx) => {
              // Detectar grupos de dias iguais para header
              const isWeekday = [1,2,3,4,5].includes(day);
              const prevDay = dayIdx > 0 ? blocksByDay[dayIdx - 1].day : -1;
              const prevIsWeekday = [1,2,3,4,5].includes(prevDay);
              const showGroupHeader = isWeekday && !prevIsWeekday;
              const showSatHeader = day === 6;
              const showSunHeader = day === 0;

              // Contadores por tipo para distribuição de matérias
              const leituraCount: Record<string, number> = {};
              const exCount: Record<string, number> = {};

              return (
                <div key={day}>
                  {/* Headers de seção */}
                  {showGroupHeader && (
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                      SEG A SEX — {totalHoursForDay(dayBlocks)} POR DIA ({dayBlocks.length} BLOCOS)
                    </p>
                  )}
                  {showSatHeader && (
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 mt-4">
                      SÁBADO — {totalHoursForDay(dayBlocks)} (BLOCOS MAIORES)
                    </p>
                  )}
                  {showSunHeader && (
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 mt-4">
                      DOMINGO — {totalHoursForDay(dayBlocks)} (REVISÕES ESPAÇADAS + SIMULADO)
                    </p>
                  )}

                  {/* Linha do dia */}
                  <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-2">
                    <div className="flex">
                      {/* Label do dia */}
                      <div className="w-24 shrink-0 bg-gray-50 border-r border-gray-100 flex flex-col items-start justify-center px-4 py-4">
                        <p className="font-bold text-gray-900 text-sm">{DAY_LABELS[day].split("-")[0]}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{totalHoursForDay(dayBlocks)}</p>
                      </div>

                      {/* Blocos */}
                      <div className="flex flex-1 flex-wrap gap-0">
                        {dayBlocks.map((block, bi) => {
                          const style = getBlockStyle(block.blockType);
                          const duration = calcDuration(block.startTime, block.endTime);

                          // Determina qual matéria mostrar
                          let subjectName = "";
                          if (block.blockType === "leitura") {
                            leituraCount[day] = (leituraCount[day] ?? 0);
                            const idx = leituraCount[day];
                            leituraCount[day]++;
                            // Para leitura: matéria principal por ordem de score
                            subjectName = scoredSubjects[idx % Math.max(scoredSubjects.length, 1)]?.name ?? "";
                          } else if (block.blockType === "exercicios") {
                            exCount[day] = (exCount[day] ?? 0);
                            const idx = exCount[day];
                            exCount[day]++;
                            // Exercícios: mesma matéria da leitura correspondente
                            subjectName = scoredSubjects[idx % Math.max(scoredSubjects.length, 1)]?.name ?? "";
                          } else if (block.blockType === "revisao7d") {
                            // Revisão 7d: matéria anterior no ciclo
                            const prevDayInCycle = (dayIdx - 1 + blocksByDay.length) % blocksByDay.length;
                            const prevSubj = scoredSubjects[prevDayInCycle % Math.max(scoredSubjects.length, 1)]?.name ?? "";
                            subjectName = prevSubj ? `${prevSubj}` : "Revisão 7d";
                          } else {
                            subjectName = "Revisão 14/30d";
                          }

                          const subjectColor = block.blockType === "leitura" || block.blockType === "exercicios"
                            ? SUBJECT_COLORS[scoredSubjects.findIndex(s => s.name === subjectName) % SUBJECT_COLORS.length]
                            : style.color;

                          return (
                            <div
                              key={bi}
                              className={`flex-1 min-w-[140px] border-r border-gray-100 last:border-r-0 p-3 ${
                                block.blockType === "leitura" || block.blockType === "exercicios"
                                  ? subjectColor
                                  : style.color
                              }`}
                            >
                              <p className="font-semibold text-sm leading-tight">{subjectName || style.label}</p>
                              <p className="text-xs mt-1 opacity-70">
                                {block.startTime} — {style.label} · {duration}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Revisões espaçadas — info */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Info className="w-4 h-4 text-gray-400" />
                <p className="font-semibold text-gray-800 text-sm">Como funcionam as revisões espaçadas no ciclo</p>
              </div>
              <div className="space-y-2">
                {[
                  { tag: "7 dias", color: "bg-yellow-100 text-yellow-800", text: "Bloco do almoço (12h) da semana seguinte — ex: Tributário estudado na Seg revisado na Ter da próxima semana" },
                  { tag: "14 dias", color: "bg-pink-100 text-pink-800", text: "Domingo da 2ª semana — 2 matérias que completaram 14 dias recebem revisão de 1h cada" },
                  { tag: "30 dias", color: "bg-pink-100 text-pink-800", text: "Domingo da 4ª semana — revisão completa do ciclo inteiro, substituindo o simulado naquele domingo" },
                  { tag: "Exercícios", color: "bg-green-100 text-green-800", text: "Sempre no bloco logo após a leitura — nunca deixar passar mais de 24h entre ler e resolver questões" },
                ].map(({ tag, color, text }) => (
                  <div key={tag} className="flex items-start gap-3">
                    <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full ${color}`}>{tag}</span>
                    <p className="text-sm text-gray-600">{text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Horas semanais", value: formatTotalHours(weekMins) },
                { label: "Matérias/semana", value: String(scoredSubjects.length) },
                { label: "Ciclo completo", value: `${cycleDays} dias` },
                { label: "Revisões por mês", value: "3 rodadas" },
              ].map(({ label, value }) => (
                <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">{value}</p>
                  <p className="text-xs text-gray-400 mt-1">{label}</p>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Estado vazio */}
        {!showConfig && blocks.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg font-medium mb-2">Nenhum bloco configurado</p>
            <p className="text-sm">Clique em "Configurar blocos" para montar seu planejamento semanal.</p>
          </div>
        )}
      </div>
    </div>
  );
}
