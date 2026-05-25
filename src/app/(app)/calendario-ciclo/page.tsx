"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarDays, Settings, Zap, Plus, Trash2,
  Check, X, Clock, ChevronUp, ChevronDown,
} from "lucide-react";

interface Subject   { id: string; name: string; }
interface StudyBlock { id?: string; dayOfWeek: number; hours: number; subjectId: string | null; subjectName?: string; blockType: string; }

const BG_HEADER = "#1B4040";

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

function fmt(h: number) {
  const totalMin = Math.round(h * 60);
  if (totalMin < 60) return `${totalMin}min`;
  const hh = Math.floor(totalMin / 60); const mm = totalMin % 60;
  return mm > 0 ? `${hh}h${mm}min` : `${hh}h`;
}

const CYCLE_KEY = "estudaai_cycle_day";

// Converte blocos para lista de dias ordenados
function blocksToOrderedDays(blocks: StudyBlock[]): number[] {
  return [...new Set(blocks.map(b => b.dayOfWeek))].sort((a, b) => a - b);
}

export default function CalendarioCicloPage() {
  const [subjects,   setSubjects]   = useState<Subject[]>([]);
  const [blocks,     setBlocks]     = useState<StudyBlock[]>([]);
  // draft guarda a ordem lógica dos dias como array de dayOfWeek
  const [draftDayOrder, setDraftDayOrder] = useState<number[]>([]);
  const [draftBlocks,   setDraftBlocks]   = useState<StudyBlock[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [currentDayIdx, setCurrentDayIdx] = useState(0);

  useEffect(() => {
    Promise.all([
      fetch("/api/subjects").then(r => r.json()).catch(() => []),
      fetch("/api/study-blocks").then(r => r.json()).catch(() => []),
    ]).then(([su, bl]) => {
      const subjects: Subject[] = Array.isArray(su) ? su : su?.subjects ?? [];
      setSubjects(subjects);
      const mapped: StudyBlock[] = Array.isArray(bl) ? bl.map((b: any) => ({
        id: b.id, dayOfWeek: b.dayOfWeek, hours: b.hours,
        subjectId: b.subjectId, subjectName: b.subject?.name, blockType: b.blockType,
      })) : [];
      setBlocks(mapped);
      const days = blocksToOrderedDays(mapped);
      setDraftDayOrder(days);
      setDraftBlocks(mapped);
      if (mapped.length === 0) setShowConfig(true);
      const saved = parseInt(localStorage.getItem(CYCLE_KEY) ?? "0", 10);
      setCurrentDayIdx(Math.min(saved, Math.max(0, days.length - 1)));
    }).finally(() => setLoading(false));
  }, []);

  const cycleDays = blocksToOrderedDays(blocks);

  const subjectColorMap = new Map<string, typeof SUBJECT_COLORS[0]>();
  subjects.forEach((s, i) => subjectColorMap.set(s.id, SUBJECT_COLORS[i % SUBJECT_COLORS.length]));

  const totalHours  = blocks.reduce((a, b) => a + b.hours, 0);
  const draftTotal  = draftBlocks.reduce((a, b) => a + b.hours, 0);

  // ── Reordenação de dias ───────────────────────────────────────────────────
  const moveDayUp = (idx: number) => {
    if (idx === 0) return;
    setDraftDayOrder(prev => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  };
  const moveDayDown = (idx: number) => {
    setDraftDayOrder(prev => {
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  };

  // ── Edição de blocos ──────────────────────────────────────────────────────
  const addBlock = (day: number) => {
    setDraftBlocks(d => [...d, { dayOfWeek: day, hours: 1, subjectId: subjects[0]?.id ?? null, subjectName: subjects[0]?.name, blockType: "leitura" }]);
  };
  const removeBlock = (day: number, idx: number) => {
    setDraftBlocks(d => {
      const r = [...d]; const db = r.filter(b => b.dayOfWeek === day);
      const gi = r.indexOf(db[idx]); if (gi === -1) return d; r.splice(gi, 1); return r;
    });
  };
  const updateBlock = (day: number, idx: number, field: keyof StudyBlock, value: any) => {
    setDraftBlocks(d => {
      const r = [...d]; const db = r.filter(b => b.dayOfWeek === day);
      const target = db[idx]; const gi = r.indexOf(target); if (gi === -1) return d;
      if (field === "subjectId") { const s = subjects.find(s => s.id === value); r[gi] = { ...r[gi], subjectId: value, subjectName: s?.name }; }
      else r[gi] = { ...r[gi], [field]: value };
      return r;
    });
  };
  const addDay = () => {
    const usedDays = new Set(draftDayOrder);
    for (let d = 0; d <= 20; d++) {
      if (!usedDays.has(d)) {
        setDraftDayOrder(prev => [...prev, d]);
        setDraftBlocks(prev => [...prev, { dayOfWeek: d, hours: 1, subjectId: subjects[0]?.id ?? null, subjectName: subjects[0]?.name, blockType: "leitura" }]);
        break;
      }
    }
  };
  const removeDay = (day: number) => {
    setDraftDayOrder(prev => prev.filter(d => d !== day));
    setDraftBlocks(prev => prev.filter(b => b.dayOfWeek !== day));
  };

  // ── Salvar ────────────────────────────────────────────────────────────────
  // Remapeia dayOfWeek para refletir a nova ordem lógica (0 = Dia 1, 1 = Dia 2...)
  const save = async () => {
    setSaving(true);
    try {
      // Remapeia os dayOfWeek conforme a nova ordem
      const remapped = draftBlocks.map(b => ({
        ...b,
        dayOfWeek: draftDayOrder.indexOf(b.dayOfWeek),
      })).filter(b => b.dayOfWeek >= 0);

      const res = await fetch("/api/study-blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(remapped),
      });
      if (res.ok) {
        const saved = await res.json();
        const mapped = saved.map((b: any) => ({
          id: b.id, dayOfWeek: b.dayOfWeek, hours: b.hours,
          subjectId: b.subjectId, subjectName: b.subject?.name, blockType: b.blockType,
        }));
        setBlocks(mapped);
        const days = blocksToOrderedDays(mapped);
        setDraftDayOrder(days);
        setDraftBlocks(mapped);
        setShowConfig(false);
        localStorage.setItem(CYCLE_KEY, "0");
        setCurrentDayIdx(0);
      }
    } finally { setSaving(false); }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-t-2 rounded-full animate-spin" style={{ borderColor: BG_HEADER }} />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header — cor da logo */}
      <div className="text-white px-8 py-8" style={{ backgroundColor: BG_HEADER }}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <CalendarDays className="w-6 h-6 opacity-70" />
              <h1 className="text-3xl font-bold">Ciclo de Estudos</h1>
            </div>
            <p className="text-sm opacity-60">
              {blocks.length > 0
                ? `${fmt(totalHours)} por ciclo completo · ${cycleDays.length} dias`
                : "Configure seus dias de estudo"}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                setDraftDayOrder(blocksToOrderedDays(blocks));
                setDraftBlocks(blocks);
                setShowConfig(!showConfig);
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
              style={{ backgroundColor: showConfig ? "#fff", color: showConfig ? BG_HEADER : "#fff", border: "1px solid rgba(255,255,255,0.3)" } as any}
            >
              <Settings className="w-4 h-4" />
              {showConfig ? "Fechar" : "Editar planejamento"}
            </button>
            <Link href="/ciclo"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
              style={{ backgroundColor: "rgba(255,255,255,0.15)", color: "#fff" }}>
              <Zap className="w-4 h-4" /> Fila do Dia
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* ── MODO EDIÇÃO ── */}
        {showConfig && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
              <h2 className="text-lg font-bold text-gray-900">Monte seu ciclo de estudos</h2>
              <button onClick={addDay}
                className="flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-xl transition-colors"
                style={{ backgroundColor: BG_HEADER }}>
                <Plus className="w-4 h-4" /> Adicionar dia
              </button>
            </div>

            {draftDayOrder.map((day, dayIdx) => {
              const dayBlocks = draftBlocks.filter(b => b.dayOfWeek === day);
              const dayTotal  = dayBlocks.reduce((a, b) => a + b.hours, 0);
              return (
                <div key={day} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      {/* ✅ Botões de reordenação */}
                      <div className="flex flex-col gap-0.5">
                        <button onClick={() => moveDayUp(dayIdx)} disabled={dayIdx === 0}
                          className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-20 transition-colors">
                          <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
                        </button>
                        <button onClick={() => moveDayDown(dayIdx)} disabled={dayIdx === draftDayOrder.length - 1}
                          className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-20 transition-colors">
                          <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                        </button>
                      </div>
                      <span className="text-sm font-bold text-gray-900">Dia {dayIdx + 1}</span>
                      {dayTotal > 0 && (
                        <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{fmt(dayTotal)}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => addBlock(day)}
                        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors">
                        <Plus className="w-3.5 h-3.5" /> Adicionar bloco
                      </button>
                      <button onClick={() => removeDay(day)}
                        className="text-gray-300 hover:text-red-500 transition-colors p-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {dayBlocks.length === 0 ? (
                    <div className="px-5 py-4 text-sm text-gray-300 italic">Sem blocos — clique em "Adicionar bloco"</div>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {dayBlocks.map((block, idx) => (
                        <div key={idx} className="flex items-center gap-3 px-5 py-3">
                          <select value={block.subjectId ?? ""}
                            onChange={e => updateBlock(day, idx, "subjectId", e.target.value || null)}
                            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white"
                            style={{ outline: "none" }}>
                            <option value="">— Sem matéria fixa —</option>
                            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                          <select value={block.blockType}
                            onChange={e => updateBlock(day, idx, "blockType", e.target.value)}
                            className="w-36 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
                            {BLOCK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </select>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <input type="number" min="0.25" max="12" step="0.25" value={block.hours}
                              onChange={e => updateBlock(day, idx, "hours", parseFloat(e.target.value) || 0.5)}
                              className="w-16 border border-gray-200 rounded-lg px-2 py-2 text-sm text-center" />
                            <span className="text-xs text-gray-400">h</span>
                          </div>
                          <button onClick={() => removeBlock(day, idx)}
                            className="text-gray-300 hover:text-red-500 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-200 p-5">
              <div>
                <p className="text-sm text-gray-500">Total do ciclo</p>
                <p className="text-2xl font-bold text-gray-900">{fmt(draftTotal)}</p>
                <p className="text-xs text-gray-400 mt-0.5">{draftDayOrder.length} dias no ciclo</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setDraftDayOrder(blocksToOrderedDays(blocks)); setDraftBlocks(blocks); setShowConfig(false); }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm font-medium transition-colors">
                  <X className="w-4 h-4" /> Cancelar
                </button>
                <button onClick={save} disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                  style={{ backgroundColor: BG_HEADER }}>
                  <Check className="w-4 h-4" />{saving ? "Salvando..." : "Salvar ciclo"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── MODO VISUALIZAÇÃO ── */}
        {!showConfig && blocks.length > 0 && (
          <div className="space-y-6">
            {/* Legenda */}
            <div className="flex flex-wrap gap-2">
              {subjects.filter(s => blocks.some(b => b.subjectId === s.id)).map(s => {
                const color = subjectColorMap.get(s.id);
                return (
                  <span key={s.id} className={`px-3 py-1 rounded-full text-xs font-medium border ${color?.bg} ${color?.text} ${color?.border}`}>
                    {s.name}
                  </span>
                );
              })}
            </div>

            {/* Grid de dias */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {cycleDays.map((day, idx) => {
                const dayBlocks = blocks.filter(b => b.dayOfWeek === day);
                const dayHours  = dayBlocks.reduce((a, b) => a + b.hours, 0);
                const isCurrent = idx === currentDayIdx;
                return (
                  <div key={day} className={`bg-white rounded-2xl border-2 p-5 ${isCurrent ? "shadow-md" : "border-gray-200"}`}
                    style={isCurrent ? { borderColor: BG_HEADER } : {}}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white"
                          style={{ backgroundColor: isCurrent ? BG_HEADER : "#9CA3AF" }}>
                          {idx + 1}
                        </div>
                        <span className="font-bold text-gray-900">Dia {idx + 1}</span>
                        {isCurrent && (
                          <span className="text-xs text-white px-2 py-0.5 rounded-full" style={{ backgroundColor: BG_HEADER }}>Atual</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <Clock className="w-3 h-3" /> {fmt(dayHours)}
                      </div>
                    </div>
                    <div className="space-y-2">
                      {dayBlocks.map((block, bi) => {
                        const color = block.subjectId ? subjectColorMap.get(block.subjectId) : null;
                        const label = block.subjectName ?? BLOCK_TYPES.find(t => t.value === block.blockType)?.label ?? block.blockType;
                        return (
                          <div key={bi} className={`rounded-lg px-3 py-2 ${color?.bg ?? "bg-gray-50"} border ${color?.border ?? "border-gray-100"}`}>
                            <div className="flex items-center justify-between">
                              <p className={`text-xs font-semibold truncate ${color?.text ?? "text-gray-700"}`}>{label}</p>
                              <p className={`text-xs ml-2 shrink-0 ${color?.text ?? "text-gray-400"}`}>{fmt(block.hours)}</p>
                            </div>
                            <p className={`text-[10px] mt-0.5 opacity-70 ${color?.text ?? "text-gray-400"}`}>
                              {BLOCK_TYPES.find(t => t.value === block.blockType)?.label ?? block.blockType}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Horas por ciclo",  value: fmt(totalHours) },
                { label: "Dias no ciclo",    value: `${cycleDays.length} dias` },
                { label: "Blocos no ciclo",  value: `${blocks.length}` },
                { label: "Média por dia",    value: cycleDays.length > 0 ? fmt(totalHours / cycleDays.length) : "—" },
              ].map(({ label, value }) => (
                <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                  <p className="text-2xl font-bold text-gray-900">{value}</p>
                  <p className="text-xs text-gray-400 mt-1">{label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {!showConfig && blocks.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg font-medium mb-2">Nenhum ciclo configurado</p>
            <p className="text-sm">Clique em "Editar planejamento" para montar seu ciclo.</p>
          </div>
        )}
      </div>
    </div>
  );
}
