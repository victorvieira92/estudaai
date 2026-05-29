"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Zap, CheckCircle, AlertTriangle, ArrowRight, Clock, ChevronDown, ChevronUp } from "lucide-react";

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

const BG_HEADER = "#1B4040";

const BLOCK_TYPE_LABEL: Record<string, string> = {
  leitura:       "Leitura PDF",
  exercicios:    "Exercícios",
  revisao7d:     "Revisão 7d",
  revisao14_30d: "Revisão 14/30d",
};

const CYCLE_KEY   = "estudaai_cycle_day";
const PENDING_KEY = "estudaai_pending";

function fmt(h: number) {
  const totalMin = Math.round(h * 60);
  if (totalMin < 60) return `${totalMin}min`;
  const hh = Math.floor(totalMin / 60); const mm = totalMin % 60;
  return mm > 0 ? `${hh}h${mm}min` : `${hh}h`;
}

function getCycleDays(blocks: Block[]): number[] {
  return [...new Set(blocks.map(b => b.dayOfWeek))].sort((a, b) => a - b);
}

function toBRDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(date);
}

export default function CicloPage() {
  const [blocks,        setBlocks]        = useState<Block[]>([]);
  const [subjects,      setSubjects]      = useState<Subject[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [currentDayIdx, setCurrentDayIdx] = useState(0);
  const [pendingBlocks, setPendingBlocks] = useState<Block[]>([]);
  const [completing,    setCompleting]    = useState(false);

  // Sessões de hoje (vindas da API — fonte da verdade)
  const [todaySessions, setTodaySessions] = useState<TodaySession[]>([]);

  // Para cada dia do ciclo: Set de subjectIds estudados naquela data histórica
  const [historyByDay, setHistoryByDay]   = useState<Record<number, Set<string>>>({});

  // Dia selecionado no Ciclo completo para ver detalhes
  const [selectedDayIdx, setSelectedDayIdx] = useState<number | null>(null);

  // Verifica automaticamente à meia-noite se o dia virou
  // Se virou, move blocos não feitos para pendências e avança o ciclo
  useEffect(() => {
    const checkMidnight = () => {
      const lastDate = localStorage.getItem("estudaai_last_date");
      const todayDS  = toBRDate(new Date());
      if (lastDate && lastDate !== todayDS) {
        // Dia virou — move não feitos para pendências
        const savedBlocks: Block[] = (() => {
          try { return JSON.parse(localStorage.getItem(PENDING_KEY) ?? "[]"); } catch { return []; }
        })();
        // Os blocos não feitos de ontem viram pendências
        // O ciclo avança automaticamente
        const savedIdx = parseInt(localStorage.getItem(CYCLE_KEY) ?? "0", 10);
        // Não avança aqui — só marca o dia como virado
        // O avanço acontece no próximo load com os blocos não feitos já como pendências
        localStorage.setItem("estudaai_last_date", todayDS);
      } else if (!lastDate) {
        localStorage.setItem("estudaai_last_date", todayDS);
      }
    };
    checkMidnight();

    // Verifica a cada minuto se virou meia-noite
    const interval = setInterval(checkMidnight, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/study-blocks").then(r => r.json()).catch(() => []),
      fetch("/api/subjects").then(r => r.json()).catch(() => []),
      fetch("/api/historico").then(r => r.json()).catch(() => []),
    ]).then(([bl, su, hist]) => {
      const mapped: Block[] = Array.isArray(bl) ? bl.map((b: any) => ({
        id: b.id, dayOfWeek: b.dayOfWeek, hours: b.hours,
        blockType: b.blockType, subjectId: b.subjectId ?? null, subjectName: b.subject?.name ?? null,
      })) : [];
      const subs: Subject[] = Array.isArray(su) ? su : su?.subjects ?? [];
      setBlocks(mapped);
      setSubjects(subs);

      const days = getCycleDays(mapped);

      // Verifica se o dia virou desde a última visita
      // Se virou, os blocos não concluídos do dia anterior viram pendências
      const lastDate = localStorage.getItem("estudaai_last_date");
      const todayDS  = toBRDate(new Date());

      if (lastDate && lastDate !== todayDS) {
        // Dia virou — o que estava no dia atual e não foi feito vira pendência
        // Carrega os blocos do dia anterior (que era o currentDayIdx salvo)
        const prevIdx    = parseInt(localStorage.getItem(CYCLE_KEY) ?? "0", 10);
        const prevDays   = getCycleDays(mapped);
        const prevDay    = prevDays[prevIdx] ?? -1;
        const prevBlocks = mapped.filter(b => b.dayOfWeek === prevDay);

        // Busca sessões de ontem para saber o que foi feito
        const yesterdayDS = (() => {
          const d = new Date();
          d.setDate(d.getDate() - 1);
          return toBRDate(d);
        })();
        // Sessions de ontem vêm do histórico já carregado
        const histAny = hist as any[];
        const yesterdayGroup = histAny.find((d: any) => d.date === yesterdayDS);
        const yesterdaySessions = yesterdayGroup?.sessions ?? [];
        const yesterdayStudied = new Set<string>(yesterdaySessions.map((s: any) => s.subjectId));

        // Blocos não feitos ontem = pendências
        const sessionCountYesterday: Record<string, number> = {};
        for (const s of yesterdaySessions) {
          sessionCountYesterday[s.subjectId] = (sessionCountYesterday[s.subjectId] ?? 0) + 1;
        }
        const usedYesterday: Record<string, number> = {};
        const savedPending: Block[] = (() => {
          try { return JSON.parse(localStorage.getItem(PENDING_KEY) ?? "[]"); } catch { return []; }
        })();

        const newPending: Block[] = [];
        for (const b of prevBlocks) {
          if (!b.subjectId) continue;
          const available = sessionCountYesterday[b.subjectId] ?? 0;
          const used      = usedYesterday[b.subjectId] ?? 0;
          if (used < available) { usedYesterday[b.subjectId] = used + 1; }
          else { newPending.push(b); }
        }

        // Avança o ciclo para o próximo dia
        const nextIdx = (prevIdx + 1) % prevDays.length;
        localStorage.setItem(CYCLE_KEY, String(nextIdx));
        localStorage.setItem(PENDING_KEY, JSON.stringify([...savedPending, ...newPending]));
        localStorage.setItem("estudaai_last_date", todayDS);

        setCurrentDayIdx(nextIdx);
        setPendingBlocks([...savedPending, ...newPending]);
      } else {
        const savedIdx = parseInt(localStorage.getItem(CYCLE_KEY) ?? "0", 10);
        const valid    = Math.min(savedIdx, Math.max(0, days.length - 1));
        setCurrentDayIdx(valid);
        try { setPendingBlocks(JSON.parse(localStorage.getItem(PENDING_KEY) ?? "[]")); } catch { setPendingBlocks([]); }
      }

      localStorage.setItem("estudaai_last_date", todayDS);

      // ── Processa histórico para saber quais matérias foram estudadas ─────
      if (Array.isArray(hist)) {
        // Sessões de hoje
        const todayDS = toBRDate(new Date());
        const todayGroup = hist.find((d: any) => d.date === todayDS);
        setTodaySessions(todayGroup?.sessions ?? []);

        // Para cada dia do ciclo (dayOfWeek 0..N), descobre a data passada
        // correspondente e verifica quais matérias foram estudadas
        // Estratégia: percorre o histórico completo e mapeia por cycleDay
        // Precisamos saber: "no último ciclo em que era o dia X, quais matérias foram vistas?"
        // Simplificação prática: olha as ÚLTIMAS ocorrências de cada cycleDay
        // baseado nas datas do histórico ordenadas

        // Monta um mapa de data → Set<subjectId>
        const dateToSubjects: Record<string, Set<string>> = {};
        for (const dayGroup of hist as any[]) {
          const set = new Set<string>();
          for (const s of dayGroup.sessions ?? []) {
            if (s.subjectId) set.add(s.subjectId);
          }
          dateToSubjects[dayGroup.date] = set;
        }

        // Para colorir os dias do ciclo, precisa saber:
        // "O dia X do ciclo foi completamente estudado?"
        // Como o ciclo não tem datas fixas, usamos uma heurística:
        // os últimos N dias do histórico correspondem a N dias do ciclo
        // Aqui apenas olhamos se cada dayOfWeek único tem sessões de hoje
        // (para o dia atual) e deixamos os outros como estado neutro
        // A coloração real por histórico requer persistir qual data = qual dia do ciclo
        // que não temos agora — implementamos com o que temos

        // Para os dias passados, usamos o histórico dos últimos 7 dias como proxy
        const sortedDates = Object.keys(dateToSubjects).sort().reverse();
        const hbd: Record<number, Set<string>> = {};
        const uniqueDays = [...new Set(mapped.map(b => b.dayOfWeek))].sort((a,b) => a-b);
        const savedCycleIdx = parseInt(localStorage.getItem(CYCLE_KEY) ?? "0", 10);

        // Associa cada dia do ciclo ao dia de histórico correspondente
        // O dia atual (currentDayIdx) = hoje, dia anterior = ontem, etc.
        uniqueDays.forEach((dayOfWeek, idx) => {
          const daysBack = (savedCycleIdx - idx + uniqueDays.length) % uniqueDays.length;
          const dateForDay = sortedDates[daysBack];
          if (dateForDay) {
            hbd[dayOfWeek] = dateToSubjects[dateForDay] ?? new Set();
          } else {
            hbd[dayOfWeek] = new Set();
          }
        });
        setHistoryByDay(hbd);
      }
    }).finally(() => setLoading(false));
  }, []);

  const cycleDays   = getCycleDays(blocks);
  const currentDay  = cycleDays[currentDayIdx] ?? -1;
  const todayBlocks = blocks.filter(b => b.dayOfWeek === currentDay);
  const allToday    = [...pendingBlocks, ...todayBlocks];
  const totalHours  = allToday.reduce((a, b) => a + b.hours, 0);

  // ── Determina automaticamente quais blocos estão feitos ─────────────────
  // Um bloco está feito se existe sessão de hoje para aquela matéria
  const studiedTodayIds = new Set(todaySessions.map(s => s.subjectId));

  const isBlockDone = (block: Block): boolean => {
    if (!block.subjectId) return false;
    return studiedTodayIds.has(block.subjectId);
  };

  // Conta sessões por matéria hoje para marcar blocos na ordem
  // Ex: Auditoria tem 2 blocos → precisa de 2 sessões para marcar os 2
  const sessionCountBySubject: Record<string, number> = {};
  for (const s of todaySessions) {
    sessionCountBySubject[s.subjectId] = (sessionCountBySubject[s.subjectId] ?? 0) + 1;
  }
  // usedCount controla quantos blocos de cada matéria já foram "consumidos" pelas sessões
  const usedCount: Record<string, number> = {};
  const doneCount  = allToday.filter(b => {
    if (!b.subjectId) return manualDone.has(b.id);
    const available = sessionCountBySubject[b.subjectId] ?? 0;
    const used      = usedCount[b.subjectId] ?? 0;
    if (used < available) { usedCount[b.subjectId] = used + 1; return true; }
    return manualDone.has(b.id);
  }).length;
  const totalCount = allToday.length;

  // Toggle manual ainda disponível para casos edge
  const [manualDone, setManualDone] = useState<Set<string>>(new Set());
  const toggleManual = (id: string) => {
    setManualDone(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  // isEffectivelyDone: considera ordem dos blocos — 1ª sessão marca 1º bloco, 2ª sessão marca 2º bloco
  const computeBlockDoneMap = (): Set<string> => {
    const done = new Set<string>();
    const used: Record<string, number> = {};
    for (const b of allToday) {
      if (!b.subjectId) {
        if (manualDone.has(b.id)) done.add(b.id);
        continue;
      }
      const available = sessionCountBySubject[b.subjectId] ?? 0;
      const u = used[b.subjectId] ?? 0;
      if (u < available) { done.add(b.id); used[b.subjectId] = u + 1; }
      else if (manualDone.has(b.id)) done.add(b.id);
    }
    return done;
  };
  const blockDoneSet = computeBlockDoneMap();
  const isEffectivelyDone = (block: Block) => blockDoneSet.has(block.id);

  const concludeDay = () => {
    setCompleting(true);
    const undone  = allToday.filter(b => !isEffectivelyDone(b));
    const nextIdx = (currentDayIdx + 1) % cycleDays.length;
    localStorage.setItem(CYCLE_KEY,   String(nextIdx));
    localStorage.setItem(PENDING_KEY, JSON.stringify(undone));
    setCurrentDayIdx(nextIdx);
    setPendingBlocks(undone);
    setManualDone(new Set());
    setCompleting(false);
  };

  // ── Status de cada dia do ciclo ──────────────────────────────────────────
  type DayStatus = "current" | "done" | "partial" | "future";
  const getDayStatus = (dayOfWeek: number, idx: number): DayStatus => {
    if (idx === currentDayIdx) return "current";
    const dayBlocks  = blocks.filter(b => b.dayOfWeek === dayOfWeek);
    const studied    = historyByDay[dayOfWeek] ?? new Set();
    const subjectIds = dayBlocks.map(b => b.subjectId).filter(Boolean) as string[];
    if (subjectIds.length === 0) return "future";
    const studiedCount = subjectIds.filter(id => studied.has(id)).length;
    if (studiedCount === subjectIds.length) return "done";
    if (studiedCount > 0) return "partial";
    return "future";
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
        className="px-5 py-2.5 text-white rounded-xl text-sm font-semibold"
        style={{ backgroundColor: BG_HEADER }}>
        Configurar calendário
      </Link>
    </div>
  );

  const effectiveDoneCount = allToday.filter(b => isEffectivelyDone(b)).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
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
          <span className="text-sm opacity-60">{effectiveDoneCount}/{totalCount} blocos concluídos</span>
          {/* Navegação manual ← → */}
          <button onClick={() => {
            const prev = (currentDayIdx - 1 + cycleDays.length) % cycleDays.length;
            setCurrentDayIdx(prev);
            localStorage.setItem(CYCLE_KEY, String(prev));
            setManualDone(new Set());
          }} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white font-bold transition-colors">‹</button>
          <button onClick={() => {
            const next = (currentDayIdx + 1) % cycleDays.length;
            setCurrentDayIdx(next);
            localStorage.setItem(CYCLE_KEY, String(next));
            setManualDone(new Set());
          }} className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white font-bold transition-colors">›</button>
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
            <span className="text-gray-500">{effectiveDoneCount} de {totalCount} blocos</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all"
              style={{ width: totalCount > 0 ? `${(effectiveDoneCount / totalCount) * 100}%` : "0%", backgroundColor: "#22C55E" }} />
          </div>
          {todaySessions.length > 0 && (
            <p className="text-xs text-green-600 mt-2">
              ✓ {studiedTodayIds.size} matéria(s) estudada(s) hoje detectadas automaticamente
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
                const done = isEffectivelyDone(block);
                const name = block.subjectName ?? subjects.find(s => s.id === block.subjectId)?.name ?? "Sem matéria";
                return (
                  <div key={block.id}
                    className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${done ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Pendente</span>
                        <span className="text-xs text-gray-500">{fmt(block.hours)}</span>
                        <span className="text-xs text-gray-400">{BLOCK_TYPE_LABEL[block.blockType] ?? block.blockType}</span>
                        {isBlockDone(block) && <span className="text-xs text-green-600 font-medium">✓ estudado hoje</span>}
                      </div>
                      <p className="font-semibold text-gray-900">{name}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {block.subjectId && !done && (
                        <Link href={`/sessao?subjectId=${block.subjectId}`}
                          className="text-xs text-white px-3 py-1.5 rounded-lg font-medium flex items-center gap-1"
                          style={{ backgroundColor: BG_HEADER }}>
                          Estudar <ArrowRight className="w-3 h-3" />
                        </Link>
                      )}
                      <button onClick={() => toggleManual(block.id)}
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
              const done = isEffectivelyDone(block);
              const autoDetected = isBlockDone(block);
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
                      {autoDetected && (
                        <span className="text-xs text-green-600 font-medium">✓ registrado hoje</span>
                      )}
                    </div>
                    <p className={`font-semibold ${done ? "line-through text-gray-400" : "text-gray-900"}`}>{name}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {block.subjectId && !done && (
                      <Link href={`/sessao?subjectId=${block.subjectId}`}
                        className="text-xs text-white px-3 py-1.5 rounded-lg font-medium flex items-center gap-1"
                        style={{ backgroundColor: BG_HEADER }}>
                        Começar <ArrowRight className="w-3 h-3" />
                      </Link>
                    )}
                    {/* Bolinha manual — ainda disponível para override */}
                    {!autoDetected && (
                      <button onClick={() => toggleManual(block.id)}
                        className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors ${manualDone.has(block.id) ? "bg-green-500 border-green-500 text-white" : "border-gray-300 hover:border-green-400"}`}>
                        {manualDone.has(block.id) && <CheckCircle className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Ciclo completo — clicável com status por cor */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <p className="text-sm font-semibold text-gray-700 mb-3">Ciclo completo</p>
          <div className="flex flex-wrap gap-2">
            {cycleDays.map((day, idx) => {
              const dayHours = blocks.filter(b => b.dayOfWeek === day).reduce((a, b) => a + b.hours, 0);
              const status   = getDayStatus(day, idx);
              const isSelected = selectedDayIdx === idx;

              const styles: Record<string, { border: string; bg: string; color: string; label?: string }> = {
                current:  { border: BG_HEADER, bg: BG_HEADER, color: "#fff" },
                done:     { border: "#22c55e", bg: "#f0fdf4", color: "#16a34a", label: "✓" },
                partial:  { border: "#f59e0b", bg: "#fffbeb", color: "#d97706", label: "~" },
                future:   { border: "#E5E7EB", bg: "#F9FAFB", color: "#6B7280" },
              };
              const st = styles[status];

              return (
                <button key={day} onClick={() => setSelectedDayIdx(isSelected ? null : idx)}
                  className="flex flex-col items-center px-4 py-2 rounded-xl border-2 text-sm transition-all hover:scale-105"
                  style={{ borderColor: st.border, backgroundColor: st.bg, color: st.color }}>
                  <span className="font-bold">Dia {idx + 1} {st.label ?? ""}</span>
                  <span className="text-xs mt-0.5 opacity-70">{fmt(dayHours)}</span>
                </button>
              );
            })}
          </div>

          {/* Legenda */}
          <div className="flex items-center gap-3 mt-3 flex-wrap text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-500 inline-block" /> Concluído</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-yellow-400 inline-block" /> Parcial</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: BG_HEADER }} /> Hoje</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-gray-200 inline-block" /> Futuro</span>
          </div>

          {/* Detalhe do dia selecionado */}
          {selectedDayIdx !== null && (() => {
            const selDay    = cycleDays[selectedDayIdx];
            const selBlocks = blocks.filter(b => b.dayOfWeek === selDay);
            const selStudied = historyByDay[selDay] ?? new Set();
            // Sessões do dia selecionado (se for hoje, usa todaySessions)
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
                    const studied = b.subjectId ? (isToday ? studiedTodayIds.has(b.subjectId) : selStudied.has(b.subjectId)) : false;
                    // Sessões desta matéria hoje (se for hoje)
                    const matSessions = isToday
                      ? todaySessions.filter(s => s.subjectId === b.subjectId)
                      : [];
                    return (
                      <div key={b.id} className={`rounded-xl border px-4 py-3 ${studied ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"}`}>
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{name}</p>
                            <p className="text-xs text-gray-500">{fmt(b.hours)} · {BLOCK_TYPE_LABEL[b.blockType] ?? b.blockType}</p>
                          </div>
                          {studied
                            ? <span className="text-xs text-green-600 font-bold">✓ Feito</span>
                            : <span className="text-xs text-gray-400">Pendente</span>}
                        </div>
                        {/* Métricas reduzidas se for hoje e tiver sessões */}
                        {matSessions.length > 0 && (
                          <div className="flex gap-4 mt-2 text-xs text-gray-600">
                            <span>⏱ {matSessions.reduce((a,s) => a+s.hours,0).toFixed(1)}h</span>
                            {matSessions.some(s => s.questions > 0) && (<>
                              <span className="text-green-600">✓ {matSessions.reduce((a,s) => a+s.correct,0)}</span>
                              <span className="text-red-500">✗ {matSessions.reduce((a,s) => a+s.wrong,0)}</span>
                            </>)}
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
