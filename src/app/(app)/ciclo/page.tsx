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
interface TodaySession {
  subjectId:   string;
  subjectName: string;
  hours:       number;
  questions:   number;
  correct:     number;
  wrong:       number;
  createdAt:   string;
}

const BG = "#1B4040";

const BLOCK_LABEL: Record<string, string> = {
  leitura:       "Leitura PDF",
  exercicios:    "Exercícios",
  revisao7d:     "Revisão 7d",
  revisao14_30d: "Revisão 14/30d",
};

const CYCLE_KEY   = "estudaai_cycle_day";
const PENDING_KEY = "estudaai_pending";
const LAST_DATE_KEY = "estudaai_last_date";

function fmt(h: number) {
  const m = Math.round(h * 60);
  if (m < 60) return `${m}min`;
  const hh = Math.floor(m / 60); const mm = m % 60;
  return mm > 0 ? `${hh}h${mm}min` : `${hh}h`;
}

function getCycleDays(blocks: Block[]): number[] {
  const seen: Record<number, boolean> = {};
  const days: number[] = [];
  blocks.forEach(b => { if (!seen[b.dayOfWeek]) { seen[b.dayOfWeek] = true; days.push(b.dayOfWeek); } });
  return days.sort((a, b) => a - b);
}

function toBRDate(date: Date): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(date);
  } catch {
    const br = new Date(date.getTime() - 3 * 60 * 60 * 1000);
    return br.toISOString().slice(0, 10);
  }
}

