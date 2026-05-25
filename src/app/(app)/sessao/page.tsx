"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useStudyTimer } from "@/hooks/useStudyTimer";
import {
  Play, Pause, Square, RotateCcw,
  ChevronDown, CheckSquare, AlertCircle,
} from "lucide-react";

interface Pdf     { id: string; title: string; completed: boolean; totalPages: number; lastPageStudied: number; }
interface Topic   { id: string; name: string; pdfs: Pdf[]; }
interface Subject { id: string; name: string; topics: Topic[]; }

async function safeFetch<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const t = await r.text();
    if (!t.trim()) return null;
    return JSON.parse(t);
  } catch { return null; }
}

// ─── Inner component (needs useSearchParams) ──────────────────────────────────
function SessaoContent() {
  const searchParams = useSearchParams();
  const timer = useStudyTimer();

  const [subjects,      setSubjects]      = useState<Subject[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [subjectId,     setSubjectId]     = useState("");
  const [topicId,       setTopicId]       = useState("");
  const [pdfId,         setPdfId]         = useState("");
  const [totalPages,    setTotalPages]    = useState("0");
  const [startPage,     setStartPage]     = useState("1");
  const [endPage,       setEndPage]       = useState("1");
  const [questions,     setQuestions]     = useState("0");
  const [correct,       setCorrect]       = useState("0");
  const [markCompleted, setMarkCompleted] = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [saved,         setSaved]         = useState(false);
  const [error,         setError]         = useState("");

  const subject = subjects.find(s => s.id === subjectId);
  const topic   = subject?.topics.find(t => t.id === topicId);
  const pdf     = topic?.pdfs.find(p => p.id === pdfId);
  const wrong   = Math.max(0, (parseInt(questions) || 0) - (parseInt(correct) || 0));
  const canSave = !!subjectId && !!topicId && !!pdfId;

  // ── Carrega matérias e aplica pré-seleção da URL ──────────────────────────
  useEffect(() => {
    safeFetch<Subject[]>("/api/subjects").then(d => {
      if (!d) return;
      const list: Subject[] = Array.isArray(d) ? d : (d as any).subjects ?? [];
      setSubjects(list);

      // ✅ Lê ?subjectId= passado pelo painel Hoje ("Começar agora")
      const urlSubjectId = searchParams.get("subjectId");
      if (!urlSubjectId) return;

      const matchedSubject = list.find(s => s.id === urlSubjectId);
      if (!matchedSubject) return;

      setSubjectId(matchedSubject.id);

      // Pré-seleciona o primeiro tópico com PDF não concluído
      const firstTopicWithPdf = matchedSubject.topics.find(
        t => t.pdfs.some(p => !p.completed)
      );
      if (!firstTopicWithPdf) return;
      setTopicId(firstTopicWithPdf.id);

      // Pré-seleciona o primeiro PDF não concluído desse tópico
      const firstPdf = firstTopicWithPdf.pdfs.find(p => !p.completed);
      if (!firstPdf) return;
      setPdfId(firstPdf.id);

      // Preenche páginas
      if ((firstPdf.lastPageStudied ?? 0) > 0)
        setStartPage(String(firstPdf.lastPageStudied));
      if ((firstPdf.totalPages ?? 0) > 0)
        setTotalPages(String(firstPdf.totalPages));
    }).finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resets em cascata ao trocar seleções manualmente
  useEffect(() => { setTopicId(""); setPdfId(""); }, [subjectId]);
  useEffect(() => { setPdfId(""); }, [topicId]);
  useEffect(() => {
    if (!pdfId || !pdf) return;
    if ((pdf.lastPageStudied ?? 0) > 0) setStartPage(String(pdf.lastPageStudied));
    if ((pdf.totalPages ?? 0) > 0)     setTotalPages(String(pdf.totalPages));
  }, [pdfId, pdf]);

  // ── Salvar sessão ─────────────────────────────────────────────────────────
  const doSave = async (seconds: number) => {
    if (!canSave) { setError("Selecione disciplina, tópico e PDF."); return; }
    setSaving(true); setError("");
    const hours    = seconds / 3600;
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
          correctQuestions: parseInt(correct)   || 0,
          wrongQuestions:  wrong,
          completed:       markCompleted,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Erro ao salvar.");
      setSaved(true);
      timer.reset();
      setQuestions("0"); setCorrect("0"); setMarkCompleted(false);
      setTimeout(() => setSaved(false), 4000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const { state, formatted } = timer;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="text-white px-8" style={{ backgroundColor: "#1B4040", minHeight: "124px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Centro Operacional</p>
        <h1 className="text-3xl font-bold">Sessão de Estudo</h1>
        <p className="text-gray-400 text-sm mt-1">Inicie o cronômetro, estude e salve automaticamente.</p>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">

        {/* ── Banner de contexto pré-selecionado ── */}
        {/* ✅ Mostra ao usuário que a disciplina foi pré-selecionada pelo painel Hoje */}
        {searchParams.get("subjectId") && subject && (
          <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
            <span className="text-blue-500">⚡</span>
            <span>
              Continuando de onde parou em{" "}
              <strong>{subject.name}</strong>
              {pdf && <> — <span className="font-medium">{pdf.title}</span></>}
            </span>
          </div>
        )}

        {/* ── Cronômetro ── */}
        <div className="flex flex-col items-center gap-5 p-8 rounded-2xl border" style={{ backgroundColor: "#1B4040", borderColor: "rgba(255,255,255,0.1)" }}>
          <span className="text-xs text-gray-500 uppercase tracking-widest">Horas Líquidas</span>
          <span className={`text-7xl font-mono font-bold tabular-nums select-none ${
            state === "running" ? "text-green-400"
            : state === "paused" ? "text-yellow-400"
            : "text-gray-400"
          }`}>
            {formatted}
          </span>
          <span className="text-xs text-gray-500 h-4">
            {state === "running" && "● Rodando"}
            {state === "paused"  && "⏸ Pausado"}
            {state === "idle"    && "Pronto para iniciar"}
          </span>
          <div className="flex gap-3">
            {state === "idle" && (
              <button onClick={timer.start}
                className="flex items-center gap-2 px-8 py-3 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-xl text-sm transition-colors">
                <Play className="w-4 h-4" /> Iniciar
              </button>
            )}
            {state === "running" && (<>
              <button onClick={timer.pause}
                className="flex items-center gap-2 px-6 py-3 bg-yellow-600 hover:bg-yellow-500 text-white font-semibold rounded-xl text-sm transition-colors">
                <Pause className="w-4 h-4" /> Pausar
              </button>
              <button onClick={() => doSave(timer.stop())}
                className="flex items-center gap-2 px-6 py-3 bg-red-700 hover:bg-red-600 text-white font-semibold rounded-xl text-sm transition-colors">
                <Square className="w-4 h-4" /> Finalizar
              </button>
            </>)}
            {state === "paused" && (<>
              <button onClick={timer.resume}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-xl text-sm transition-colors">
                <Play className="w-4 h-4" /> Retomar
              </button>
              <button onClick={() => doSave(timer.stop())}
                className="flex items-center gap-2 px-6 py-3 bg-red-700 hover:bg-red-600 text-white font-semibold rounded-xl text-sm transition-colors">
                <Square className="w-4 h-4" /> Finalizar
              </button>
              <button onClick={timer.reset}
                className="px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl transition-colors">
                <RotateCcw className="w-4 h-4" />
              </button>
            </>)}
          </div>
        </div>

        {/* ── Formulário ── */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
          <div>
            <h2 className="text-lg font-semibold">Registrar estudo de hoje</h2>
            <p className="text-sm text-gray-500">Selecione disciplina, tópico e PDF para salvar.</p>
          </div>

          {/* Selects em cascata */}
          <div className="grid grid-cols-3 gap-4">
            {[
              {
                label:    "Disciplina *",
                value:    subjectId,
                set:      setSubjectId,
                opts:     subjects.map(s => ({ id: s.id, name: s.name })),
                disabled: loading,
              },
              {
                label:    "Tópico *",
                value:    topicId,
                set:      setTopicId,
                opts:     (subject?.topics ?? []).map(t => ({ id: t.id, name: t.name })),
                disabled: !subject,
              },
              {
                label:    "PDF *",
                value:    pdfId,
                set:      setPdfId,
                opts:     (topic?.pdfs ?? []).map(p => ({ id: p.id, name: p.title })),
                disabled: !topic,
              },
            ].map(({ label, value, set, opts, disabled }) => (
              <div key={label}>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
                  {label}
                </label>
                <div className="relative">
                  <select
                    value={value}
                    onChange={e => set(e.target.value)}
                    disabled={disabled}
                    className="w-full appearance-none border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 pr-8 disabled:bg-gray-50 disabled:text-gray-400"
                  >
                    <option value="">Selecione</option>
                    {opts.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
            ))}
          </div>

          {/* Aviso de página anterior */}
          {(pdf?.lastPageStudied ?? 0) > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 text-sm text-blue-700">
              📌 Você parou na página {pdf?.lastPageStudied}. Continue a partir daí.
            </div>
          )}

          {/* Páginas */}
          <div className="grid grid-cols-3 gap-4">
            {[
              ["Total de páginas", totalPages, setTotalPages],
              ["Página inicial",   startPage,  setStartPage],
              ["Página final",     endPage,    setEndPage],
            ].map(([l, v, s]: any) => (
              <div key={l}>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">{l}</label>
                <input
                  type="number" min="0" value={v}
                  onChange={e => s(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
            ))}
          </div>

          {/* Questões */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
                Questões feitas
              </label>
              <input
                type="number" min="0" value={questions}
                onChange={e => setQuestions(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
                Acertos
              </label>
              <input
                type="number" min="0" value={correct}
                onChange={e => setCorrect(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
                Erros (auto)
              </label>
              <input
                readOnly value={wrong}
                className={`w-full border rounded-lg px-3 py-2.5 text-sm bg-gray-50 ${
                  wrong > 0 ? "border-red-300 text-red-700" : "border-gray-200 text-gray-500"
                }`}
              />
            </div>
          </div>

          {/* Marcar PDF como concluído */}
          {pdf && (
            <button
              type="button"
              onClick={() => setMarkCompleted(!markCompleted)}
              className={`flex items-center gap-3 text-sm rounded-lg px-4 py-2.5 border transition-colors ${
                markCompleted
                  ? "bg-gray-900 border-gray-900 text-white"
                  : "bg-white border-gray-300 text-gray-700 hover:border-gray-500"
              }`}
            >
              <CheckSquare className="w-4 h-4" />
              Marcar &quot;{pdf.title}&quot; como concluído
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

          {/* Botão salvar */}
          <div className="flex gap-3 pt-1">
            {state === "idle" && (
              <button
                onClick={() => doSave(0)}
                disabled={saving || !canSave}
                className="px-6 py-3 bg-gray-900 hover:bg-gray-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-colors"
              >
                {saving ? "Salvando..." : "Salvar sessão"}
              </button>
            )}
            {(state === "running" || state === "paused") && (
              <button
                onClick={() => doSave(timer.stop())}
                disabled={saving || !canSave}
                className="px-6 py-3 bg-gray-900 hover:bg-gray-700 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-colors"
              >
                {saving ? "Salvando..." : "⏹ Finalizar e Salvar"}
              </button>
            )}
          </div>
          {!canSave && (
            <p className="text-xs text-gray-400 text-center">
              Selecione disciplina, tópico e PDF para salvar
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Wrapper com Suspense (obrigatório para useSearchParams no Next.js 14) ────
export default function SessaoPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SessaoContent />
    </Suspense>
  );
}
