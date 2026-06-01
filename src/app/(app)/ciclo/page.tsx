"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Zap, CheckCircle, Clock, ChevronLeft, ChevronRight, Pencil, X } from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Block {
  id: string; dayOfWeek: number; hours: number;
  blockType: string; subjectId: string | null; subjectName: string | null;
}
interface HistSession {
  subjectId: string; hours: number; questions: number;
  correct: number; wrong: number; createdAt: string;
}
interface DayState {
  // blockId → true se marcado como feito manualmente
  manualDone: Record<string, boolean>;
}

// ─── Constantes ───────────────────────────────────────────────────────────────
const BG = "#1B4040";
const BLOCK_LABEL: Record<string, string> = {
  leitura: "Leitura PDF", exercicios: "Exercícios",
  revisao7d: "Revisão 7d", revisao14_30d: "Revisão 14/30d",
};
const DAY_NAMES = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toBRDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(date);
}

function toBRDayOfWeek(date: Date): number {
  // 0=Dom,1=Seg,...,6=Sáb em JS — retorna 0-6 conforme getDay()
  return parseInt(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short" })
      .format(date).substring(0, 3) === "Sun" ? "0" :
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short" })
      .format(date).substring(0, 3) === "Mon" ? "1" :
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short" })
      .format(date).substring(0, 3) === "Tue" ? "2" :
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short" })
      .format(date).substring(0, 3) === "Wed" ? "3" :
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short" })
      .format(date).substring(0, 3) === "Thu" ? "4" :
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short" })
      .format(date).substring(0, 3) === "Fri" ? "5" : "6"
  );
}

// Retorna a segunda-feira da semana de uma data YYYY-MM-DD (BRT)
function getMondayOfWeek(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  const dow = d.getUTCDay(); // 0=Dom
  const daysFromMon = (dow + 6) % 7;
  d.setUTCDate(d.getUTCDate() - daysFromMon);
  return d.toISOString().slice(0, 10);
}

// Dado idx do ciclo (0-6), retorna YYYY-MM-DD dessa semana
// Dia 1 (idx 0) = segunda, Dia 2 (idx 1) = terça, ..., Dia 7 (idx 6) = domingo
function idxToDateOfWeek(idx: number, weekMonday: string): string {
  const d = new Date(weekMonday + "T12:00:00Z");
  if (idx === 6) {
    // Dia 7 = domingo = segunda + 6
    d.setUTCDate(d.getUTCDate() + 6);
  } else {
    d.setUTCDate(d.getUTCDate() + idx);
  }
  return d.toISOString().slice(0, 10);
}

// Dia da semana do ciclo → idx (0-6): seg=0, ter=1, qua=2, qui=3, sex=4, sab=5, dom=6
function jsDoWtoCycleIdx(jsDoW: number): number {
  // jsDoW: 0=Dom,1=Seg,...,6=Sáb
  if (jsDoW === 0) return 6; // domingo = Dia 7 = idx 6
  return jsDoW - 1; // seg=0, ter=1, ...
}

function fmt(h: number): string {
  const m = Math.round(h * 60);
  if (m < 60) return `${m}min`;
  const hh = Math.floor(m / 60); const mm = m % 60;
  return mm > 0 ? `${hh}h${mm}min` : `${hh}h`;
}

function fmtShort(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}