export default function CicloPage() {
  const [blocks,        setBlocks]        = useState<Block[]>([]);
  const [subjects,      setSubjects]      = useState<Subject[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [currentDayIdx, setCurrentDayIdx] = useState(0);
  const [pendingBlocks, setPendingBlocks] = useState<Block[]>([]);
  const [completing,    setCompleting]    = useState(false);
  const [todaySessions, setTodaySessions] = useState<TodaySession[]>([]);
  // studiedTodayIds: objeto simples em vez de Set para evitar problemas de compatibilidade
  const [studiedIds,    setStudiedIds]    = useState<Record<string, boolean>>({});
  // manualDone: mesmo padrão
  const [manualDone,    setManualDone]    = useState<Record<string, boolean>>({});
  // historyByDay: dayOfWeek → objeto de subjectIds estudados
  const [historyByDay,  setHistoryByDay]  = useState<Record<number, Record<string, boolean>>>({});
  const [selectedDayIdx, setSelectedDayIdx] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/study-blocks").then(r => r.json()).catch(() => []),
      fetch("/api/subjects").then(r => r.json()).catch(() => []),
      fetch("/api/historico").then(r => r.json()).catch(() => []),
    ]).then(([bl, su, hist]) => {
      const mapped: Block[] = Array.isArray(bl) ? bl.map((b: any) => ({
        id: b.id, dayOfWeek: b.dayOfWeek, hours: b.hours,
        blockType: b.blockType, subjectId: b.subjectId ?? null,
        subjectName: b.subject?.name ?? null,
      })) : [];

      const subs: Subject[] = Array.isArray(su) ? su : (su?.subjects ?? []);
      setBlocks(mapped);
      setSubjects(subs);

      const days       = getCycleDays(mapped);
      const todayDS    = toBRDate(new Date());
      const lastDate   = localStorage.getItem(LAST_DATE_KEY);
      const savedIdx   = parseInt(localStorage.getItem(CYCLE_KEY) ?? "0", 10);
      const clampedIdx = Math.min(savedIdx, Math.max(0, days.length - 1));

      // Processa histórico
      if (Array.isArray(hist)) {
        // Sessões de hoje
        const todayGroup = hist.find((d: any) => d.date === todayDS);
        const todaySess: TodaySession[] = todayGroup?.sessions ?? [];
        setTodaySessions(todaySess);

        const studied: Record<string, boolean> = {};
        todaySess.forEach((s: any) => { if (s.subjectId) studied[s.subjectId] = true; });
        setStudiedIds(studied);

        // Mapa de data → subjectIds estudados
        const dateToSubjects: Record<string, Record<string, boolean>> = {};
        (hist as any[]).forEach(dayGroup => {
          const obj: Record<string, boolean> = {};
          (dayGroup.sessions ?? []).forEach((s: any) => { if (s.subjectId) obj[s.subjectId] = true; });
          dateToSubjects[dayGroup.date] = obj;
        });

        const sortedDates = Object.keys(dateToSubjects).sort().reverse();
        const uniqueDays = days;
        const savedCycleIdx = clampedIdx;
        const hbd: Record<number, Record<string, boolean>> = {};
        uniqueDays.forEach((dayOfWeek, idx) => {
          const daysBack = (savedCycleIdx - idx + uniqueDays.length) % uniqueDays.length;
          const dateForDay = sortedDates[daysBack];
          hbd[dayOfWeek] = dateForDay ? (dateToSubjects[dateForDay] ?? {}) : {};
        });
        setHistoryByDay(hbd);

        // Verifica se o dia virou e cria pendências automaticamente
        if (lastDate && lastDate !== todayDS) {
          const prevDay    = days[clampedIdx] ?? -1;
          const prevBlocks = mapped.filter(b => b.dayOfWeek === prevDay);

          const yesterdayDS = (() => {
            const d = new Date(); d.setDate(d.getDate() - 1);
            return toBRDate(d);
          })();
          const yesterdayStudied = dateToSubjects[yesterdayDS] ?? {};
          const sessionCountYest: Record<string, number> = {};
          const yesterdayGroup = hist.find((d: any) => d.date === yesterdayDS);
          (yesterdayGroup?.sessions ?? []).forEach((s: any) => {
            sessionCountYest[s.subjectId] = (sessionCountYest[s.subjectId] ?? 0) + 1;
          });

          const usedYest: Record<string, number> = {};
          const savedPending: Block[] = (() => {
            try { return JSON.parse(localStorage.getItem(PENDING_KEY) ?? "[]"); } catch { return []; }
          })();
          const newPending: Block[] = [];
          prevBlocks.forEach(b => {
            if (!b.subjectId) return;
            const avail = sessionCountYest[b.subjectId] ?? 0;
            const used  = usedYest[b.subjectId] ?? 0;
            if (used < avail) { usedYest[b.subjectId] = used + 1; }
            else { newPending.push(b); }
          });

          const nextIdx = (clampedIdx + 1) % days.length;
          localStorage.setItem(CYCLE_KEY, String(nextIdx));
          localStorage.setItem(PENDING_KEY, JSON.stringify([...savedPending, ...newPending]));
          setCurrentDayIdx(nextIdx);
          setPendingBlocks([...savedPending, ...newPending]);
        } else {
          setCurrentDayIdx(clampedIdx);
          try { setPendingBlocks(JSON.parse(localStorage.getItem(PENDING_KEY) ?? "[]")); } catch { setPendingBlocks([]); }
        }
      } else {
        setCurrentDayIdx(clampedIdx);
        try { setPendingBlocks(JSON.parse(localStorage.getItem(PENDING_KEY) ?? "[]")); } catch { setPendingBlocks([]); }
      }

      localStorage.setItem(LAST_DATE_KEY, todayDS);
    }).finally(() => setLoading(false));
  }, []);

  // Verifica meia-noite a cada minuto
  useEffect(() => {
    const check = () => {
      const last  = localStorage.getItem(LAST_DATE_KEY);
      const today = toBRDate(new Date());
      if (last && last !== today) window.location.reload(); // recarrega para processar pendências
    };
    const iv = setInterval(check, 60000);
    return () => clearInterval(iv);
  }, []);

  const cycleDays   = getCycleDays(blocks);
  const currentDay  = cycleDays[currentDayIdx] ?? -1;
  const todayBlocks = blocks.filter(b => b.dayOfWeek === currentDay);
  const allToday    = [...pendingBlocks, ...todayBlocks];
  const totalHours  = allToday.reduce((a, b) => a + b.hours, 0);

  // Conta sessões de hoje por matéria
  const sessionCountToday: Record<string, number> = {};
  todaySessions.forEach(s => {
    sessionCountToday[s.subjectId] = (sessionCountToday[s.subjectId] ?? 0) + 1;
  });

  // Calcula quais blocos estão feitos (automático + manual), respeitando a ordem
  const computeDoneIds = (): Record<string, boolean> => {
    const done: Record<string, boolean> = {};
    const used: Record<string, number> = {};
    allToday.forEach(b => {
      if (!b.subjectId) {
        if (manualDone[b.id]) done[b.id] = true;
        return;
      }
      const avail = sessionCountToday[b.subjectId] ?? 0;
      const u     = used[b.subjectId] ?? 0;
      if (u < avail) { done[b.id] = true; used[b.subjectId] = u + 1; }
      else if (manualDone[b.id]) done[b.id] = true;
    });
    return done;
  };

  const blockDoneMap   = computeDoneIds();
  const isDone         = (b: Block) => !!blockDoneMap[b.id];
  const doneCount      = Object.keys(blockDoneMap).length;
  const totalCount     = allToday.length;

  const toggleManual = (id: string) => {
    setManualDone(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const concludeDay = () => {
    setCompleting(true);
    const undone  = allToday.filter(b => !isDone(b));
    const nextIdx = (currentDayIdx + 1) % cycleDays.length;
    localStorage.setItem(CYCLE_KEY,   String(nextIdx));
    localStorage.setItem(PENDING_KEY, JSON.stringify(undone));
    setCurrentDayIdx(nextIdx);
    setPendingBlocks(undone);
    setManualDone({});
    setCompleting(false);
  };

  // Status de cada dia do ciclo para coloração
  const getDayStatus = (dayOfWeek: number, idx: number): "current" | "done" | "partial" | "future" => {
    if (idx === currentDayIdx) return "current";
    const dayBlocks  = blocks.filter(b => b.dayOfWeek === dayOfWeek);
    const studied    = historyByDay[dayOfWeek] ?? {};
    const subIds     = dayBlocks.map(b => b.subjectId).filter(Boolean) as string[];
    if (!subIds.length) return "future";
    const studiedCount = subIds.filter(id => studied[id]).length;
    if (studiedCount === subIds.length) return "done";
    if (studiedCount > 0) return "partial";
    return "future";
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: BG }} />
    </div>
  );

  if (!blocks.length) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 text-center px-6">
      <p className="text-gray-500 text-lg font-medium">Nenhum ciclo configurado</p>
      <p className="text-gray-400 text-sm">Configure seus dias de estudo no Calendário do Ciclo.</p>
      <Link href="/calendario-ciclo"
        className="px-5 py-2.5 text-white rounded-xl text-sm font-semibold"
        style={{ backgroundColor: BG }}>
        Configurar calendário
      </Link>
    </div>
  );

  const DAY_STATUS_STYLE = {
    current: { borderColor: BG,        backgroundColor: BG,        color: "#fff"    },
    done:    { borderColor: "#22c55e", backgroundColor: "#f0fdf4", color: "#16a34a" },
    partial: { borderColor: "#f59e0b", backgroundColor: "#fffbeb", color: "#d97706" },
    future:  { borderColor: "#E5E7EB", backgroundColor: "#F9FAFB", color: "#6B7280" },
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="text-white px-8 py-8 flex items-center justify-between flex-wrap gap-4"
        style={{ backgroundColor: BG }}>
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
          <button onClick={() => {
            const prev = (currentDayIdx - 1 + cycleDays.length) % cycleDays.length;
            setCurrentDayIdx(prev);
            localStorage.setItem(CYCLE_KEY, String(prev));
            setManualDone({});
          }} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center font-bold">‹</button>
          <button onClick={() => {
            const next = (currentDayIdx + 1) % cycleDays.length;
            setCurrentDayIdx(next);
            localStorage.setItem(CYCLE_KEY, String(next));
            setManualDone({});
          }} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center font-bold">›</button>
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
          {Object.keys(studiedIds).length > 0 && (
            <p className="text-xs text-green-600 mt-2">
              ✓ {Object.keys(studiedIds).length} matéria(s) detectadas automaticamente pelo histórico de hoje
            </p>
          )}
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
                const done = isDone(block);
                const auto = block.subjectId ? !!studiedIds[block.subjectId] : false;
                const name = block.subjectName ?? subjects.find(s => s.id === block.subjectId)?.name ?? "Sem matéria";
                return (
                  <div key={block.id}
                    className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${done ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Pendente</span>
                        <span className="text-xs text-gray-500">{fmt(block.hours)}</span>
                        <span className="text-xs text-gray-400">{BLOCK_LABEL[block.blockType] ?? block.blockType}</span>
                        {auto && <span className="text-xs text-green-600 font-medium">✓ estudado hoje</span>}
                      </div>
                      <p className="font-semibold text-gray-900">{name}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {block.subjectId && !done && (
                        <Link href={`/sessao?subjectId=${block.subjectId}`}
                          className="text-xs text-white px-3 py-1.5 rounded-lg font-medium flex items-center gap-1"
                          style={{ backgroundColor: BG }}>
                          Estudar <ArrowRight className="w-3 h-3" />
                        </Link>
                      )}
                      {!auto && (
                        <button onClick={() => toggleManual(block.id)}
                          className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors ${manualDone[block.id] ? "bg-green-500 border-green-500 text-white" : "border-gray-300 hover:border-green-400"}`}>
                          {manualDone[block.id] && <CheckCircle className="w-4 h-4" />}
                        </button>
                      )}
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
              const done = isDone(block);
              const auto = block.subjectId ? !!studiedIds[block.subjectId] : false;
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
                        {BLOCK_LABEL[block.blockType] ?? block.blockType}
                      </span>
                      {auto && <span className="text-xs text-green-600 font-medium">✓ registrado hoje</span>}
                    </div>
                    <p className={`font-semibold ${done ? "line-through text-gray-400" : "text-gray-900"}`}>{name}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {block.subjectId && !done && (
                      <Link href={`/sessao?subjectId=${block.subjectId}`}
                        className="text-xs text-white px-3 py-1.5 rounded-lg font-medium flex items-center gap-1"
                        style={{ backgroundColor: BG }}>
                        Começar <ArrowRight className="w-3 h-3" />
                      </Link>
                    )}
                    {!auto && (
                      <button onClick={() => toggleManual(block.id)}
                        className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors ${manualDone[block.id] ? "bg-green-500 border-green-500 text-white" : "border-gray-300 hover:border-green-400"}`}>
                        {manualDone[block.id] && <CheckCircle className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Ciclo completo */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <p className="text-sm font-semibold text-gray-700 mb-3">Ciclo completo</p>
          <div className="flex flex-wrap gap-2">
            {cycleDays.map((day, idx) => {
              const dayHours  = blocks.filter(b => b.dayOfWeek === day).reduce((a, b) => a + b.hours, 0);
              const status    = getDayStatus(day, idx);
              const st        = DAY_STATUS_STYLE[status];
              const isSelected = selectedDayIdx === idx;
              const label     = status === "done" ? "✓" : status === "partial" ? "~" : "";
              return (
                <button key={day}
                  onClick={() => setSelectedDayIdx(isSelected ? null : idx)}
                  className="flex flex-col items-center px-4 py-2 rounded-xl border-2 text-sm transition-all hover:scale-105"
                  style={st}>
                  <span className="font-bold">Dia {idx + 1} {label}</span>
                  <span className="text-xs mt-0.5 opacity-70">{fmt(dayHours)}</span>
                </button>
              );
            })}
          </div>

          {/* Legenda */}
          <div className="flex items-center gap-3 mt-3 flex-wrap text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-500 inline-block" /> Concluído</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-yellow-400 inline-block" /> Parcial</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: BG }} /> Hoje</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-gray-200 inline-block" /> Futuro</span>
          </div>

          {/* Detalhe do dia selecionado */}
          {selectedDayIdx !== null && (() => {
            const selDay    = cycleDays[selectedDayIdx];
            const selBlocks = blocks.filter(b => b.dayOfWeek === selDay);
            const selStudied = historyByDay[selDay] ?? {};
            const isToday   = selectedDayIdx === currentDayIdx;
            return (
              <div className="mt-4 border-t border-gray-100 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-bold text-gray-900">Dia {selectedDayIdx + 1} — Matérias</p>
                  <button onClick={() => setSelectedDayIdx(null)} className="text-xs text-gray-400 hover:text-gray-600">Fechar ✕</button>
                </div>
                <div className="space-y-2">
                  {selBlocks.map(b => {
                    const name    = b.subjectName ?? subjects.find(s => s.id === b.subjectId)?.name ?? "—";
                    const studied = b.subjectId ? (isToday ? !!studiedIds[b.subjectId] : !!selStudied[b.subjectId]) : false;
                    const matSessions = isToday ? todaySessions.filter(s => s.subjectId === b.subjectId) : [];
                    return (
                      <div key={b.id} className={`rounded-xl border px-4 py-3 ${studied ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"}`}>
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{name}</p>
                            <p className="text-xs text-gray-500">{fmt(b.hours)} · {BLOCK_LABEL[b.blockType] ?? b.blockType}</p>
                          </div>
                          {studied
                            ? <span className="text-xs text-green-600 font-bold">✓ Feito</span>
                            : <span className="text-xs text-gray-400">Pendente</span>}
                        </div>
                        {matSessions.length > 0 && (
                          <div className="flex gap-4 mt-2 text-xs text-gray-600">
                            <span>⏱ {matSessions.reduce((a, s) => a + s.hours, 0).toFixed(1)}h</span>
                            {matSessions.some(s => s.questions > 0) && (
                              <>
                                <span className="text-green-600">✓ {matSessions.reduce((a, s) => a + s.correct, 0)}</span>
                                <span className="text-red-500">✗ {matSessions.reduce((a, s) => a + s.wrong, 0)}</span>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>

      </div>
    </div>
  );
}
