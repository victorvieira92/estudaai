"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Zap, CheckCircle, AlertTriangle, ArrowRight, Clock } from "lucide-react";

interface Block {
  id: string; dayOfWeek: number; hours: number;
  blockType: string; subjectId: string | null; subjectName: string | null;
}
interface Subject { id: string; name: string; }
interface HistSession {
  subjectId: string; subjectName: string;
  hours: number; questions: number; correct: number; wrong: number;
}

const BG = "#1B4040";
const BLOCK_LABEL: Record<string, string> = {
  leitura: "Leitura PDF", exercicios: "Exercícios",
  revisao7d: "Revisão 7d", revisao14_30d: "Revisão 14/30d",
};
const CYCLE_KEY     = "estudaai_cycle_day";
const PENDING_KEY   = "estudaai_pending";
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
    return new Date(date.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }
}

// Retorna a data da segunda-feira da semana atual (semana ISO, seg=início)
function getCurrentWeekMonday(): string {
  const today = new Date();
  const todayDS = toBRDate(today);
  // Reconstrói a data em BRT para calcular o dia da semana corretamente
  const d = new Date(todayDS + "T12:00:00");
  const dow = d.getDay(); // 0=dom, 1=seg, ..., 6=sab
  const daysFromMon = (dow + 6) % 7; // 0 se seg, 6 se dom
  const monday = new Date(d);
  monday.setDate(d.getDate() - daysFromMon);
  return toBRDate(monday);
}

// Verifica se houve pelo menos 1 sessão de alguma matéria do ciclo naquela data
function dayHasCycleStudy(
  sessions: HistSession[],
  cycleBlocks: Block[]
): boolean {
  const cycleSubIds: Record<string, boolean> = {};
  cycleBlocks.forEach(b => { if (b.subjectId) cycleSubIds[b.subjectId] = true; });
  return sessions.some(s => cycleSubIds[s.subjectId]);
}

// Conta quantos blocos de um ciclo foram cobertos pelas sessões de um dia
function countDoneBlocks(sessions: HistSession[], cycleBlocks: Block[]): number {
  const sc: Record<string, number> = {};
  sessions.forEach(s => { sc[s.subjectId] = (sc[s.subjectId] ?? 0) + 1; });
  const used: Record<string, number> = {};
  let done = 0;
  cycleBlocks.forEach(b => {
    if (!b.subjectId) return;
    const avail = sc[b.subjectId] ?? 0;
    const u = used[b.subjectId] ?? 0;
    if (u < avail) { done++; used[b.subjectId] = u + 1; }
  });
  return done;
}

