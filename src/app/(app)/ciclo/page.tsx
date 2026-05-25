"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Zap, CheckCircle, AlertTriangle, ArrowRight, Clock } from "lucide-react";

interface Block {
  id:          string;
  dayOfWeek:   number;
  hours:       number;
  blockType:   string;
  subjectId:   string | null;
  subjectName: string | null;
}
interface Subject { id: string; name: string; }

const BG_HEADER = "#1B4040";

const BLOCK_TYPE_LABEL: Record<string, string> = {
  leitura:       "Leitura PDF",
  exercicios:    "Exercícios",
  revisao7d:     "Revisão 7d",
  revisao14_30d: "Revisão 14/30d",
};

const CYCLE_KEY    = "estudaai_cycle_day";
const PENDING_KEY  = "estudaai_pending";
const DONE_KEY     = "estudaai_done_ids";

function fmt(h: number) {
  const totalMin = Math.round(h * 60);
  if (totalMin < 60) return `${totalMin}min`;
  const hh = Math.floor(totalMin / 60); const mm = totalMin % 60;
  return mm > 0 ? `${hh}h${mm}min` : `${hh}h`;
}

function getCycleDays(blocks: Block[]): number[] {
  return [...new Set(blocks.map(b => b.dayOfWeek))].sort((a, b) => a - b);
}

