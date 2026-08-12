"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Clock, RefreshCw, AlertCircle,
  Target, ArrowRight, CheckCircle, Zap, History, AlertTriangle, ChevronLeft, ChevronRight,
} from "lucide-react";

const BG = "#1B4040";

interface Block {
  start: string; end: string; label: string; duration: string;
  subject: { id: string; name: string; score: number; nextPdf: { title: string } | null; pendingErrors: number; accuracy: number | null } | null;
}
interface CicloBlock { id: string; dayOfWeek: number; hours: number; blockType: string; subjectId: string | null; subjectName: string | null; }
interface SessionHistory { id: string; subjectName: string; subjectId: string; hours: number; questions: number; correct: number; wrong: number; createdAt: string; }
interface Review    { id: string; type: string; pdf: { title: string; topic: { subject: { name: string } } } }
interface ErrorNote { id: string; title: string; wrongCount: number; subject: { name: string } }
interface Data {
  todayBlocks: Block[]; todayHistory: SessionHistory[]; reviews: Review[]; criticalErrors: ErrorNote[];
  todayStats: { hours: number; questions: number };
  weekStats:  { hours: number; questions: number; targetHours: number };
  nextSubject: { id: string; name: string; score: number; nextPdf: { title: string } | null } | null;
  nextBlockType: string | null;
}

const BLOCK_TYPE_LABEL: Record<string, string> = {
  leitura: "Leitura PDF", exercicios: "Exercícios",
  revisao7d: "Revisão 7d", revisao14_30d: "Revisão 14/30d",
};