function fmtWeek(monday: string): string {
  const sun = new Date(monday + "T12:00:00Z");
  sun.setUTCDate(sun.getUTCDate() + 6);
  return `${fmtShort(monday)} – ${fmtShort(sun.toISOString().slice(0,10))}`;
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function CicloPage() {
  const [blocks,        setBlocks]        = useState<Block[]>([]);
  const [loading,       setLoading]       = useState(true);
  // data → sessões
  const [dateToSessions, setDateToSessions] = useState<Record<string, HistSession[]>>({});
  // data → { blockId → manualDone }
  const [dateToDayState, setDateToDayState] = useState<Record<string, DayState>>({});
  // Semana sendo visualizada (segunda-feira)
  const [viewWeek, setViewWeek]   = useState("");
  // Dia selecionado para detalhe (YYYY-MM-DD)
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  // Edição retroativa
  const [editingDate, setEditingDate] = useState<string | null>(null);
  // Celebração
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationPhrase, setCelebrationPhrase] = useState("");

  const FRASES = [
    "Nossa maior fraqueza é desistir. O caminho mais certo para o sucesso é sempre tentar apenas uma vez mais.",
    "O tempo de estudo nunca é um tempo perdido.",
    "Esse esforço todo vai sim valer a pena.",
    "Sucesso é o acúmulo de pequenos esforços, repetidos dia e noite.",
    "Só o Papiro Liberta!",
    "Comece de onde você está. Use o que você tiver. Faça o que você puder.",
    "Para grandes resultados não existem atalhos.",
    "Busque sempre o progresso, não a perfeição.",
    "Motivação é aquilo que te faz começar. Hábito é o que te faz continuar.",
    "O futuro pertence àqueles que acreditam na beleza dos seus sonhos.",
    "Você é mais corajoso do que acredita, mais forte do que parece e mais inteligente do que pensa.",
  ];

  // ── Carrega dados ────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const [blRes, histRes, stateRes] = await Promise.all([
        fetch("/api/study-blocks").then(r => r.json()).catch(() => []),
        fetch("/api/historico").then(r => r.json()).catch(() => []),
        fetch("/api/cycle-state").then(r => r.json()).catch(() => ({})),
      ]);

      const mapped: Block[] = Array.isArray(blRes) ? blRes.map((b: any) => ({
        id: b.id, dayOfWeek: b.dayOfWeek, hours: b.hours,
        blockType: b.blockType, subjectId: b.subjectId ?? null,
        subjectName: b.subject?.name ?? null,
      })) : [];
      setBlocks(mapped);

      const dtSess: Record<string, HistSession[]> = {};
      if (Array.isArray(histRes)) {
        histRes.forEach((g: any) => {
          dtSess[g.date] = (g.sessions ?? []).map((s: any) => ({
            subjectId: s.subjectId, hours: s.hours ?? 0,
            questions: s.questions ?? 0, correct: s.correct ?? 0,
            wrong: s.wrong ?? 0, createdAt: s.createdAt ?? "",
          }));
        });
      }
      setDateToSessions(dtSess);

      const savedDayStates: Record<string, DayState> = stateRes?.dayStates ?? {};
      setDateToDayState(savedDayStates);

      const today = toBRDate(new Date());
      setViewWeek(getMondayOfWeek(today));
    } catch (e) {
      console.error("Erro ao carregar ciclo:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Recarrega quando o usuário volta para a aba (ex: deletou sessão no histórico)
  useEffect(() => {
    const onFocus = () => load();
    const onVisible = () => { if (document.visibilityState === "visible") load(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  // Verifica virada de meia-noite
  useEffect(() => {
    const iv = setInterval(() => {
      const today = toBRDate(new Date());
      if (getMondayOfWeek(today) !== viewWeek && viewWeek) {
        setViewWeek(getMondayOfWeek(today));
        setSelectedDate(null);
      }
    }, 60000);
    return () => clearInterval(iv);
  }, [viewWeek]);

  // ── Salva estado no banco ────────────────────────────────────────────────────
  const saveState = useCallback((newDayStates: Record<string, DayState>) => {
    fetch("/api/cycle-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dayStates: newDayStates }),
    }).catch(console.error);
  }, []);

  // ── Toggle marcação manual ───────────────────────────────────────────────────
  const toggleManual = useCallback((date: string, blockId: string) => {
    setDateToDayState(prev => {
      const current = prev[date]?.manualDone ?? {};
      const next = { ...prev, [date]: { manualDone: { ...current, [blockId]: !current[blockId] } } };
      saveState(next);
      return next;
    });
  }, [saveState]);

  // ── Verifica se bloco está feito ─────────────────────────────────────────────
  const isBlockDone = useCallback((date: string, block: Block): boolean => {
    // 1. Marcado manualmente
    if (dateToDayState[date]?.manualDone[block.id]) return true;
    // 2. Tem sessão registrada nessa data para essa matéria
    if (!block.subjectId) return false;
    const sess = dateToSessions[date] ?? [];
    return sess.some(s => s.subjectId === block.subjectId);
  }, [dateToDayState, dateToSessions]);

  // ── Status do dia (para coloração do quadrinho) ──────────────────────────────
  const getDayStatus = useCallback((idx: number, weekMonday: string) => {
    const today = toBRDate(new Date());
    const date  = idxToDateOfWeek(idx, weekMonday);
    const todayWeek = getMondayOfWeek(today);
    const cycleIdx  = jsDoWtoCycleIdx(new Date(today + "T12:00:00Z").getUTCDay());

    const isToday   = date === today && weekMonday === todayWeek;
    const isFuture  = date > today;
    const dayBlocks = blocks.filter(b => b.dayOfWeek === idx);

    if (!dayBlocks.length) return "empty";
    if (isFuture) return "future";
    if (isToday)  return "today";

    const doneCount = dayBlocks.filter(b => isBlockDone(date, b)).length;
    if (doneCount === 0) return "none";
    if (doneCount >= dayBlocks.length) return "done";
    return "partial";
  }, [blocks, isBlockDone]);

  // ── Verifica celebração quando sessões ou marcações mudam ───────────────────
  const [celebrationShown, setCelebrationShown] = useState(false);
  useEffect(() => {
    if (!blocks.length || loading) return;
    const today = toBRDate(new Date());
    const jsDoW = new Date(today + "T12:00:00Z").getUTCDay();
    const idx   = jsDoWtoCycleIdx(jsDoW);
    const todayBlocks = blocks.filter(b => b.dayOfWeek === idx);
    if (!todayBlocks.length) return;
    const allDone = todayBlocks.every(b => {
      if (dateToDayState[today]?.manualDone[b.id]) return true;
      if (!b.subjectId) return false;
      return (dateToSessions[today] ?? []).some(s => s.subjectId === b.subjectId);
    });
    if (allDone && !celebrationShown) {
      setCelebrationShown(true);
      setCelebrationPhrase(FRASES[Math.floor(Math.random() * FRASES.length)]);
      setShowCelebration(true);
    }
    if (!allDone) setCelebrationShown(false);
  }, [dateToDayState, dateToSessions, blocks, loading]);

  // ── Dados do dia atual ───────────────────────────────────────────────────────
  const today      = toBRDate(new Date());
  const todayJsDoW = new Date(today + "T12:00:00Z").getUTCDay();
  const todayIdx   = jsDoWtoCycleIdx(todayJsDoW);
  const todayBlocks = blocks.filter(b => b.dayOfWeek === todayIdx);
  const todayDone  = todayBlocks.filter(b => isBlockDone(today, b)).length;
  const todayHours = todayBlocks.reduce((a, b) => a + b.hours, 0);

  // ── Semanas disponíveis ──────────────────────────────────────────────────────
  const availableWeeks = (() => {
    const weeks = new Set<string>([getMondayOfWeek(today)]);
    Object.keys(dateToSessions).forEach(d => weeks.add(getMondayOfWeek(d)));
    return Array.from(weeks).sort().reverse();
  })();

  const isCurrentWeek = viewWeek === getMondayOfWeek(today);

  // ── Estilos dos quadrinhos ───────────────────────────────────────────────────
  const DAY_STYLE: Record<string, { border: string; bg: string; color: string; opacity?: string }> = {
    done:    { border: "#22c55e", bg: "#f0fdf4", color: "#16a34a" },
    partial: { border: "#f59e0b", bg: "#fffbeb", color: "#d97706" },
    today:   { border: BG,        bg: BG,        color: "#fff"    },
    future:  { border: "#E5E7EB", bg: "#F9FAFB", color: "#9CA3AF" },
    none:    { border: "#E5E7EB", bg: "#F9FAFB", color: "#9CA3AF" },
    empty:   { border: "#F3F4F6", bg: "#F9FAFB", color: "#D1D5DB" },
  };

  const STATUS_LABEL: Record<string, string> = {
    done: " ✓", partial: " ~", today: "", future: "", none: "", empty: "",
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

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Header ── */}
      <div className="text-white px-6 py-6" style={{ backgroundColor: BG }}>
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-5 h-5 text-yellow-300" />
              <h1 className="text-2xl font-bold">Fila do Dia</h1>
            </div>
            <p className="text-sm opacity-60">
              Dia {todayIdx + 1} do ciclo · {fmt(todayHours)} programadas · {todayDone}/{todayBlocks.length} feitos
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">

        {/* ── Progresso do dia ── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium text-gray-700">Progresso de hoje</span>
            <span className="text-gray-500">{todayDone} de {todayBlocks.length} blocos</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: todayBlocks.length > 0 ? `${(todayDone/todayBlocks.length)*100}%` : "0%", backgroundColor: "#22C55E" }} />
          </div>
        </div>

        {/* ── Blocos de hoje ── */}
        <div>
          <p className="text-sm font-semibold text-gray-500 mb-2 px-1">Dia {todayIdx + 1} do ciclo — {fmtShort(today)}</p>
          <div className="space-y-2">
            {todayBlocks.length === 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center text-gray-400 text-sm">
                Nenhum bloco configurado para hoje
              </div>
            )}
            {todayBlocks.map((block, i) => {
              const done = isBlockDone(today, block);
              const name = block.subjectName ?? "Sem matéria";
              return (
                <div key={block.id} className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all ${done ? "bg-green-50 border-green-200" : "bg-white border-gray-200"}`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${done ? "bg-green-500 text-white" : "bg-gray-100 text-gray-500"}`}>
                    {done ? <CheckCircle className="w-5 h-5" /> : i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-xs text-gray-400 flex items-center gap-1"><Clock className="w-3 h-3" />{fmt(block.hours)}</span>
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{BLOCK_LABEL[block.blockType] ?? block.blockType}</span>
                      {done && !dateToDayState[today]?.manualDone[block.id] && (
                        <span className="text-xs text-green-600 font-medium">✓ registrado</span>
                      )}
                    </div>
                    <p className={`font-semibold ${done ? "text-gray-400 line-through" : "text-gray-900"}`}>{name}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {block.subjectId && !done && (
                      <Link href={`/sessao?subjectId=${block.subjectId}`}
                        className="text-xs text-white px-3 py-1.5 rounded-lg font-medium flex items-center gap-1"
                        style={{ backgroundColor: BG }}>
                        Começar →
                      </Link>
                    )}
                    <button
                      onClick={() => toggleManual(today, block.id)}
                      className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${done && dateToDayState[today]?.manualDone[block.id] ? "bg-green-500 border-green-500 text-white" : done ? "bg-green-100 border-green-300 text-green-600" : "border-gray-300 hover:border-green-400"}`}>
                      {done && <CheckCircle className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Ciclo completo ── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <p className="text-sm font-semibold text-gray-700 mb-3">Ciclo completo</p>

          {/* Seletor de semana */}
          <div className="flex items-center gap-2 mb-4">
            <button onClick={() => {
              const idx = availableWeeks.indexOf(viewWeek);
              if (idx < availableWeeks.length - 1) setViewWeek(availableWeeks[idx + 1]);
            }} disabled={availableWeeks.indexOf(viewWeek) >= availableWeeks.length - 1}
              className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-30">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="flex-1 text-center text-sm font-medium text-gray-700">
              {fmtWeek(viewWeek)}
              {isCurrentWeek && <span className="ml-2 text-xs text-green-600 font-semibold">semana atual</span>}
            </span>
            <button onClick={() => {
              const idx = availableWeeks.indexOf(viewWeek);
              if (idx > 0) setViewWeek(availableWeeks[idx - 1]);
            }} disabled={availableWeeks.indexOf(viewWeek) <= 0}
              className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-30">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Quadrinhos */}
          <div className="flex gap-2 flex-wrap">
            {[0,1,2,3,4,5,6].map(idx => {
              const date   = idxToDateOfWeek(idx, viewWeek);
              const status = getDayStatus(idx, viewWeek);
              const st     = DAY_STYLE[status] ?? DAY_STYLE.future;
              const dayBlocks = blocks.filter(b => b.dayOfWeek === idx);
              const hours  = dayBlocks.reduce((a, b) => a + b.hours, 0);
              if (status === "empty") return (
                <div key={idx} className="flex flex-col items-center px-3 py-2 rounded-xl border-2 text-sm opacity-30"
                  style={{ borderColor: st.border, backgroundColor: st.bg, color: st.color }}>
                  <span className="font-bold">Dia {idx+1}</span>
                  <span className="text-xs opacity-60">—</span>
                </div>
              );
              return (
                <button key={idx}
                  onClick={() => setSelectedDate(selectedDate === date ? null : date)}
                  className="flex flex-col items-center px-3 py-2 rounded-xl border-2 text-sm transition-all hover:scale-105"
                  style={{ borderColor: st.border, backgroundColor: st.bg, color: st.color }}>
                  <span className="font-bold">Dia {idx+1}{STATUS_LABEL[status]}</span>
                  <span className="text-xs mt-0.5 opacity-70">{fmt(hours)}</span>
                </button>
              );
            })}
          </div>

          {/* Legenda */}
          <div className="flex items-center gap-3 mt-3 flex-wrap text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-green-500 inline-block" /> Concluído</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-yellow-400 inline-block" /> Parcial</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: BG }} /> Hoje</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-gray-200 inline-block" /> Futuro / sem blocos</span>
          </div>

          {/* Detalhe do dia selecionado */}
          {selectedDate && (() => {
            const selDateStr = selectedDate;
            const selJsDoW   = new Date(selDateStr + "T12:00:00Z").getUTCDay();
            const selIdx     = jsDoWtoCycleIdx(selJsDoW);
            const selBlocks  = blocks.filter(b => b.dayOfWeek === selIdx);
            const selSess    = dateToSessions[selDateStr] ?? [];
            const isEditing  = editingDate === selDateStr;

            return (
              <div className="mt-4 border-t border-gray-100 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-bold text-gray-900">Dia {selIdx+1} — {fmtShort(selDateStr)}</p>
                    <p className="text-xs text-gray-400">{DAY_NAMES[selJsDoW]}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingDate(isEditing ? null : selDateStr)}
                      title="Marcar manualmente"
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${isEditing ? "bg-teal-100 text-teal-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                      <Pencil className="w-3 h-3" />
                      {isEditing ? "Concluir edição" : "Editar"}
                    </button>
                    <button onClick={() => { setSelectedDate(null); setEditingDate(null); }}
                      className="text-xs text-gray-400 hover:text-gray-600 p-1">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  {selBlocks.map(b => {
                    const name    = b.subjectName ?? "—";
                    const done    = isBlockDone(selDateStr, b);
                    const manual  = !!dateToDayState[selDateStr]?.manualDone[b.id];
                    const matSess = selSess.filter(s => s.subjectId === b.subjectId);
                    return (
                      <div key={b.id} className={`rounded-xl border px-4 py-3 transition-all ${done ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"}`}>
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{name}</p>
                            <p className="text-xs text-gray-500">{fmt(b.hours)} · {BLOCK_LABEL[b.blockType] ?? b.blockType}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {done
                              ? <span className="text-xs text-green-600 font-bold">✓ Feito{manual ? " (manual)" : ""}</span>
                              : <span className="text-xs text-gray-400">Pendente</span>}
                            {isEditing && (
                              <button
                                onClick={() => toggleManual(selDateStr, b.id)}
                                className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${manual ? "bg-green-500 border-green-500 text-white" : "border-gray-300 hover:border-green-400"}`}>
                                {manual && <CheckCircle className="w-4 h-4" />}
                              </button>
                            )}
                          </div>
                        </div>
                        {matSess.length > 0 && (
                          <div className="flex gap-4 mt-2 text-xs text-gray-500">
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

      {/* ── Popup celebração ── */}
      {showCelebration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Parabéns!</h2>
            <p className="text-gray-500 mb-3">Você concluiu todas as matérias previstas para hoje!</p>
            <p className="text-sm text-gray-400 italic mb-6">"{celebrationPhrase}"</p>
            <button onClick={() => setShowCelebration(false)}
              className="w-full py-3 text-white font-bold rounded-2xl text-base"
              style={{ backgroundColor: BG }}>
              Continuar estudando 💪
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