export default function CicloPage() {
  const [blocks,        setBlocks]        = useState<Block[]>([]);
  const [subjects,      setSubjects]      = useState<Subject[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [currentDayIdx, setCurrentDayIdx] = useState(0);
  const [pendingBlocks, setPendingBlocks] = useState<Block[]>([]);
  const [doneIds,       setDoneIds]       = useState<Set<string>>(new Set());
  const [completing,    setCompleting]    = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/study-blocks").then(r => r.json()).catch(() => []),
      fetch("/api/subjects").then(r => r.json()).catch(() => []),
    ]).then(([bl, su]) => {
      const mapped: Block[] = Array.isArray(bl) ? bl.map((b: any) => ({
        id: b.id, dayOfWeek: b.dayOfWeek, hours: b.hours,
        blockType: b.blockType, subjectId: b.subjectId ?? null, subjectName: b.subject?.name ?? null,
      })) : [];
      const subs: Subject[] = Array.isArray(su) ? su : su?.subjects ?? [];
      setBlocks(mapped);
      setSubjects(subs);

      const days   = getCycleDays(mapped);
      // ✅ Dia 1 é sempre o dia atual do ciclo (lido do localStorage)
      // Começa em 0 (Dia 1) se nunca foi definido
      const saved  = parseInt(localStorage.getItem(CYCLE_KEY) ?? "0", 10);
      const valid  = Math.min(saved, Math.max(0, days.length - 1));
      setCurrentDayIdx(valid);

      try { setPendingBlocks(JSON.parse(localStorage.getItem(PENDING_KEY) ?? "[]")); } catch { setPendingBlocks([]); }
      try { setDoneIds(new Set(JSON.parse(localStorage.getItem(DONE_KEY) ?? "[]"))); } catch { setDoneIds(new Set()); }
    }).finally(() => setLoading(false));
  }, []);

  const cycleDays      = getCycleDays(blocks);
  const currentDay     = cycleDays[currentDayIdx] ?? -1;
  const todayBlocks    = blocks.filter(b => b.dayOfWeek === currentDay);
  const allToday       = [...pendingBlocks, ...todayBlocks];
  const totalHours     = allToday.reduce((a, b) => a + b.hours, 0);
  const doneCount      = doneIds.size;
  const totalCount     = allToday.length;

  const toggleDone = (id: string) => {
    setDoneIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      localStorage.setItem(DONE_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  const concludeDay = () => {
    setCompleting(true);
    const undone  = allToday.filter(b => !doneIds.has(b.id));
    const nextIdx = (currentDayIdx + 1) % cycleDays.length;
    localStorage.setItem(CYCLE_KEY,   String(nextIdx));
    localStorage.setItem(PENDING_KEY, JSON.stringify(undone));
    localStorage.setItem(DONE_KEY,    "[]");
    setCurrentDayIdx(nextIdx);
    setPendingBlocks(undone);
    setDoneIds(new Set());
    setCompleting(false);
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: BG_HEADER }} />
    </div>
  );

  if (blocks.length === 0) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 text-center px-6">
      <p className="text-gray-500 text-lg font-medium">Nenhum ciclo configurado</p>
      <p className="text-gray-400 text-sm">Configure seus dias de estudo no Calendário do Ciclo.</p>
      <Link href="/calendario-ciclo"
        className="px-5 py-2.5 text-white rounded-xl text-sm font-semibold transition-colors"
        style={{ backgroundColor: BG_HEADER }}>
        Configurar calendário
      </Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header — cor da logo */}
      <div className="text-white px-8 py-8 flex items-center justify-between flex-wrap gap-4"
        style={{ backgroundColor: BG_HEADER }}>
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Zap className="w-6 h-6 text-yellow-300" />
            <h1 className="text-3xl font-bold">Fila do Dia</h1>
          </div>
          <p className="text-sm opacity-60">
            Dia {currentDayIdx + 1} do ciclo · {fmt(totalHours)} programadas
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm opacity-60">{doneCount}/{totalCount} blocos concluídos</span>
          <button onClick={concludeDay} disabled={completing}
            className="flex items-center gap-2 px-5 py-2.5 bg-green-500 hover:bg-green-400 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-colors">
            <CheckCircle className="w-4 h-4" />
            {completing ? "Avançando..." : "Concluir dia"}
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-4">

        {/* Barra de progresso */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium text-gray-700">Progresso do dia</span>
            <span className="text-gray-500">{doneCount} de {totalCount} blocos</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all"
              style={{ width: totalCount > 0 ? `${(doneCount / totalCount) * 100}%` : "0%", backgroundColor: "#22C55E" }} />
          </div>
        </div>

        {/* Pendentes */}
        {pendingBlocks.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2 px-1">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <p className="text-sm font-semibold text-red-600">
                Pendentes de dias anteriores ({pendingBlocks.length})
              </p>
            </div>
            <div className="space-y-2">
              {pendingBlocks.map(block => {
                const done = doneIds.has(block.id);
                const name = block.subjectName ?? subjects.find(s => s.id === block.subjectId)?.name ?? "Sem matéria";
                return (
                  <div key={block.id}
                    className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${done ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Pendente</span>
                        <span className="text-xs text-gray-500">{fmt(block.hours)}</span>
                        <span className="text-xs text-gray-400">{BLOCK_TYPE_LABEL[block.blockType] ?? block.blockType}</span>
                      </div>
                      <p className="font-semibold text-gray-900">{name}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {block.subjectId && (
                        <Link href={`/sessao?subjectId=${block.subjectId}`}
                          className="text-xs text-white px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1"
                          style={{ backgroundColor: BG_HEADER }}>
                          Estudar <ArrowRight className="w-3 h-3" />
                        </Link>
                      )}
                      <button onClick={() => toggleDone(block.id)}
                        className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors ${done ? "bg-green-500 border-green-500 text-white" : "border-gray-300 hover:border-green-400"}`}>
                        {done && <CheckCircle className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Blocos do dia atual */}
        <div>
          <p className="text-sm font-semibold text-gray-600 mb-2 px-1">Dia {currentDayIdx + 1} do ciclo</p>
          <div className="space-y-2">
            {todayBlocks.map((block, i) => {
              const done = doneIds.has(block.id);
              const name = block.subjectName ?? "Sem matéria";
              return (
                <div key={block.id}
                  className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${done ? "bg-green-50 border-green-200" : "bg-white border-gray-200"}`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${done ? "bg-green-500 text-white" : "bg-gray-100 text-gray-600"}`}>
                    {done ? <CheckCircle className="w-5 h-5" /> : i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {fmt(block.hours)}
                      </span>
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                        {BLOCK_TYPE_LABEL[block.blockType] ?? block.blockType}
                      </span>
                    </div>
                    <p className={`font-semibold ${done ? "line-through text-gray-400" : "text-gray-900"}`}>{name}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {block.subjectId && !done && (
                      <Link href={`/sessao?subjectId=${block.subjectId}`}
                        className="text-xs text-white px-3 py-1.5 rounded-lg font-medium flex items-center gap-1 transition-colors"
                        style={{ backgroundColor: BG_HEADER }}>
                        Começar <ArrowRight className="w-3 h-3" />
                      </Link>
                    )}
                    <button onClick={() => toggleDone(block.id)}
                      className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors ${done ? "bg-green-500 border-green-500 text-white" : "border-gray-300 hover:border-green-400"}`}>
                      {done && <CheckCircle className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Visão do ciclo completo */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <p className="text-sm font-semibold text-gray-700 mb-3">Ciclo completo</p>
          <div className="flex flex-wrap gap-2">
            {cycleDays.map((day, idx) => {
              const dayHours = blocks.filter(b => b.dayOfWeek === day).reduce((a, b) => a + b.hours, 0);
              const isCurrent = idx === currentDayIdx;
              return (
                <div key={day}
                  className="flex flex-col items-center px-4 py-2 rounded-xl border-2 text-sm"
                  style={isCurrent
                    ? { borderColor: BG_HEADER, backgroundColor: BG_HEADER, color: "#fff" }
                    : { borderColor: "#E5E7EB", backgroundColor: "#F9FAFB", color: "#6B7280" }}>
                  <span className="font-bold">Dia {idx + 1}</span>
                  <span className="text-xs mt-0.5 opacity-70">{fmt(dayHours)}</span>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