function fmtH(h: number) {
  const totalMin = Math.round(h * 60);
  if (totalMin < 60) return `${totalMin}min`;
  const hh = Math.floor(totalMin / 60); const mm = totalMin % 60;
  return mm > 0 ? `${hh}h${mm}min` : `${hh}h`;
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
function pct(v: number, t: number) { if (!t) return 0; return Math.min(100, Math.round((v / t) * 100)); }
function getCycleDays(blocks: CicloBlock[]) { return [...new Set(blocks.map(b => b.dayOfWeek))].sort((a, b) => a - b); }

// Chaves localStorage — usadas APENAS para doneIds e pendingBlocks (estado local da fila)
function getPendingKey(uid: string) { return `estudaai_pending_${uid}`; }
function getDoneKey(uid: string)    { return `estudaai_done_ids_${uid}`; }

export default function HojePage() {
  const { data: authSession } = useSession();
  const uid = authSession?.user?.id ?? "guest";

  const [data,          setData]          = useState<Data | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [cicloBlocks,   setCicloBlocks]   = useState<CicloBlock[]>([]);
  const [currentDayIdx, setCurrentDayIdx] = useState(0);
  const [pendingBlocks, setPendingBlocks] = useState<CicloBlock[]>([]);
  const [doneIds,       setDoneIds]       = useState<Set<string>>(new Set());
  const [completing,    setCompleting]    = useState(false);
  const [savingDay,     setSavingDay]     = useState(false);

  const loadAll = () => {
    setLoading(true);
    Promise.all([
      fetch("/api/cycle-state").then(r => r.json()).catch(() => ({ currentDayIdx: 0 })),
      fetch("/api/study-blocks").then(r => r.json()).catch(() => []),
      fetch("/api/schedule").then(r => r.json()).catch(() => null),
    ]).then(([cs, bl, scheduleData]) => {
      const mapped: CicloBlock[] = Array.isArray(bl) ? bl.map((b: any) => ({
        id: b.id, dayOfWeek: b.dayOfWeek, hours: b.hours,
        blockType: b.blockType, subjectId: b.subjectId ?? null, subjectName: b.subject?.name ?? null,
      })) : [];
      setCicloBlocks(mapped);

      // currentDayIdx SEMPRE vem do banco — única fonte de verdade
      const days     = getCycleDays(mapped);
      const savedIdx = typeof cs?.currentDayIdx === "number" ? cs.currentDayIdx : 0;
      setCurrentDayIdx(Math.min(savedIdx, Math.max(0, days.length - 1)));

      // pendingBlocks e doneIds ficam no localStorage (estado local da fila)
      try { setPendingBlocks(JSON.parse(localStorage.getItem(getPendingKey(uid)) ?? "[]")); } catch { setPendingBlocks([]); }
      try { setDoneIds(new Set(JSON.parse(localStorage.getItem(getDoneKey(uid)) ?? "[]"))); } catch { setDoneIds(new Set()); }

      if (scheduleData) setData(scheduleData);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { loadAll(); }, []);

  // Salva currentDayIdx no banco E recarrega schedule
  const saveDayIdx = async (nextIdx: number) => {
    setSavingDay(true);
    try {
      const cs = await fetch("/api/cycle-state").then(r => r.json()).catch(() => ({}));
      await fetch("/api/cycle-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentDayIdx: nextIdx, dayStates: cs?.dayStates ?? {} }),
      });
      setCurrentDayIdx(nextIdx);
      // Recarrega schedule para mostrar blocos do novo dia
      const scheduleData = await fetch("/api/schedule").then(r => r.json()).catch(() => null);
      if (scheduleData) setData(scheduleData);
    } catch (e) { console.error(e); }
    setSavingDay(false);
  };

  const toggleDone = (id: string) => {
    setDoneIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      localStorage.setItem(getDoneKey(uid), JSON.stringify([...next]));
      return next;
    });
  };

  const concludeDay = async () => {
    setCompleting(true);
    const undone  = allCiclo.filter(b => !doneIds.has(b.id));
    const nextIdx = (currentDayIdx + 1) % cycleDays.length;
    localStorage.setItem(getPendingKey(uid), JSON.stringify(undone));
    localStorage.setItem(getDoneKey(uid), "[]");
    setPendingBlocks(undone);
    setDoneIds(new Set());
    await saveDayIdx(nextIdx);
    setCompleting(false);
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: BG, borderTopColor: "transparent" }} />
    </div>
  );

  const today   = new Date();
  const dateStr = today.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric", weekday: "long" });
  const hoursTarget   = data?.weekStats.targetHours ?? 0;
  const hoursProgress = pct(data?.weekStats.hours ?? 0, hoursTarget);

  const cycleDays  = getCycleDays(cicloBlocks);
  const currentDay = cycleDays[currentDayIdx] ?? -1;
  const todayCiclo = cicloBlocks.filter(b => b.dayOfWeek === currentDay);
  const allCiclo   = [...pendingBlocks, ...todayCiclo];
  const doneCount  = doneIds.size;
  const totalCount = allCiclo.length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="text-white px-8" style={{ backgroundColor: BG, minHeight: "124px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <p className="text-sm capitalize" style={{ color: "rgba(255,255,255,0.6)" }}>{dateStr}</p>
        <h1 className="text-3xl font-bold mt-1">Fila do Dia</h1>
        <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.6)" }}>
          Dia {currentDayIdx + 1} do ciclo · {fmtH(allCiclo.reduce((a, b) => a + b.hours, 0))} programadas · {doneCount}/{totalCount} feitos
        </p>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">

        {/* KPIs de hoje */}
        {data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Horas hoje",         value: fmtH(data.todayStats.hours),    icon: Clock,       color: "text-blue-600"   },
              { label: "Questões hoje",      value: data.todayStats.questions,       icon: Target,      color: "text-purple-600" },
              { label: "Revisões pendentes", value: data.reviews.length,             icon: RefreshCw,   color: data.reviews.length > 0 ? "text-red-600" : "text-green-600" },
              { label: "Erros críticos",     value: data.criticalErrors.length,      icon: AlertCircle, color: data.criticalErrors.length > 0 ? "text-orange-600" : "text-green-600" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-1"><Icon className={`w-4 h-4 ${color}`} /><p className="text-xs text-gray-500">{label}</p></div>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Fila do ciclo */}
        {cicloBlocks.length > 0 && (
          <div className="space-y-3">
            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-base font-semibold flex items-center gap-2">
                    <Zap className="w-4 h-4 text-yellow-500" />
                    Dia {currentDayIdx + 1} do ciclo
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">{fmtH(todayCiclo.reduce((a, b) => a + b.hours, 0))} programadas</p>
                </div>
                <div className="flex items-center gap-2">
                  {/* Navegação manual — salva no banco */}
                  <button disabled={savingDay}
                    onClick={() => { const prev = (currentDayIdx - 1 + cycleDays.length) % cycleDays.length; saveDayIdx(prev); setDoneIds(new Set()); localStorage.setItem(getDoneKey(uid), "[]"); }}
                    className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold flex items-center justify-center disabled:opacity-40">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm text-gray-500">{doneCount}/{totalCount}</span>
                  <button disabled={savingDay}
                    onClick={() => { const next = (currentDayIdx + 1) % cycleDays.length; saveDayIdx(next); setDoneIds(new Set()); localStorage.setItem(getDoneKey(uid), "[]"); }}
                    className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold flex items-center justify-center disabled:opacity-40">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button onClick={concludeDay} disabled={completing || savingDay}
                    className="flex items-center gap-1.5 px-4 py-2 bg-green-500 hover:bg-green-400 disabled:opacity-50 text-white font-semibold rounded-xl text-xs transition-colors">
                    <CheckCircle className="w-3.5 h-3.5" />
                    {completing ? "Avançando..." : "Concluir dia"}
                  </button>
                </div>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: totalCount > 0 ? `${(doneCount / totalCount) * 100}%` : "0%" }} />
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
                    const done = doneIds.has(block.id);
                    return (
                      <div key={block.id} className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${done ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Pendente</span>
                            <span className="text-xs text-gray-500">{fmtH(block.hours)}</span>
                            <span className="text-xs text-gray-400">{BLOCK_TYPE_LABEL[block.blockType] ?? block.blockType}</span>
                          </div>
                          <p className="font-semibold text-gray-900">{block.subjectName ?? "Sem matéria"}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {block.subjectId && (
                            <Link href={`/sessao?subjectId=${block.subjectId}`}
                              className="text-xs text-white px-3 py-1.5 rounded-lg font-medium flex items-center gap-1"
                              style={{ backgroundColor: BG }}>
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

            {/* Blocos do dia */}
            <div className="space-y-2">
              {todayCiclo.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center">
                  <p className="text-sm text-gray-400">Nenhum bloco para este dia do ciclo.{" "}
                    <Link href="/calendario-ciclo" className="text-blue-600 hover:underline">Configurar calendário</Link>
                  </p>
                </div>
              ) : todayCiclo.map((block, i) => {
                const done = doneIds.has(block.id);
                return (
                  <div key={block.id}
                    className={`flex items-center gap-4 p-4 rounded-xl border-2 bg-white transition-all ${done ? "bg-green-50 border-green-200" : "border-gray-200"}`}>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${done ? "bg-green-500 text-white" : "bg-gray-100 text-gray-600"}`}>
                      {done ? <CheckCircle className="w-5 h-5" /> : i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="text-xs text-gray-500 flex items-center gap-1"><Clock className="w-3 h-3" />{fmtH(block.hours)}</span>
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{BLOCK_TYPE_LABEL[block.blockType] ?? block.blockType}</span>
                      </div>
                      <p className={`font-semibold ${done ? "line-through text-gray-400" : "text-gray-900"}`}>{block.subjectName ?? "Sem matéria"}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {block.subjectId && !done && (
                        <Link href={`/sessao?subjectId=${block.subjectId}`}
                          className="text-xs text-white px-3 py-1.5 rounded-lg font-medium flex items-center gap-1"
                          style={{ backgroundColor: BG }}>
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

            {/* Visão do ciclo completo */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              <p className="text-sm font-semibold text-gray-700 mb-3">Ciclo completo</p>
              <div className="flex flex-wrap gap-2">
                {cycleDays.map((day, idx) => {
                  const dayHours  = cicloBlocks.filter(b => b.dayOfWeek === day).reduce((a, b) => a + b.hours, 0);
                  const isCurrent = idx === currentDayIdx;
                  return (
                    <button key={day} disabled={savingDay}
                      onClick={() => { saveDayIdx(idx); setDoneIds(new Set()); localStorage.setItem(getDoneKey(uid), "[]"); }}
                      className="flex flex-col items-center px-4 py-2 rounded-xl border-2 text-sm transition-all hover:scale-105 disabled:opacity-40"
                      style={isCurrent ? { borderColor: BG, backgroundColor: BG, color: "#fff" } : { borderColor: "#E5E7EB", backgroundColor: "#F9FAFB", color: "#6B7280" }}>
                      <span className="font-bold">Dia {idx + 1}</span>
                      <span className="text-xs mt-0.5 opacity-70">{fmtH(dayHours)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Próxima ação */}
        {data?.nextSubject && (
          <div className="text-white rounded-2xl p-6" style={{ backgroundColor: BG }}>
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-5 h-5 text-yellow-400" />
              <span className="text-xs uppercase tracking-widest font-medium" style={{ color: "rgba(255,255,255,0.6)" }}>Próxima ação recomendada</span>
            </div>
            <p className="text-2xl font-bold mb-1">{data.nextSubject.name}</p>
            {data.nextBlockType && (
              <p className="text-sm mb-4" style={{ color: "rgba(255,255,255,0.6)" }}>
                {data.nextBlockType === "exercicios" ? "📝 Exercícios" : data.nextBlockType === "revisao7d" ? "🔄 Revisão 7 dias" : data.nextBlockType === "revisao14_30d" ? "🔄 Revisão 14/30 dias" : "📖 Leitura PDF"}
              </p>
            )}
            <Link href={`/sessao?subjectId=${data.nextSubject.id}`}
              className="inline-flex items-center gap-2 bg-white text-gray-900 font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-gray-100 transition-colors">
              Começar agora <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {/* Histórico do dia */}
        {data?.todayHistory && data.todayHistory.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <History className="w-5 h-5 text-gray-400" />
              O que você já estudou hoje
            </h2>
            <div className="space-y-3">
              {data.todayHistory.map((s, i) => {
                const accuracy = s.questions > 0 ? Math.round((s.correct / s.questions) * 100) : null;
                return (
                  <div key={s.id} className="flex items-center justify-between gap-4 p-4 bg-green-50 border border-green-100 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-green-600 text-white rounded-lg flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</div>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{s.subjectName}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-xs text-gray-500">⏱ {fmtH(s.hours)}</span>
                          {s.questions > 0 && <span className="text-xs text-gray-500">• {s.questions} questões</span>}
                          {accuracy !== null && <span className={`text-xs font-medium ${accuracy >= 70 ? "text-green-600" : accuracy >= 50 ? "text-yellow-600" : "text-red-600"}`}>• {accuracy}% acerto</span>}
                          <span className="text-xs text-gray-400">• {fmtTime(s.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                    <Link href={`/sessao?subjectId=${s.subjectId}`}
                      className="shrink-0 text-xs text-green-700 bg-green-100 hover:bg-green-200 px-3 py-1.5 rounded-lg font-medium transition-colors">
                      Continuar
                    </Link>
                  </div>
                );
              })}
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl border border-gray-100">
                <span className="text-sm text-gray-500 font-medium">Total do dia</span>
                <div className="flex items-center gap-4 text-sm font-semibold text-gray-900">
                  <span>⏱ {fmtH(data.todayStats.hours)}</span>
                  {data.todayStats.questions > 0 && <span>📝 {data.todayStats.questions} questões</span>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Progresso semanal */}
        {data && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Progresso da semana</h2>
            {hoursTarget > 0 ? (
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-gray-700">Horas</span>
                  <span className="text-gray-500">{fmtH(data.weekStats.hours)} / {fmtH(hoursTarget)}</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${hoursProgress}%`, backgroundColor: hoursProgress >= 100 ? "#10B981" : hoursProgress >= 60 ? "#3B82F6" : BG }} />
                </div>
                <p className={`text-xs mt-1 font-medium ${hoursProgress >= 100 ? "text-green-600" : "text-gray-500"}`}>{hoursProgress}% da meta {hoursProgress >= 100 ? "✓" : ""}</p>
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                  <span className="text-sm font-medium text-gray-700">Questões</span>
                  <span className="text-sm font-semibold text-gray-900">{data.weekStats.questions} resolvidas esta semana</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400">Configure seu <Link href="/calendario-ciclo" className="text-blue-600 hover:underline">calendário semanal</Link> para ver o progresso de horas aqui.</p>
            )}
          </div>
        )}

        {/* Revisões */}
        {data && data.reviews.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2"><RefreshCw className="w-5 h-5 text-blue-500" />Revisões para hoje ({data.reviews.length})</h2>
              <Link href="/revisoes" className="text-sm text-blue-600 hover:underline">Ver todas</Link>
            </div>
            <div className="space-y-2">
              {data.reviews.slice(0, 5).map(r => (
                <div key={r.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-xl border border-blue-100">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{r.pdf.title}</p>
                    <p className="text-xs text-gray-500">{r.pdf.topic.subject.name} • Revisão {r.type}</p>
                  </div>
                  <Link href="/revisoes" className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-blue-700 transition-colors">Revisar</Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Erros críticos */}
        {data && data.criticalErrors.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2"><AlertCircle className="w-5 h-5 text-red-500" />Erros críticos para revisar</h2>
              <Link href="/caderno" className="text-sm text-red-600 hover:underline">Ver todos</Link>
            </div>
            <div className="space-y-2">
              {data.criticalErrors.map(e => (
                <div key={e.id} className="flex items-center justify-between p-3 bg-red-50 rounded-xl border border-red-100">
                  <div>
                    <p className="text-sm font-medium text-gray-900 truncate max-w-sm">{e.title}</p>
                    <p className="text-xs text-gray-500">{e.subject.name} • Errou {e.wrongCount}x</p>
                  </div>
                  <Link href="/caderno" className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-red-700 transition-colors">Revisar</Link>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
