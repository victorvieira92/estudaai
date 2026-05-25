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

const BLOCK_TYPE_LABEL: Record<string, string> = {
  leitura:       "Leitura PDF",
  exercicios:    "Exercícios",
  revisao7d:     "Revisão 7d",
  revisao14_30d: "Revisão 14/30d",
};

const CYCLE_KEY = "estudaai_cycle_day"; // localStorage: qual dia do ciclo está ativo

function fmt(h: number) {
  const totalMin = Math.round(h * 60);
  if (totalMin < 60) return `${totalMin}min`;
  const hh = Math.floor(totalMin / 60); const mm = totalMin % 60;
  return mm > 0 ? `${hh}h${mm}min` : `${hh}h`;
}

// Retorna os dias únicos do ciclo ordenados (0-indexed: Dia 1 = index 0)
function getCycleDays(blocks: Block[]): number[] {
  const days = [...new Set(blocks.map(b => b.dayOfWeek))].sort((a, b) => a - b);
  return days;
}

export default function CicloPage() {
  const [blocks,       setBlocks]       = useState<Block[]>([]);
  const [subjects,     setSubjects]     = useState<Subject[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [currentDayIdx, setCurrentDayIdx] = useState(0); // qual dia do ciclo (0-based)
  const [pendingBlocks, setPendingBlocks] = useState<Block[]>([]); // blocos não concluídos de dias anteriores
  const [doneIds,      setDoneIds]      = useState<Set<string>>(new Set());
  const [completing,   setCompleting]   = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/study-blocks").then(r => r.json()).catch(() => []),
      fetch("/api/subjects").then(r => r.json()).catch(() => []),
    ]).then(([blocksRaw, subjectsRaw]) => {
      const bl: Block[] = Array.isArray(blocksRaw) ? blocksRaw.map((b: any) => ({
        id:          b.id,
        dayOfWeek:   b.dayOfWeek,
        hours:       b.hours,
        blockType:   b.blockType,
        subjectId:   b.subjectId ?? null,
        subjectName: b.subject?.name ?? null,
      })) : [];
      const su: Subject[] = Array.isArray(subjectsRaw) ? subjectsRaw : subjectsRaw?.subjects ?? [];
      setBlocks(bl);
      setSubjects(su);

      // Recupera o dia atual do ciclo do localStorage
      const savedIdx = parseInt(localStorage.getItem(CYCLE_KEY) ?? "0", 10);
      const days = getCycleDays(bl);
      const validIdx = Math.min(savedIdx, Math.max(0, days.length - 1));
      setCurrentDayIdx(validIdx);

      // Recupera pendentes salvos
      try {
        const savedPending = JSON.parse(localStorage.getItem("estudaai_pending") ?? "[]");
        setPendingBlocks(savedPending);
      } catch { setPendingBlocks([]); }
    }).finally(() => setLoading(false));
  }, []);

  const cycleDays = getCycleDays(blocks);
  const currentDayOfWeek = cycleDays[currentDayIdx] ?? -1;
  const todayBlocks = blocks.filter(b => b.dayOfWeek === currentDayOfWeek);
  const allToday = [...pendingBlocks, ...todayBlocks];
  const totalHours = allToday.reduce((a, b) => a + b.hours, 0);

  const toggleDone = (id: string) => {
    setDoneIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Concluir dia — avança para o próximo, blocos não marcados viram pendentes
  const concludeDay = async () => {
    setCompleting(true);
    const undoneBlocks = allToday.filter(b => !doneIds.has(b.id));
    const nextIdx = (currentDayIdx + 1) % cycleDays.length;

    localStorage.setItem(CYCLE_KEY, String(nextIdx));
    localStorage.setItem("estudaai_pending", JSON.stringify(undoneBlocks));

    setCurrentDayIdx(nextIdx);
    setPendingBlocks(undoneBlocks);
    setDoneIds(new Set());
    setCompleting(false);
  };

  const doneCount = doneIds.size;
  const totalCount = allToday.length;

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (blocks.length === 0) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center flex-col gap-4 text-center px-6">
      <p className="text-gray-500 text-lg font-medium">Nenhum ciclo configurado</p>
      <p className="text-gray-400 text-sm">Configure seus dias de estudo no Calendário do Ciclo primeiro.</p>
      <Link href="/calendario-ciclo" className="px-5 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-700 transition-colors">
        Configurar calendário
      </Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gray-950 text-white px-8 py-8 flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Zap className="w-6 h-6 text-yellow-400" />
            <h1 className="text-3xl font-bold">Fila do Dia</h1>
          </div>
          <p className="text-gray-400 text-sm">
            Dia {currentDayIdx + 1} do ciclo · {fmt(totalHours)} programadas
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">
            {doneCount}/{totalCount} blocos concluídos
          </span>
          <button
            onClick={concludeDay}
            disabled={completing}
            className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-colors"
          >
            <CheckCircle className="w-4 h-4" />
            {completing ? "Avançando..." : "Concluir dia"}
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-4">

        {/* Barra de progresso do dia */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium text-gray-700">Progresso do dia</span>
            <span className="text-gray-500">{doneCount} de {totalCount} blocos</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-green-500 transition-all"
              style={{ width: totalCount > 0 ? `${(doneCount / totalCount) * 100}%` : "0%" }}
            />
          </div>
        </div>

        {/* Pendentes de dias anteriores */}
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
                const subj = block.subjectId ? subjects.find(s => s.id === block.subjectId) : null;
                const name = block.subjectName ?? subj?.name ?? "Sem matéria";
                return (
                  <div key={block.id} className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${done ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Pendente</span>
                        <span className="text-xs text-gray-500">{fmt(block.hours)}</span>
                        <span className="text-xs text-gray-400">{BLOCK_TYPE_LABEL[block.blockType] ?? block.blockType}</span>
                      </div>
                      <p className="font-semibold text-gray-900 mt-0.5">{name}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {block.subjectId && (
                        <Link href={`/sessao?subjectId=${block.subjectId}`}
                          className="text-xs bg-gray-900 hover:bg-gray-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1">
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

        {/* Blocos de hoje */}
        <div>
          <p className="text-sm font-semibold text-gray-600 mb-2 px-1">
            Dia {currentDayIdx + 1} do ciclo
          </p>
          <div className="space-y-2">
            {todayBlocks.map((block, i) => {
              const done = doneIds.has(block.id);
              const name = block.subjectName ?? "Sem matéria";
              return (
                <div key={block.id}
                  className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                    done ? "bg-green-50 border-green-200" : "bg-white border-gray-200"
                  }`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${
                    done ? "bg-green-500 text-white" : "bg-gray-100 text-gray-600"
                  }`}>
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
                    <p className={`font-semibold ${done ? "line-through text-gray-400" : "text-gray-900"}`}>
                      {name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {block.subjectId && !done && (
                      <Link href={`/sessao?subjectId=${block.subjectId}`}
                        className="text-xs bg-gray-900 hover:bg-gray-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1">
                        Começar <ArrowRight className="w-3 h-3" />
                      </Link>
                    )}
                    <button onClick={() => toggleDone(block.id)}
                      className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors ${
                        done ? "bg-green-500 border-green-500 text-white" : "border-gray-300 hover:border-green-400"
                      }`}>
                      {done && <CheckCircle className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Navegação do ciclo */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <p className="text-sm font-semibold text-gray-700 mb-3">Ciclo completo</p>
          <div className="flex flex-wrap gap-2">
            {cycleDays.map((day, idx) => {
              const dayBlocks = blocks.filter(b => b.dayOfWeek === day);
              const dayHours  = dayBlocks.reduce((a, b) => a + b.hours, 0);
              const isCurrent = idx === currentDayIdx;
              return (
                <div key={day}
                  className={`flex flex-col items-center px-4 py-2 rounded-xl border-2 text-sm ${
                    isCurrent ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-gray-50 text-gray-600"
                  }`}>
                  <span className="font-bold">Dia {idx + 1}</span>
                  <span className={`text-xs mt-0.5 ${isCurrent ? "text-gray-300" : "text-gray-400"}`}>{fmt(dayHours)}</span>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