export default function CicloPage() {
  const [blocks,         setBlocks]         = useState<Block[]>([]);
  const [subjects,       setSubjects]        = useState<Subject[]>([]);
  const [loading,        setLoading]         = useState(true);
  const [currentDayIdx,  setCurrentDayIdx]   = useState(0);
  const [pendingBlocks,  setPendingBlocks]   = useState<Block[]>([]);
  const [completing,     setCompleting]      = useState(false);
  const [todaySessions,  setTodaySessions]   = useState<HistSession[]>([]);
  const [manualDone,     setManualDone]      = useState<Record<string, boolean>>({});
  const [selectedDayIdx, setSelectedDayIdx]  = useState<number | null>(null);
  // Para cada índice do ciclo: sessões do dia histórico correspondente
  const [sessionsByIdx,  setSessionsByIdx]   = useState<Record<number, HistSession[]>>({});

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

      // Mapa de data → sessões (do mais recente para o mais antigo)
      const dateToSessions: Record<string, HistSession[]> = {};
      if (Array.isArray(hist)) {
        (hist as any[]).forEach((dayGroup: any) => {
          dateToSessions[dayGroup.date] = (dayGroup.sessions ?? []).map((s: any) => ({
            subjectId:   s.subjectId,
            subjectName: s.subjectName ?? "",
            hours:       s.hours ?? 0,
            questions:   s.questions ?? 0,
            correct:     s.correct ?? 0,
            wrong:       s.wrong ?? 0,
          }));
        });
      }

      // Sessões de hoje
      const todaySess = dateToSessions[todayDS] ?? [];
      setTodaySessions(todaySess);

      // ── Lógica de associação ciclo → sessões ─────────────────────────────
      // Regra: o índice atual (clampedIdx) = hoje.
      // Índices anteriores = percorre o histórico em ordem reversa,
      // buscando datas onde houve estudo de matérias daquele ciclo específico.
      // Ignora datas retroativas que não fazem parte da sequência natural.
      //
      // Para cada índice anterior, procura a data mais recente do histórico
      // que tenha sessões do ciclo correspondente, pulando datas já usadas.

      // Filtra apenas datas da semana atual (seg a dom) — ignora retroativos de semanas anteriores
      const weekMonday = getCurrentWeekMonday();
      const sortedDates = Object.keys(dateToSessions)
        .filter(d => d >= weekMonday && d < todayDS) // só desta semana, antes de hoje
        .sort()
        .reverse(); // mais recente primeiro

      const sbi: Record<number, HistSession[]> = {};
      sbi[clampedIdx] = todaySess; // dia atual = hoje

      // Para os dias anteriores do ciclo, associa em ordem reversa
      // apenas datas que tiveram estudo daquele ciclo
      const usedDates: Record<string, boolean> = { [todayDS]: true };

      for (let step = 1; step < days.length; step++) {
        const prevIdx = (clampedIdx - step + days.length) % days.length;
        const prevDow = days[prevIdx];
        const prevBlocks = mapped.filter(b => b.dayOfWeek === prevDow);

        // Busca a data mais recente não usada onde houve estudo deste ciclo
        let found = false;
        for (const date of sortedDates) {
          if (usedDates[date]) continue;
          const sess = dateToSessions[date] ?? [];
          if (dayHasCycleStudy(sess, prevBlocks)) {
            sbi[prevIdx] = sess;
            usedDates[date] = true;
            found = true;
            break;
          }
        }
        if (!found) sbi[prevIdx] = []; // nenhuma data encontrada = não estudado
      }

      setSessionsByIdx(sbi);

      // Verifica se o dia virou
      if (lastDate && lastDate !== todayDS) {
        const prevDay    = days[clampedIdx] ?? -1;
        const prevBlocks = mapped.filter(b => b.dayOfWeek === prevDay);

        // Sessões de ontem (ou do último dia antes de hoje)
        const prevSess = sbi[clampedIdx] ?? []; // antes de atualizar para hoje
        const sessionCountPrev: Record<string, number> = {};
        // Usa as sessões do último dia registrado (lastDate)
        const lastDateSess = dateToSessions[lastDate] ?? [];
        lastDateSess.forEach(s => {
          sessionCountPrev[s.subjectId] = (sessionCountPrev[s.subjectId] ?? 0) + 1;
        });

        const usedPrev: Record<string, number> = {};
        const savedPending: Block[] = (() => {
          try { return JSON.parse(localStorage.getItem(PENDING_KEY) ?? "[]"); } catch { return []; }
        })();
        const newPending: Block[] = [];
        prevBlocks.forEach(b => {
          if (!b.subjectId) return;
          const avail = sessionCountPrev[b.subjectId] ?? 0;
          const u     = usedPrev[b.subjectId] ?? 0;
          if (u < avail) { usedPrev[b.subjectId] = u + 1; }
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

      localStorage.setItem(LAST_DATE_KEY, todayDS);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const iv = setInterval(() => {
      const last = localStorage.getItem(LAST_DATE_KEY);
      if (last && last !== toBRDate(new Date())) window.location.reload();
    }, 60000);
    return () => clearInterval(iv);
  }, []);

  const cycleDays   = getCycleDays(blocks);
  const currentDay  = cycleDays[currentDayIdx] ?? -1;
  const todayBlocks = blocks.filter(b => b.dayOfWeek === currentDay);
  const allToday    = [...pendingBlocks, ...todayBlocks];
  const totalHours  = allToday.reduce((a, b) => a + b.hours, 0);

  const sessionCountToday: Record<string, number> = {};
  todaySessions.forEach(s => {
    sessionCountToday[s.subjectId] = (sessionCountToday[s.subjectId] ?? 0) + 1;
  });

  const computeDoneMaps = () => {
    const done: Record<string, boolean> = {};
    const auto: Record<string, boolean> = {};
    const used: Record<string, number>  = {};
    allToday.forEach(b => {
      if (!b.subjectId) { if (manualDone[b.id]) done[b.id] = true; return; }
      const avail = sessionCountToday[b.subjectId] ?? 0;
      const u     = used[b.subjectId] ?? 0;
      if (u < avail) { done[b.id] = true; auto[b.id] = true; used[b.subjectId] = u + 1; }
      else if (manualDone[b.id]) done[b.id] = true;
    });
    return { done, auto };
  };

  const { done: blockDoneMap, auto: blockAutoMap } = computeDoneMaps();
  const isDone     = (b: Block) => !!blockDoneMap[b.id];
  const isAuto     = (b: Block) => !!blockAutoMap[b.id];
  const doneCount  = Object.keys(blockDoneMap).length;
  const totalCount = allToday.length;

  const toggleManual = (id: string) =>
    setManualDone(prev => ({ ...prev, [id]: !prev[id] }));

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

  const getDayStatus = (dayOfWeek: number, idx: number): "current"|"done"|"partial"|"future" => {
    if (idx === currentDayIdx) return "current";
    const dayBlocks = blocks.filter(b => b.dayOfWeek === dayOfWeek);
    const sess      = sessionsByIdx[idx] ?? [];
    if (!dayBlocks.length) return "future";
    if (!sess.length) return "future";
    const done = countDoneBlocks(sess, dayBlocks);
    if (done === dayBlocks.length) return "done";
    if (done > 0) return "partial";
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
      <Link href="/calendario-ciclo" className="px-5 py-2.5 text-white rounded-xl text-sm font-semibold" style={{ backgroundColor: BG }}>
        Configurar calendário
      </Link>
    </div>
  );

  const DAY_STYLE = {
    current: { borderColor: BG,        backgroundColor: BG,        color: "#fff"    },
    done:    { borderColor: "#22c55e", backgroundColor: "#f0fdf4", color: "#16a34a" },
    partial: { borderColor: "#f59e0b", backgroundColor: "#fffbeb", color: "#d97706" },
    future:  { borderColor: "#E5E7EB", backgroundColor: "#F9FAFB", color: "#6B7280" },
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="text-white px-8 py-8 flex items-center justify-between flex-wrap gap-4" style={{ backgroundColor: BG }}>
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Zap className="w-6 h-6 text-yellow-300" />
            <h1 className="text-3xl font-bold">Fila do Dia</h1>
          </div>
          <p className="text-sm opacity-60">Dia {currentDayIdx + 1} do ciclo · {fmt(totalHours)} programadas</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm opacity-60">{doneCount}/{totalCount} blocos concluídos</span>
          <button onClick={() => { const p = (currentDayIdx-1+cycleDays.length)%cycleDays.length; setCurrentDayIdx(p); localStorage.setItem(CYCLE_KEY,String(p)); setManualDone({}); }}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center font-bold">‹</button>
          <button onClick={() => { const n = (currentDayIdx+1)%cycleDays.length; setCurrentDayIdx(n); localStorage.setItem(CYCLE_KEY,String(n)); setManualDone({}); }}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center font-bold">›</button>
          <button onClick={concludeDay} disabled={completing}
            className="flex items-center gap-2 px-5 py-2.5 bg-green-500 hover:bg-green-400 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-colors">
            <CheckCircle className="w-4 h-4" />
            {completing ? "Avançando..." : "Concluir dia"}
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-4">

        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium text-gray-700">Progresso do dia</span>
            <span className="text-gray-500">{doneCount} de {totalCount} blocos</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all"
              style={{ width: totalCount > 0 ? `${(doneCount/totalCount)*100}%` : "0%", backgroundColor: "#22C55E" }} />
          </div>
        </div>

        {pendingBlocks.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2 px-1">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <p className="text-sm font-semibold text-red-600">Pendentes de dias anteriores ({pendingBlocks.length})</p>
            </div>
            <div className="space-y-2">
              {pendingBlocks.map(block => {
                const done = isDone(block); const auto = isAuto(block);
                const name = block.subjectName ?? subjects.find(s => s.id === block.subjectId)?.name ?? "Sem matéria";
                return (
                  <div key={block.id} className={`flex items-center gap-4 p-4 rounded-xl border-2 ${done ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
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
                          className="text-xs text-white px-3 py-1.5 rounded-lg font-medium flex items-center gap-1" style={{ backgroundColor: BG }}>
                          Estudar <ArrowRight className="w-3 h-3" />
                        </Link>
                      )}
                      {!auto && (
                        <button onClick={() => toggleManual(block.id)}
                          className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${manualDone[block.id] ? "bg-green-500 border-green-500 text-white" : "border-gray-300"}`}>
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

        <div>
          <p className="text-sm font-semibold text-gray-600 mb-2 px-1">Dia {currentDayIdx + 1} do ciclo</p>
          <div className="space-y-2">
            {todayBlocks.map((block, i) => {
              const done = isDone(block); const auto = isAuto(block);
              const name = block.subjectName ?? "Sem matéria";
              return (
                <div key={block.id} className={`flex items-center gap-4 p-4 rounded-xl border-2 ${done ? "bg-green-50 border-green-200" : "bg-white border-gray-200"}`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${done ? "bg-green-500 text-white" : "bg-gray-100 text-gray-600"}`}>
                    {done ? <CheckCircle className="w-5 h-5" /> : i+1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-xs text-gray-500 flex items-center gap-1"><Clock className="w-3 h-3" /> {fmt(block.hours)}</span>
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{BLOCK_LABEL[block.blockType] ?? block.blockType}</span>
                      {auto && <span className="text-xs text-green-600 font-medium">✓ registrado hoje</span>}
                    </div>
                    <p className={`font-semibold ${done ? "line-through text-gray-400" : "text-gray-900"}`}>{name}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {block.subjectId && !done && (
                      <Link href={`/sessao?subjectId=${block.subjectId}`}
                        className="text-xs text-white px-3 py-1.5 rounded-lg font-medium flex items-center gap-1" style={{ backgroundColor: BG }}>
                        Começar <ArrowRight className="w-3 h-3" />
                      </Link>
                    )}
                    {!auto && (
                      <button onClick={() => toggleManual(block.id)}
                        className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${manualDone[block.id] ? "bg-green-500 border-green-500 text-white" : "border-gray-300"}`}>
                        {manualDone[block.id] && <CheckCircle className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <p className="text-sm font-semibold text-gray-700 mb-3">Ciclo completo</p>
          <div className="flex flex-wrap gap-2">
            {cycleDays.map((day, idx) => {
              const dayHours = blocks.filter(b => b.dayOfWeek === day).reduce((a,b) => a+b.hours, 0);
              const status   = getDayStatus(day, idx);
              const st       = DAY_STYLE[status];
              const label    = status === "done" ? " ✓" : status === "partial" ? " ~" : "";
              return (
                <button key={day} onClick={() => setSelectedDayIdx(selectedDayIdx === idx ? null : idx)}
                  className="flex flex-col items-center px-4 py-2 rounded-xl border-2 text-sm transition-all hover:scale-105" style={st}>
                  <span className="font-bold">Dia {idx+1}{label}</span>
                  <span className="text-xs mt-0.5 opacity-70">{fmt(dayHours)}</span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-3 mt-3 flex-wrap text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-500 inline-block" /> Concluído</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-yellow-400 inline-block" /> Parcial</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: BG }} /> Hoje</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-gray-200 inline-block" /> Futuro</span>
          </div>

          {selectedDayIdx !== null && (() => {
            const selDay    = cycleDays[selectedDayIdx];
            const selBlocks = blocks.filter(b => b.dayOfWeek === selDay);
            const selSess   = sessionsByIdx[selectedDayIdx] ?? [];
            const sc2: Record<string,number> = {};
            selSess.forEach(s => { sc2[s.subjectId] = (sc2[s.subjectId]??0)+1; });
            const used3: Record<string,number> = {};
            return (
              <div className="mt-4 border-t border-gray-100 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-bold text-gray-900">Dia {selectedDayIdx+1} — Matérias</p>
                  <button onClick={() => setSelectedDayIdx(null)} className="text-xs text-gray-400 hover:text-gray-600">Fechar ✕</button>
                </div>
                <div className="space-y-2">
                  {selBlocks.map(b => {
                    const name = b.subjectName ?? subjects.find(s => s.id === b.subjectId)?.name ?? "—";
                    let studied = false;
                    if (b.subjectId) {
                      const avail = sc2[b.subjectId]??0; const u = used3[b.subjectId]??0;
                      if (u < avail) { studied=true; used3[b.subjectId]=u+1; }
                    }
                    const matSess = selSess.filter(s => s.subjectId === b.subjectId);
                    return (
                      <div key={b.id} className={`rounded-xl border px-4 py-3 ${studied?"bg-green-50 border-green-200":"bg-gray-50 border-gray-200"}`}>
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{name}</p>
                            <p className="text-xs text-gray-500">{fmt(b.hours)} · {BLOCK_LABEL[b.blockType]??b.blockType}</p>
                          </div>
                          {studied ? <span className="text-xs text-green-600 font-bold">✓ Feito</span>
                                   : <span className="text-xs text-gray-400">Pendente</span>}
                        </div>
                        {matSess.length > 0 && (
                          <div className="flex gap-4 mt-2 text-xs text-gray-600">
                            <span>⏱ {matSess.reduce((a,s)=>a+s.hours,0).toFixed(1)}h</span>
                            {matSess.some(s=>s.questions>0) && (
                              <><span className="text-green-600">✓ {matSess.reduce((a,s)=>a+s.correct,0)}</span>
                                <span className="text-red-500">✗ {matSess.reduce((a,s)=>a+s.wrong,0)}</span></>
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
