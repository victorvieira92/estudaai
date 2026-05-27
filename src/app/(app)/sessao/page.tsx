"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown, Plus, X, AlertCircle } from "lucide-react";

const BG = "#1B4040";
const ACCENT = "#2DD4BF"; // teal claro para bordas/checks igual nas imagens

interface Pdf     { id: string; title: string; completed: boolean; totalPages: number; lastPageStudied: number; }
interface Topic   { id: string; name: string; pdfs: Pdf[]; }
interface Subject { id: string; name: string; topics: Topic[]; }

interface VideoAula { id: string; title: string; start: string; end: string; }
interface PageRange { id: string; start: string; end: string; }

const CATEGORIES = ["Teoria", "Exercícios", "Revisão", "Leitura de Lei", "Videoaula"];
const DEFAULT_REVIEWS = ["1d", "7d", "30d"];

async function safeFetch<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const t = await r.text();
    if (!t.trim()) return null;
    return JSON.parse(t);
  } catch { return null; }
}

const uid = () => Math.random().toString(36).slice(2, 8);

// ── Estilos reutilizáveis ─────────────────────────────────────────────────
const labelCls  = "block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1";
const inputCls  = "w-full border-b-2 outline-none text-center font-semibold bg-transparent transition-colors focus:border-teal-500";
const selectBox = "w-full appearance-none border-b-2 border-teal-400 bg-transparent py-2 px-0 text-sm text-gray-800 focus:outline-none focus:border-teal-600 pr-6";

