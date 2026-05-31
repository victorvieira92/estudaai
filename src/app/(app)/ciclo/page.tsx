"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Zap, CheckCircle, AlertTriangle, ArrowRight, Clock, ChevronLeft, ChevronRight } from "lucide-react";

interface Block {
  id: string; dayOfWeek: number; hours: number;
  blockType: string; subjectId: string | null; subjectName: string | null;
}
interface Subject { id: string; name: string; }
interface HistSession {
  subjectId: string; subjectName: string;
  hours: number; questions: number; correct: number; wrong: number;
  createdAt?: string;
}

const BG = "#1B4040";
const BLOCK_LABEL: Record<string, string> = {
  leitura: "Leitura PDF", exercicios: "Exercícios",
  revisao7d: "Revisão 7d", revisao14_30d: "Revisão 14/30d",
};

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

// Retorna a segunda-feira da semana de uma data YYYY-MM-DD
function getMondayOfWeek(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const dow = d.getDay(); // 0=dom, 1=seg, ..., 6=sab
  const daysFromMon = (dow + 6) % 7;
  d.setDate(d.getDate() - daysFromMon);
  return d.toISOString().slice(0, 10);
}

// Formata YYYY-MM-DD como "25/05" etc
function fmtShortDate(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}

// Formata semana como "25/05 – 31/05"
function fmtWeekLabel(mondayStr: string): string {
  const monday = new Date(mondayStr + "T12:00:00");
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return `${fmtShortDate(mondayStr)} – ${fmtShortDate(sunday.toISOString().slice(0, 10))}`;
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
  const [blocks,        setBlocks]        = useState<Block[]>([]);
  const [subjects,      setSubjects]      = useState<Subject[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [currentDayIdx, setCurrentDayIdx] = useState(0);
  const [pendingBlocks, setPendingBlocks] = useState<Block[]>([]);
  const [completing,    setCompleting]    = useState(false);
  const [todaySessions, setTodaySessions] = useState<HistSession[]>([]);
  const [manualDone,    setManualDone]    = useState<Record<string, boolean>>({});
  const [selectedDayIdx, setSelectedDayIdx] = useState<number | null>(null);

  // dateToSessions: histórico completo (todas as semanas)
  const [dateToSessions, setDateToSessions] = useState<Record<string, HistSession[]>>({});

  // Semana selecionada no seletor (segunda-feira da semana, YYYY-MM-DD)
  const [viewWeekMonday, setViewWeekMonday] = useState<string>("");
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationDay, setCelebrationDay] = useState(0);
  const [cycleAdvancedAt, setCycleAdvancedAt] = useState<string>(""); // ISO timestamp do último avanço manual

  // Salva estado do ciclo no banco
  const saveCycleState = (dayIdx: number, pending: Block[], lastDate: string, advancedAt?: string) => {
    fetch("/api/cycle-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentDayIdx: dayIdx, pendingBlocks: pending, lastDate, advancedAt: advancedAt ?? null }),
    }).catch(console.error);
  };

  useEffect(() => {
    Promise.all([
      fetch("/api/study-blocks").then(r => r.json()).catch(() => []),
      fetch("/api/subjects").then(r => r.json()).catch(() => []),
      fetch("/api/historico").then(r => r.json()).catch(() => []),
      fetch("/api/cycle-state").then(r => r.json()).catch(() => ({ currentDayIdx: 0, pendingBlocks: [], lastDate: "" })),
    ]).then(([bl, su, hist, cycleState]) => {
      const mapped: Block[] = Array.isArray(bl) ? bl.map((b: any) => ({
        id: b.id, dayOfWeek: b.dayOfWeek, hours: b.hours,
        blockType: b.blockType, subjectId: b.subjectId ?? null,
        subjectName: b.subject?.name ?? null,
      })) : [];

      const subs: Subject[] = Array.isArray(su) ? su : (su?.subjects ?? []);
      setBlocks(mapped);
      setSubjects(subs);

      const days     = getCycleDays(mapped);
      const todayDS  = toBRDate(new Date());
      const lastDate = cycleState?.lastDate ?? "";
      const savedIdx = cycleState?.currentDayIdx ?? 0;
      // Garante que o índice salvo no banco nunca ultrapassa o total de dias do ciclo
      const clampedIdx = Math.min(savedIdx, Math.max(0, days.length - 1));
      const rawPendingFromDB: Block[] = cycleState?.pendingBlocks ?? [];

      // Monta contagem de sessões por matéria no histórico COMPLETO (todas as datas)
      // Usada para limpar pendências que foram resolvidas com lançamento retroativo
      const allSessionCountBySubject: Record<string, number> = {};
      if (Array.isArray(hist)) {
        (hist as any[]).forEach((dayGroup: any) => {
          (dayGroup.sessions ?? []).forEach((s: any) => {
            if (s.subjectId) {
              allSessionCountBySubject[s.subjectId] = (allSessionCountBySubject[s.subjectId] ?? 0) + 1;
            }
          });
        });
      }

      // Remove pendentes que já têm sessão registrada em qualquer data
      const usedForPending: Record<string, number> = {};
      // Lê o timestamp do último avanço manual (gravado no banco via campo advancedAt)
      const advancedAtFromDB: string = cycleState?.advancedAt ?? "";
      if (advancedAtFromDB) setCycleAdvancedAt(advancedAtFromDB);

      const savedPendingFromDB: Block[] = rawPendingFromDB.filter(b => {
        if (!b.subjectId) return true; // sem matéria: mantém
        const available = allSessionCountBySubject[b.subjectId] ?? 0;
        const used = usedForPending[b.subjectId] ?? 0;
        if (used < available) {
          usedForPending[b.subjectId] = used + 1;
          return false; // já tem sessão → remove da pendência
        }
        return true; // sem sessão suficiente → mantém como pendente
      });

      // Se a limpeza removeu algum bloco, persiste no banco — preservando o advancedAt
      if (savedPendingFromDB.length !== rawPendingFromDB.length) {
        const currentIdx = Math.min(cycleState?.currentDayIdx ?? 0, Math.max(0, getCycleDays(mapped).length - 1));
        // Só salva se advancedAt já está no banco (para não sobrescrever fix manual)
        // ou se não existe advancedAt (nunca houve avanço)
        saveCycleState(currentIdx, savedPendingFromDB, cycleState?.lastDate ?? toBRDate(new Date()), advancedAtFromDB || undefined);
      }

      // Monta mapa de data → sessões com HISTÓRICO COMPLETO (sem filtro de semana)
      const dtSess: Record<string, HistSession[]> = {};
      if (Array.isArray(hist)) {
        (hist as any[]).forEach((dayGroup: any) => {
          dtSess[dayGroup.date] = (dayGroup.sessions ?? []).map((s: any) => ({
            subjectId:   s.subjectId,
            subjectName: s.subjectName ?? "",
            hours:       s.hours ?? 0,
            questions:   s.questions ?? 0,
            correct:     s.correct ?? 0,
            wrong:       s.wrong ?? 0,
            createdAt:   s.createdAt ?? null,
          }));
        });
      }
      setDateToSessions(dtSess);

      // Sessões de hoje — filtra as que foram criadas ANTES do último avanço manual de ciclo
      // Isso evita que sessões do Ciclo N apareçam como "registrado hoje" no Ciclo N+1
      const rawTodaySess = dtSess[todayDS] ?? [];
      const advancedAtTS = advancedAtFromDB ? new Date(advancedAtFromDB).getTime() : 0;
      const todaySess = advancedAtTS > 0
        ? rawTodaySess.filter(s => s.createdAt ? new Date(s.createdAt).getTime() >= advancedAtTS : true)
        : rawTodaySess;
      setTodaySessions(todaySess);

      // Define semana visualizada como a semana atual
      const currentWeekMonday = getMondayOfWeek(todayDS);
      setViewWeekMonday(currentWeekMonday);

      // ── Virada de dia ───────────────────────────────────────────────────
      // Se lastDate existe e é diferente de hoje, o dia virou.
      // Calculamos pendências do dia anterior e avançamos o índice.
      if (lastDate && lastDate !== todayDS) {
        const prevDay    = days[clampedIdx] ?? -1;
        const prevBlocks = mapped.filter(b => b.dayOfWeek === prevDay);
        const lastDateSess = dtSess[lastDate] ?? [];

        const sessionCountPrev: Record<string, number> = {};
        lastDateSess.forEach(s => {
          sessionCountPrev[s.subjectId] = (sessionCountPrev[s.subjectId] ?? 0) + 1;
        });

        const usedPrev: Record<string, number> = {};
        const newPending: Block[] = [];
        prevBlocks.forEach(b => {
          if (!b.subjectId) return;
          const avail = sessionCountPrev[b.subjectId] ?? 0;
          const u     = usedPrev[b.subjectId] ?? 0;
          if (u < avail) { usedPrev[b.subjectId] = u + 1; }
          else { newPending.push(b); }
        });

        const nextIdx    = (clampedIdx + 1) % days.length;
        const allPending = [...savedPendingFromDB, ...newPending];
        // Salva UMA VEZ com o índice novo
        saveCycleState(nextIdx, allPending, todayDS); // advancedAt resetado — nova virada de dia
        setCurrentDayIdx(nextIdx);
        setPendingBlocks(allPending);
      } else {
        // Mesmo dispositivo, mesmo dia: apenas usa o que veio do banco, sem salvar
        setCurrentDayIdx(clampedIdx);
        setPendingBlocks(savedPendingFromDB);
        // Só salva se for o primeiro acesso (sem lastDate) — preserva advancedAt existente
        if (!lastDate) {
          saveCycleState(clampedIdx, savedPendingFromDB, todayDS, advancedAtFromDB || undefined);
        }
        // Se lastDate já existe e é hoje: NÃO salva — evita sobrescrever advancedAt do banco
      }
    }).finally(() => setLoading(false));
  }, []);

  // Verifica virada de meia-noite
  useEffect(() => {
    const iv = setInterval(async () => {
      const today = toBRDate(new Date());
      const res   = await fetch("/api/cycle-state").catch(() => null);
      if (!res?.ok) return;
      const state = await res.json();
      if (state.lastDate && state.lastDate !== today) window.location.reload();
    }, 60000);
    return () => clearInterval(iv);
  }, []);

  // ── Listas de semanas disponíveis para o seletor ──────────────────────
  // Pega todas as semanas que têm pelo menos 1 sessão, + a semana atual
  const availableWeeks: string[] = (() => {
    const todayDS = toBRDate(new Date());
    const currentMonday = getMondayOfWeek(todayDS);
    const weekSet = new Set<string>([currentMonday]);
    Object.keys(dateToSessions).forEach(d => weekSet.add(getMondayOfWeek(d)));
    return Array.from(weekSet).sort().reverse(); // mais recente primeiro
  })();

  // ── sessionsByIdx: sessões de cada dia do ciclo NA SEMANA VISUALIZADA ──
  // Regra: Dia N do ciclo na semana X = sessões do dia em que o ciclo estava
  // no índice N, dentro dessa semana.
  //
  // Como o ciclo avança 1 dia por dia útil, e sabemos que:
  //   - currentDayIdx é o dia atual
  //   - hoje é toBRDate(new Date())
  //
  // Para a semana visualizada, cada dia da semana (seg, ter, ...) pode ter
  // sessões. Associamos cada data da semana ao índice do ciclo correspondente.
  //
  // A âncora é: hoje = currentDayIdx. Cada dia anterior = currentDayIdx - N.
  // Para dias futuros desta semana: currentDayIdx + N.

  const cycleDays   = getCycleDays(blocks);
  const currentDay  = cycleDays[currentDayIdx] ?? -1;
  const todayBlocks = blocks.filter(b => b.dayOfWeek === currentDay);
  const allToday    = [...pendingBlocks, ...todayBlocks];
  const totalHours  = allToday.reduce((a, b) => a + b.hours, 0);

  const sessionCountToday: Record<string, number> = {};
  todaySessions.forEach(s => {
    sessionCountToday[s.subjectId] = (sessionCountToday[s.subjectId] ?? 0) + 1;
  });

  // Mapa: dayIdx → data real (baseado em hoje como âncora)
  const idxToDate = (() => {
    const todayDS = toBRDate(new Date());
    const result: Record<number, string> = {};
    if (!cycleDays.length) return result;

    // Dia atual = hoje
    result[currentDayIdx] = todayDS;

    // Para os dias anteriores, usa as datas do histórico real em ordem reversa
    // Pega todas as datas com sessões, ordena desc, e associa aos índices anteriores
    const datesWithSessions = Object.keys(dateToSessions)
      .filter(d => d < todayDS && (dateToSessions[d]?.length ?? 0) > 0)
      .sort()
      .reverse();

    for (let step = 1; step < cycleDays.length; step++) {
      const prevIdx = (currentDayIdx - step + cycleDays.length) % cycleDays.length;
      // Usa a data real do histórico se existir, senão subtrai linearmente
      result[prevIdx] = datesWithSessions[step - 1] ?? (() => {
        const d = new Date(todayDS + "T12:00:00");
        d.setDate(d.getDate() - step);
        return d.toISOString().slice(0, 10);
      })();
    }
    return result;
  })();

  // Sessões por índice (para o painel de detalhes ao clicar no dia)
  const sessionsByIdx: Record<number, HistSession[]> = {};
  cycleDays.forEach((_, idx) => {
    const date = idxToDate[idx];
    sessionsByIdx[idx] = date ? (dateToSessions[date] ?? []) : [];
  });

  // ── getDayStatus: coloração baseada na SEMANA VISUALIZADA ──────────────
  // Para cada dia do ciclo, verifica se a data correspondente está dentro
  // da semana visualizada e se tem sessões.
  const getDayStatus = (idx: number): "current" | "done" | "partial" | "future" | "other-week" => {
    if (idx === currentDayIdx) return "current";

    const date = idxToDate[idx];
    if (!date) return "future";

    // Se a data desse índice não pertence à semana visualizada, mostra cinza
    const weekOfDate = getMondayOfWeek(date);
    if (weekOfDate !== viewWeekMonday) return "other-week";

    const dayBlocks = blocks.filter(b => b.dayOfWeek === cycleDays[idx]);
    if (!dayBlocks.length) return "future";

    const sess = dateToSessions[date] ?? [];
    if (!sess.length) return "future";

    const done = countDoneBlocks(sess, dayBlocks);
    if (done >= dayBlocks.length) return "done";
    if (done > 0) return "partial";
    return "future";
  };

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
    const undone    = allToday.filter(b => !isDone(b));
    const nextIdx   = (currentDayIdx + 1) % cycleDays.length;
    const todayDS   = toBRDate(new Date());
    const advancedAt = new Date().toISOString(); // timestamp exato do avanço
    saveCycleState(nextIdx, undone, todayDS, advancedAt);
    setCycleAdvancedAt(advancedAt);
    // Detecta volta ao início do ciclo (ciclo completo)
    const completedCycle = nextIdx === 0 || nextIdx < currentDayIdx;
    if (completedCycle) {
      setCelebrationDay(currentDayIdx + 1);
      setShowCelebration(true);
    }
    setCurrentDayIdx(nextIdx);
    setPendingBlocks(undone);
    setManualDone({});
    setCompleting(false);
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
    current:    { borderColor: BG,        backgroundColor: BG,        color: "#fff"    },
    done:       { borderColor: "#22c55e", backgroundColor: "#f0fdf4", color: "#16a34a" },
    partial:    { borderColor: "#f59e0b", backgroundColor: "#fffbeb", color: "#d97706" },
    future:     { borderColor: "#E5E7EB", backgroundColor: "#F9FAFB", color: "#6B7280" },
    "other-week": { borderColor: "#E5E7EB", backgroundColor: "#F9FAFB", color: "#D1D5DB" },
  };

  const isCurrentWeek = viewWeekMonday === getMondayOfWeek(toBRDate(new Date()));

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
          <button onClick={() => { const p=(currentDayIdx-1+cycleDays.length)%cycleDays.length; setCurrentDayIdx(p); saveCycleState(p, pendingBlocks, toBRDate(new Date())); setManualDone({}); }}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center font-bold">‹</button>
          <button onClick={() => { const n=(currentDayIdx+1)%cycleDays.length; setCurrentDayIdx(n); saveCycleState(n, pendingBlocks, toBRDate(new Date())); setManualDone({}); }}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center font-bold">›</button>
          <button onClick={concludeDay} disabled={completing}
            className="flex items-center gap-2 px-5 py-2.5 bg-green-500 hover:bg-green-400 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-colors">
            <CheckCircle className="w-4 h-4" />
            {completing ? "Avançando..." : "Concluir dia"}
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-4">

        {/* Progresso do dia */}
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

        {/* Pendentes */}
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

        {/* Blocos do dia */}
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

        {/* Ciclo completo */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <p className="text-sm font-semibold text-gray-700 mb-3">Ciclo completo</p>

          {/* Seletor de semana */}
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => {
                const idx = availableWeeks.indexOf(viewWeekMonday);
                if (idx < availableWeeks.length - 1) setViewWeekMonday(availableWeeks[idx + 1]);
              }}
              disabled={availableWeeks.indexOf(viewWeekMonday) >= availableWeeks.length - 1}
              className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="flex-1 text-center text-sm font-medium text-gray-700">
              {viewWeekMonday ? fmtWeekLabel(viewWeekMonday) : ""}
              {isCurrentWeek && <span className="ml-2 text-xs text-green-600 font-semibold">semana atual</span>}
            </span>
            <button
              onClick={() => {
                const idx = availableWeeks.indexOf(viewWeekMonday);
                if (idx > 0) setViewWeekMonday(availableWeeks[idx - 1]);
              }}
              disabled={availableWeeks.indexOf(viewWeekMonday) <= 0}
              className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Quadrinhos dos dias */}
          <div className="flex flex-wrap gap-2">
            {cycleDays.map((day, idx) => {
              const dayHours = blocks.filter(b => b.dayOfWeek === day).reduce((a,b) => a+b.hours, 0);
              const status   = getDayStatus(idx);
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

          {/* Legenda */}
          <div className="flex items-center gap-3 mt-3 flex-wrap text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-500 inline-block" /> Concluído</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-yellow-400 inline-block" /> Parcial</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: BG }} /> Hoje</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-gray-200 inline-block" /> Futuro / outra semana</span>
          </div>

          {/* Detalhe do dia selecionado */}
          {selectedDayIdx !== null && (() => {
            const selDay    = cycleDays[selectedDayIdx];
            const selBlocks = blocks.filter(b => b.dayOfWeek === selDay);
            const selDate   = idxToDate[selectedDayIdx];
            const selSess   = selDate ? (dateToSessions[selDate] ?? []) : (sessionsByIdx[selectedDayIdx] ?? []);
            const sc2: Record<string,number> = {};
            selSess.forEach(s => { sc2[s.subjectId] = (sc2[s.subjectId]??0)+1; });
            const used3: Record<string,number> = {};
            return (
              <div className="mt-4 border-t border-gray-100 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-bold text-gray-900">Dia {selectedDayIdx+1} — Matérias</p>
                    {selDate && <p className="text-xs text-gray-400">{fmtShortDate(selDate)}</p>}
                  </div>
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
  {/* ── Popup de celebração ── */}
  {showCelebration && (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
      <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl animate-bounce-once">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Ciclo completo!</h2>
        <p className="text-gray-500 mb-1">Você concluiu todos os {celebrationDay} dias do ciclo.</p>
        <p className="text-sm text-gray-400 mb-6">O ciclo reiniciou automaticamente. Bora pro próximo!</p>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setShowCelebration(false)}
            className="w-full py-3 text-white font-bold rounded-2xl text-base transition-colors"
            style={{ backgroundColor: BG }}>
            Continuar estudando 💪
          </button>
        </div>
      </div>
    </div>
  )}
    </div>
  );
}
