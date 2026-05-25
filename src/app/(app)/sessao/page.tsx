"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useStudyTimer } from "@/hooks/useStudyTimer";
import { useCountdown } from "@/hooks/useCountdown";
import {
  Play, Pause, Square, RotateCcw, ChevronDown,
  CheckSquare, AlertCircle, Timer, Clock,
} from "lucide-react";

const BG = "#1B4040";

interface Pdf     { id: string; title: string; completed: boolean; totalPages: number; lastPageStudied: number; }
interface Topic   { id: string; name: string; pdfs: Pdf[]; }
interface Subject { id: string; name: string; topics: Topic[]; }

const CATEGORIES = ["Teoria", "Exercícios", "Revisão", "Leitura de Lei", "Videoaula"];
const TIMER_PRESETS = [25, 30, 45, 50, 60, 90];

async function safeFetch<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const t = await r.text();
    if (!t.trim()) return null;
    return JSON.parse(t);
  } catch { return null; }
}

function SessaoContent() {
  const searchParams = useSearchParams();

  // Modo: cronômetro (contagem crescente) ou timer (contagem regressiva)
  const [mode, setMode] = useState<"cronometro" | "timer">("cronometro");

  const timer    = useStudyTimer();
  const countdown = useCountdown();

  const [subjects,       setSubjects]       = useState<Subject[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [subjectId,      setSubjectId]      = useState("");
  const [topicId,        setTopicId]        = useState("");
  const [pdfId,          setPdfId]          = useState("");
  const [category,       setCategory]       = useState("Teoria");
  const [material,       setMaterial]       = useState("");
  const [comment,        setComment]        = useState("");
  const [totalPages,     setTotalPages]     = useState("0");
  const [startPage,      setStartPage]      = useState("1");
  const [endPage,        setEndPage]        = useState("1");
  const [questions,      setQuestions]      = useState("0");
  const [correct,        setCorrect]        = useState("0");
  const [markCompleted,  setMarkCompleted]  = useState(false);
  const [theoryDone,     setTheoryDone]     = useState(false);
  const [scheduleReview, setScheduleReview] = useState(true);
  const [timerMins,      setTimerMins]      = useState(25);
  const [saving,         setSaving]         = useState(false);
  const [saved,          setSaved]          = useState(false);
  const [error,          setError]          = useState("");

  const subject = subjects.find(s => s.id === subjectId);
  const topic   = subject?.topics.find(t => t.id === topicId);
  const pdf     = topic?.pdfs.find(p => p.id === pdfId);
  const wrong   = Math.max(0, (parseInt(questions) || 0) - (parseInt(correct) || 0));
  const canSave = !!subjectId;

  useEffect(() => {
    safeFetch<Subject[]>("/api/subjects").then(d => {
      if (!d) return;
      const list: Subject[] = Array.isArray(d) ? d : (d as any).subjects ?? [];
      setSubjects(list);

      const urlSubjectId = searchParams.get("subjectId");
      if (!urlSubjectId) return;
      const matchedSubject = list.find(s => s.id === urlSubjectId);
      if (!matchedSubject) return;
      setSubjectId(matchedSubject.id);
      const firstTopic = matchedSubject.topics.find(t => t.pdfs.some(p => !p.completed));
      if (!firstTopic) return;
      setTopicId(firstTopic.id);
      const firstPdf = firstTopic.pdfs.find(p => !p.completed);
      if (!firstPdf) return;
      setPdfId(firstPdf.id);
      if ((firstPdf.lastPageStudied ?? 0) > 0) setStartPage(String(firstPdf.lastPageStudied));
      if ((firstPdf.totalPages ?? 0) > 0) setTotalPages(String(firstPdf.totalPages));
    }).finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { setTopicId(""); setPdfId(""); setMaterial(""); }, [subjectId]);
  useEffect(() => { setPdfId(""); setMaterial(""); }, [topicId]);
  useEffect(() => {
    if (!pdf) return;
    if ((pdf.lastPageStudied ?? 0) > 0) setStartPage(String(pdf.lastPageStudied));
    if ((pdf.totalPages ?? 0) > 0) setTotalPages(String(pdf.totalPages));
    setMaterial(pdf.title);
  }, [pdfId, pdf]);

  // Quando muda preset do timer
  const applyTimerPreset = (mins: number) => {
    setTimerMins(mins);
    countdown.setDuration(mins);
  };

  const getElapsedSeconds = (): number => {
    if (mode === "cronometro") return timer.elapsed;
    return countdown.elapsedSeconds;
  };

  const doSave = async () => {
    if (!canSave) { setError("Selecione a disciplina."); return; }
    setSaving(true); setError("");
    const seconds = getElapsedSeconds();
    const hours   = seconds / 3600;
    const duration = Math.max(1, Math.round(hours * 60));
    try {
      const res = await fetch("/api/study-sessions", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectId, topicId, pdfId,
          hours, duration,
          startPage:       parseInt(startPage) || 1,
          endPage:         parseInt(endPage)   || 1,
          totalPages:      parseInt(totalPages) || 0,
          questions:       parseInt(questions)  || 0,
          correctQuestions: parseInt(correct)  || 0,
          wrongQuestions:  wrong,
          completed:       markCompleted,
          category,
          topicName: topic?.name  ?? "",
          pdfTitle:  pdf?.title   ?? material,
          comment,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Erro ao salvar.");
      setSaved(true);
      if (mode === "cronometro") timer.reset();
      else countdown.reset();
      setQuestions("0"); setCorrect("0"); setComment(""); setMarkCompleted(false); setTheoryDone(false);
      setTimeout(() => setSaved(false), 4000);
    } catch (e: any) {
      setError(e.message);
    } finally { setSaving(false); }
  };

  const isRunning = mode === "cronometro" ? timer.state === "running" : countdown.state === "running";
  const isPaused  = mode === "cronometro" ? timer.state === "paused"  : countdown.state === "paused";
  const isIdle    = mode === "cronometro" ? timer.state === "idle"    : countdown.state === "idle";
  const formatted = mode === "cronometro" ? timer.formatted : countdown.formatted;

  const handleStart  = () => mode === "cronometro" ? timer.start()   : countdown.start();
  const handlePause  = () => mode === "cronometro" ? timer.pause()   : countdown.pause();
  const handleResume = () => mode === "cronometro" ? timer.resume()  : countdown.resume();
  const handleReset  = () => mode === "cronometro" ? timer.reset()   : countdown.reset();
  const handleStop   = () => { if (mode === "cronometro") timer.stop(); else { /* keep elapsed */ } doSave(); };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="text-white px-8"
        style={{ backgroundColor: BG, minHeight: "124px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <p className="text-xs uppercase tracking-widest mb-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>Centro Operacional</p>
        <h1 className="text-3xl font-bold">Sessão de Estudo</h1>
        <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.6)" }}>Inicie o cronômetro, estude e salve automaticamente.</p>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-5">

        {/* ── Seletor Cronômetro / Timer ── */}
        <div className="flex gap-2 p-1 bg-gray-200 rounded-xl w-fit">
          {([["cronometro","Cronômetro", Clock], ["timer","Timer", Timer]] as const).map(([m, label, Icon]) => (
            <button key={m} onClick={() => setMode(m)}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all"
              style={mode === m ? { backgroundColor: BG, color: "#fff" } : { backgroundColor: "transparent", color: "#6B7280" }}>
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>

        {/* ── Cronômetro / Timer ── */}
        <div className="flex flex-col items-center gap-5 p-8 rounded-2xl border"
          style={{ backgroundColor: BG, borderColor: "rgba(255,255,255,0.1)" }}>

          {/* Presets do timer */}
          {mode === "timer" && isIdle && (
            <div className="flex flex-wrap gap-2 justify-center">
              {TIMER_PRESETS.map(mins => (
                <button key={mins} onClick={() => applyTimerPreset(mins)}
                  className="px-3 py-1 rounded-lg text-xs font-semibold transition-colors"
                  style={timerMins === mins
                    ? { backgroundColor: "#10B981", color: "#fff" }
                    : { backgroundColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}>
                  {mins}min
                </button>
              ))}
            </div>
          )}

          {/* Progresso do timer */}
          {mode === "timer" && !isIdle && countdown.targetSecs > 0 && (
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div className="h-2 rounded-full bg-green-400 transition-all"
                style={{ width: `${Math.min(100, countdown.pct)}%` }} />
            </div>
          )}

          <span className="text-xs uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.4)" }}>
            {mode === "cronometro" ? "Horas Líquidas" : "Timer"}
          </span>

          <span className={`text-7xl font-mono font-bold tabular-nums select-none ${
            isRunning ? "text-green-400"
            : isPaused ? "text-yellow-400"
            : countdown.state === "done" ? "text-red-400"
            : "text-gray-400"
          }`}>{formatted}</span>

          <span className="text-xs h-4" style={{ color: "rgba(255,255,255,0.4)" }}>
            {isRunning && "● Rodando"}
            {isPaused  && "⏸ Pausado"}
            {isIdle    && "Pronto para iniciar"}
            {countdown.state === "done" && "⏰ Tempo esgotado!"}
          </span>

          <div className="flex gap-3">
            {isIdle && (
              <button onClick={handleStart}
                className="flex items-center gap-2 px-8 py-3 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-xl text-sm transition-colors">
                <Play className="w-4 h-4" /> Iniciar
              </button>
            )}
            {isRunning && (<>
              <button onClick={handlePause}
                className="flex items-center gap-2 px-6 py-3 bg-yellow-600 hover:bg-yellow-500 text-white font-semibold rounded-xl text-sm transition-colors">
                <Pause className="w-4 h-4" /> Pausar
              </button>
              <button onClick={handleStop}
                className="flex items-center gap-2 px-6 py-3 bg-red-700 hover:bg-red-600 text-white font-semibold rounded-xl text-sm transition-colors">
                <Square className="w-4 h-4" /> Finalizar
              </button>
            </>)}
            {(isPaused || countdown.state === "done") && (<>
              {isPaused && (
                <button onClick={handleResume}
                  className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-xl text-sm transition-colors">
                  <Play className="w-4 h-4" /> Retomar
                </button>
              )}
              <button onClick={doSave}
                className="flex items-center gap-2 px-6 py-3 bg-red-700 hover:bg-red-600 text-white font-semibold rounded-xl text-sm transition-colors">
                <Square className="w-4 h-4" /> Finalizar
              </button>
              <button onClick={handleReset}
                className="px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition-colors">
                <RotateCcw className="w-4 h-4" />
              </button>
            </>)}
          </div>
        </div>

        {/* ── Formulário de registro ── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
          <div>
            <h2 className="text-lg font-semibold">Registrar estudo de hoje</h2>
            <p className="text-sm text-gray-500">Selecione disciplina, tópico e PDF para salvar.</p>
          </div>

          {/* Data: Hoje / Ontem / Outro (simplificado — sempre Hoje) */}
          <div className="flex gap-2">
            {["Hoje"].map(d => (
              <span key={d} className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white"
                style={{ backgroundColor: BG }}>{d}</span>
            ))}
          </div>

          {/* Categoria + Disciplina + Tempo (linha 1) */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Categoria</label>
              <div className="relative">
                <select value={category} onChange={e => setCategory(e.target.value)}
                  className="w-full appearance-none border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none pr-8">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Disciplina *</label>
              <div className="relative">
                <select value={subjectId} onChange={e => setSubjectId(e.target.value)} disabled={loading}
                  className="w-full appearance-none border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none pr-8 disabled:bg-gray-50">
                  <option value="">Selecione...</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Tempo de Estudo</label>
              <div className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-gray-50 font-mono text-center">
                {formatted}
              </div>
            </div>
          </div>

          {/* Tópico + Material (linha 2) */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Tópico</label>
              <div className="relative">
                <select value={topicId} onChange={e => setTopicId(e.target.value)} disabled={!subject}
                  className="w-full appearance-none border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none pr-8 disabled:bg-gray-50 disabled:text-gray-400">
                  <option value="">Selecione...</option>
                  {(subject?.topics ?? []).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Material</label>
              <input type="text" value={material} onChange={e => setMaterial(e.target.value)}
                placeholder="Ex.: Aula 01"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2"
                style={{ '--tw-ring-color': BG } as any} />
            </div>
          </div>

          {/* PDF */}
          {topic && topic.pdfs.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">PDF</label>
              <div className="relative">
                <select value={pdfId} onChange={e => setPdfId(e.target.value)}
                  className="w-full appearance-none border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none pr-8">
                  <option value="">Selecione...</option>
                  {topic.pdfs.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                </select>
                <ChevronDown className="absolute right-2 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
          )}

          {/* Checkboxes */}
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={theoryDone} onChange={e => setTheoryDone(e.target.checked)}
                className="rounded" />
              Teoria Finalizada
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" checked={scheduleReview} onChange={e => setScheduleReview(e.target.checked)}
                className="rounded" />
              Programar Revisões
            </label>
          </div>

          {/* Questões + Páginas */}
          <div className="grid grid-cols-2 gap-4">
            {/* Questões */}
            <div className="border border-gray-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Questões — Acertos / Erros</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <input type="number" min="0" value={correct} onChange={e => setCorrect(e.target.value)}
                    placeholder="Acertos"
                    className="w-full border-b-2 border-gray-200 focus:border-green-500 outline-none text-2xl text-center font-bold text-green-600 py-1 bg-transparent" />
                </div>
                <div>
                  <input type="number" min="0" value={wrong} readOnly
                    className="w-full border-b-2 border-gray-200 outline-none text-2xl text-center font-bold text-red-500 py-1 bg-transparent cursor-default" />
                </div>
              </div>
              <div className="mt-2">
                <input type="number" min="0" value={questions} onChange={e => setQuestions(e.target.value)}
                  placeholder="Total de questões"
                  className="w-full border-b border-gray-200 focus:border-blue-400 outline-none text-sm text-center text-gray-500 py-1 bg-transparent" />
              </div>
            </div>

            {/* Páginas */}
            <div className="border border-gray-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Páginas — Início / Fim</p>
              <div className="grid grid-cols-2 gap-3">
                <input type="number" min="0" value={startPage} onChange={e => setStartPage(e.target.value)}
                  className="w-full border-b-2 border-gray-200 focus:border-blue-500 outline-none text-2xl text-center font-bold text-gray-700 py-1 bg-transparent" />
                <input type="number" min="0" value={endPage} onChange={e => setEndPage(e.target.value)}
                  className="w-full border-b-2 border-gray-200 focus:border-blue-500 outline-none text-2xl text-center font-bold text-gray-700 py-1 bg-transparent" />
              </div>
              <div className="mt-2">
                <input type="number" min="0" value={totalPages} onChange={e => setTotalPages(e.target.value)}
                  placeholder="Total de páginas"
                  className="w-full border-b border-gray-200 focus:border-blue-400 outline-none text-sm text-center text-gray-500 py-1 bg-transparent" />
              </div>
            </div>
          </div>

          {/* Comentários */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Comentários</label>
            <textarea value={comment} onChange={e => setComment(e.target.value)}
              placeholder="Observações sobre a sessão..."
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 resize-none"
              style={{ '--tw-ring-color': BG } as any} />
          </div>

          {/* Marcar PDF como concluído */}
          {pdf && (
            <button type="button" onClick={() => setMarkCompleted(!markCompleted)}
              className={`flex items-center gap-3 text-sm rounded-lg px-4 py-2.5 border transition-colors ${
                markCompleted ? "text-white" : "bg-white border-gray-300 text-gray-700 hover:border-gray-500"
              }`}
              style={markCompleted ? { backgroundColor: BG, borderColor: BG } : {}}>
              <CheckSquare className="w-4 h-4" />
              Teoria Finalizada — &quot;{pdf.title}&quot;
            </button>
          )}

          {/* Feedbacks */}
          {saved && (
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-green-700 text-sm font-medium">
              ✓ Sessão salva com sucesso!
            </div>
          )}
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Botão Salvar */}
          <div className="flex gap-3 pt-1">
            <button onClick={doSave} disabled={saving || !canSave}
              className="px-6 py-3 text-white font-semibold rounded-xl text-sm transition-colors disabled:opacity-50"
              style={{ backgroundColor: BG }}>
              {saving ? "Salvando..." : "Salvar sessão"}
            </button>
          </div>
          {!canSave && (
            <p className="text-xs text-gray-400 text-center">Selecione a disciplina para salvar</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SessaoPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#1B4040" }} />
      </div>
    }>
      <SessaoContent />
    </Suspense>
  );
}