function SessaoContent() {
  const searchParams = useSearchParams();

  // ── Dados do formulário ───────────────────────────────────────────────
  const [dateMode,       setDateMode]       = useState<"hoje" | "ontem" | "outro">("hoje");
  const [otherDate,      setOtherDate]      = useState("");
  const [subjects,       setSubjects]       = useState<Subject[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [subjectId,      setSubjectId]      = useState("");
  const [topicId,        setTopicId]        = useState("");
  const [category,       setCategory]       = useState("Teoria");
  const [material,       setMaterial]       = useState("");
  const [studyTime,      setStudyTime]      = useState("00:00:00");
  const [theoryDone,     setTheoryDone]     = useState(false);
  const [scheduleReview, setScheduleReview] = useState(false);
  const [reviewTags,     setReviewTags]     = useState<string[]>(DEFAULT_REVIEWS);
  const [newReview,      setNewReview]      = useState("");

  // Questões
  const [correct,    setCorrect]    = useState("0");
  const [wrong,      setWrong]      = useState("0");

  // Páginas (múltiplas)
  const [pages, setPages] = useState<PageRange[]>([{ id: uid(), start: "0", end: "0" }]);

  // Videoaulas (múltiplas)
  const [videos, setVideos] = useState<VideoAula[]>([{ id: uid(), title: "Vídeo 01", start: "00:00:00", end: "00:00:00" }]);

  const [comment,      setComment]      = useState("");
  const [saveAndNew,   setSaveAndNew]   = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [saved,        setSaved]        = useState(false);
  const [error,        setError]        = useState("");

  const subject  = subjects.find(s => s.id === subjectId);
  const topic    = subject?.topics.find(t => t.id === topicId);
  const canSave  = !!subjectId;

  // ── Carregar disciplinas ──────────────────────────────────────────────
  useEffect(() => {
    safeFetch<Subject[]>("/api/subjects").then(d => {
      if (!d) return;
      const list: Subject[] = Array.isArray(d) ? d : (d as any).subjects ?? [];
      setSubjects(list);
      const urlSubjectId = searchParams.get("subjectId");
      if (!urlSubjectId) return;
      const matched = list.find(s => s.id === urlSubjectId);
      if (!matched) return;
      setSubjectId(matched.id);
      const firstTopic = matched.topics.find(t => t.pdfs.some(p => !p.completed));
      if (!firstTopic) return;
      setTopicId(firstTopic.id);
    }).finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { setTopicId(""); setMaterial(""); }, [subjectId]);
  useEffect(() => { setMaterial(""); }, [topicId]);

  // ── Tags de revisão ───────────────────────────────────────────────────
  const addReviewTag = () => {
    const v = newReview.trim();
    if (!v || reviewTags.includes(v)) return;
    setReviewTags([...reviewTags, v]); setNewReview("");
  };
  const removeReviewTag = (tag: string) => setReviewTags(reviewTags.filter(t => t !== tag));

  // ── Páginas ───────────────────────────────────────────────────────────
  const addPage    = () => setPages([...pages, { id: uid(), start: "0", end: "0" }]);
  const removePage = (id: string) => setPages(pages.filter(p => p.id !== id));
  const updatePage = (id: string, field: "start" | "end", val: string) =>
    setPages(pages.map(p => p.id === id ? { ...p, [field]: val } : p));

  // ── Videoaulas ────────────────────────────────────────────────────────
  const addVideo    = () => setVideos([...videos, { id: uid(), title: `Vídeo ${String(videos.length + 1).padStart(2,"0")}`, start: "00:00:00", end: "00:00:00" }]);
  const removeVideo = (id: string) => setVideos(videos.filter(v => v.id !== id));
  const updateVideo = (id: string, field: keyof VideoAula, val: string) =>
    setVideos(videos.map(v => v.id === id ? { ...v, [field]: val } : v));

  // ── Salvar ────────────────────────────────────────────────────────────
  const resetForm = () => {
    setStudyTime("00:00:00"); setCategory("Teoria"); setSubjectId(""); setTopicId("");
    setMaterial(""); setTheoryDone(false); setScheduleReview(false);
    setReviewTags(DEFAULT_REVIEWS); setCorrect("0"); setWrong("0");
    setPages([{ id: uid(), start: "0", end: "0" }]);
    setVideos([{ id: uid(), title: "Vídeo 01", start: "00:00:00", end: "00:00:00" }]);
    setComment(""); setDateMode("hoje"); setOtherDate("");
  };

  const doSave = async () => {
    if (!canSave) { setError("Selecione a disciplina."); return; }
    setSaving(true); setError("");

    // parse studyTime HH:MM:SS → seconds → hours
    const [hh, mm, ss] = studyTime.split(":").map(Number);
    const seconds = (hh || 0) * 3600 + (mm || 0) * 60 + (ss || 0);
    const hours   = seconds / 3600;
    const duration = Math.max(1, Math.round(hours * 60));

    const startPage = parseInt(pages[0]?.start) || 0;
    const endPage   = parseInt(pages[0]?.end)   || 0;

    // Calcula a data correta baseada no dateMode
    let studyDate: string | undefined;
    if (dateMode === "ontem") {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      studyDate = d.toISOString().slice(0, 10);
    } else if (dateMode === "outro" && otherDate) {
      studyDate = otherDate; // formato YYYY-MM-DD do input[type=date]
    }
    // dateMode === "hoje" → não envia studyDate, API usa now()

    try {
      const res = await fetch("/api/study-sessions", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectId, topicId,
          hours, duration,
          startPage, endPage, totalPages: 0,
          questions:        (parseInt(correct) || 0) + (parseInt(wrong) || 0),
          correctQuestions: parseInt(correct) || 0,
          wrongQuestions:   parseInt(wrong)   || 0,
          completed:        theoryDone,
          category,
          topicName: topic?.name ?? "",
          pdfTitle:  material,
          comment,
          studyDate, // ← NOVO: data do estudo (undefined = hoje)
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Erro ao salvar.");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      if (saveAndNew) resetForm();
    } catch (e: any) {
      setError(e.message);
    } finally { setSaving(false); }
  };

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="text-white px-8"
        style={{ backgroundColor: BG, minHeight: 100, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <p className="text-xs uppercase tracking-widest mb-0.5" style={{ color: "rgba(255,255,255,0.5)" }}>Registro</p>
        <h1 className="text-3xl font-bold">Sessão de Estudo</h1>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">

          {/* ── Título do modal ── */}
          <div className="flex items-center justify-between px-6 pt-6 pb-2">
            <h2 className="text-xl font-bold text-gray-800">Registro de Estudo</h2>
          </div>

          {/* ── Data: Hoje / Ontem / Outro ── */}
          <div className="flex items-center gap-2 px-6 pb-4 pt-1">
            <span className="text-gray-400 mr-1">
              <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
            </span>
            {(["hoje", "ontem", "outro"] as const).map(d => (
              <button key={d} onClick={() => setDateMode(d)}
                className="px-4 py-1 rounded text-sm font-semibold transition-colors"
                style={dateMode === d
                  ? { backgroundColor: BG, color: "#fff" }
                  : { backgroundColor: "transparent", color: "#9CA3AF", border: "1px solid #E5E7EB" }}>
                {d.toUpperCase()}
              </button>
            ))}
            {dateMode === "outro" && (
              <input type="date" value={otherDate} onChange={e => setOtherDate(e.target.value)}
                className="ml-2 border border-gray-300 rounded px-2 py-1 text-sm" />
            )}
          </div>

          <div className="px-6 pb-6 space-y-4">

            {/* ── Linha 1: CATEGORIA | DISCIPLINA | TEMPO DE ESTUDO ── */}
            <div className="grid grid-cols-3 gap-6">
              {/* Categoria */}
              <div>
                <label className={labelCls}>Categoria</label>
                <div className="relative">
                  <select value={category} onChange={e => setCategory(e.target.value)} className={selectBox}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <ChevronDown size={13} className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Disciplina */}
              <div>
                <label className={labelCls}>Disciplina</label>
                <div className="relative">
                  <select value={subjectId} onChange={e => setSubjectId(e.target.value)} disabled={loading} className={selectBox}>
                    <option value="">Selecione...</option>
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <ChevronDown size={13} className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Tempo de estudo */}
              <div>
                <label className={labelCls}>Tempo de Estudo</label>
                <input
                  type="text"
                  value={studyTime}
                  onChange={e => setStudyTime(e.target.value)}
                  placeholder="00:00:00"
                  className="w-full border-b-2 border-teal-400 outline-none text-sm font-mono bg-transparent py-2 text-gray-800 focus:border-teal-600"
                />
              </div>
            </div>

            {/* ── Linha 2: TÓPICO | MATERIAL ── */}
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className={labelCls}>Tópico</label>
                <div className="relative">
                  <select value={topicId} onChange={e => setTopicId(e.target.value)} disabled={!subject} className={selectBox}>
                    <option value="">Selecione...</option>
                    {(subject?.topics ?? []).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <ChevronDown size={13} className="absolute right-0 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className={labelCls}>Material</label>
                <input
                  type="text"
                  list="material-suggestions"
                  value={material}
                  onChange={e => setMaterial(e.target.value)}
                  placeholder="Ex.: Aula 01"
                  className="w-full border-b-2 border-teal-400 outline-none text-sm bg-transparent py-2 text-gray-800 focus:border-teal-600"
                />
                {/* Sugestões dos PDFs do tópico selecionado */}
                <datalist id="material-suggestions">
                  {topic?.pdfs.map(p => (
                    <option key={p.id} value={p.title} />
                  ))}
                  {!topic && subject?.topics.flatMap(t => t.pdfs).map(p => (
                    <option key={p.id} value={p.title} />
                  ))}
                </datalist>
              </div>
            </div>

            {/* ── Checkboxes ── */}
            <div className="space-y-2 pt-1">
              {/* Teoria finalizada */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <span className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${theoryDone ? "border-teal-500 bg-teal-500" : "border-gray-300"}`}
                  onClick={() => setTheoryDone(!theoryDone)}>
                  {theoryDone && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                </span>
                <input type="checkbox" checked={theoryDone} onChange={e => setTheoryDone(e.target.checked)} className="sr-only" />
                <span className="text-xs font-bold uppercase tracking-widest text-gray-600">Teoria Finalizada</span>
              </label>

              {/* Programar revisões */}
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <span className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${scheduleReview ? "border-teal-500 bg-teal-500" : "border-gray-300"}`}
                  onClick={() => setScheduleReview(!scheduleReview)}>
                  {scheduleReview && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                </span>
                <input type="checkbox" checked={scheduleReview} onChange={e => setScheduleReview(e.target.checked)} className="sr-only" />
                <span className="text-xs font-bold uppercase tracking-widest text-gray-600">Programar Revisões</span>
              </label>

              {/* Tags de revisão */}
              {scheduleReview && (
                <div className="flex items-center gap-2 flex-wrap pl-6">
                  {reviewTags.map(tag => (
                    <span key={tag} className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full text-white"
                      style={{ backgroundColor: BG }}>
                      {tag}
                      <button onClick={() => removeReviewTag(tag)} className="ml-0.5 hover:opacity-70">
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                  <div className="flex items-center gap-1">
                    <input
                      type="text" value={newReview} onChange={e => setNewReview(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && addReviewTag()}
                      placeholder="ex: 60d"
                      className="border-b border-gray-300 w-14 text-xs px-1 py-0.5 outline-none focus:border-teal-500"
                    />
                    <button onClick={addReviewTag}
                      className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs"
                      style={{ backgroundColor: BG }}>
                      <Plus size={11} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── 3 boxes: Questões | Páginas | Videoaulas ── */}
            <div className="grid grid-cols-3 gap-4 pt-1">

              {/* QUESTÕES */}
              <div className="border border-gray-200 rounded-xl p-4" style={{ borderColor: "#e2f0ef" }}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">Questões</p>
                <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Acertos / Erros</p>
                <div className="flex gap-3">
                  <input type="number" min="0" value={correct} onChange={e => setCorrect(e.target.value)}
                    className={`${inputCls} text-gray-800 border-gray-200 text-xl w-1/2 py-1`} />
                  <input type="number" min="0" value={wrong} onChange={e => setWrong(e.target.value)}
                    className={`${inputCls} text-gray-800 border-gray-200 text-xl w-1/2 py-1`} />
                </div>
              </div>

              {/* PÁGINAS */}
              <div className="border border-gray-200 rounded-xl p-4" style={{ borderColor: "#e2f0ef" }}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">Páginas</p>
                <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Início / Fim</p>
                <div className="space-y-2">
                  {pages.map((p, i) => (
                    <div key={p.id} className="flex items-center gap-2">
                      <input type="number" min="0" value={p.start} onChange={e => updatePage(p.id, "start", e.target.value)}
                        className={`${inputCls} text-gray-800 border-gray-200 text-lg w-1/2 py-0.5`} />
                      <input type="number" min="0" value={p.end} onChange={e => updatePage(p.id, "end", e.target.value)}
                        className={`${inputCls} text-gray-800 border-gray-200 text-lg w-1/2 py-0.5`} />
                      {pages.length > 1 && (
                        <button onClick={() => removePage(p.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                          <X size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex justify-center mt-3">
                  <button onClick={addPage}
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white transition-colors hover:opacity-80"
                    style={{ backgroundColor: "#5eead4" }}>
                    <Plus size={13} />
                  </button>
                </div>
              </div>

              {/* VIDEOAULAS */}
              <div className="border border-gray-200 rounded-xl p-4" style={{ borderColor: "#e2f0ef" }}>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-3">Videoaulas</p>
                <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Título / Início / Fim</p>
                <div className="space-y-2">
                  {videos.map((v) => (
                    <div key={v.id} className="flex items-center gap-1.5">
                      <input type="text" value={v.title} onChange={e => updateVideo(v.id, "title", e.target.value)}
                        className="flex-1 border-b border-gray-200 text-xs outline-none bg-transparent py-0.5 focus:border-teal-400 min-w-0" />
                      <input type="text" value={v.start} onChange={e => updateVideo(v.id, "start", e.target.value)}
                        placeholder="00:00:00"
                        className="w-16 border-b border-gray-200 text-xs outline-none bg-transparent py-0.5 text-center focus:border-teal-400 font-mono" />
                      <input type="text" value={v.end} onChange={e => updateVideo(v.id, "end", e.target.value)}
                        placeholder="00:00:00"
                        className="w-16 border-b border-gray-200 text-xs outline-none bg-transparent py-0.5 text-center focus:border-teal-400 font-mono" />
                      {videos.length > 1 && (
                        <button onClick={() => removeVideo(v.id)} className="text-gray-300 hover:text-red-400 transition-colors shrink-0">
                          <X size={11} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex justify-center mt-3">
                  <button onClick={addVideo}
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white transition-colors hover:opacity-80"
                    style={{ backgroundColor: "#5eead4" }}>
                    <Plus size={13} />
                  </button>
                </div>
              </div>
            </div>

            {/* ── Comentários ── */}
            <div>
              <label className={labelCls}>Comentários</label>
              <textarea value={comment} onChange={e => setComment(e.target.value)}
                rows={3} placeholder=""
                className="w-full border-b-2 border-teal-200 outline-none text-sm bg-transparent py-1 text-gray-800 resize-none focus:border-teal-500 mt-1" />
            </div>

            {/* ── Feedbacks ── */}
            {saved && (
              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-green-700 text-sm font-medium">
                ✓ Sessão salva com sucesso!
              </div>
            )}
            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* ── Footer: Salvar e criar novo | Cancelar | Salvar ── */}
            <div className="flex items-center justify-between pt-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <span className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${saveAndNew ? "border-teal-500 bg-teal-500" : "border-gray-300"}`}
                  onClick={() => setSaveAndNew(!saveAndNew)}>
                  {saveAndNew && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                </span>
                <span className="text-xs font-bold uppercase tracking-widest text-gray-600">Salvar e Criar Novo</span>
              </label>

              <div className="flex gap-3">
                <button onClick={resetForm}
                  className="px-5 py-2 rounded-lg text-sm font-semibold text-gray-500 border border-gray-200 hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
                <button onClick={doSave} disabled={saving || !canSave}
                  className="px-6 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50 hover:opacity-90"
                  style={{ backgroundColor: "#5eead4", color: BG }}>
                  {saving ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

export default function SessaoPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: BG }} />
      </div>
    }>
      <SessaoContent />
    </Suspense>
  );
}
