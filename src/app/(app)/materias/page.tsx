"use client";
import { useState, useEffect, useCallback } from "react";
import { Plus, ChevronDown, ChevronUp, BookOpen, Trash2, Pencil, Check, X, RotateCcw } from "lucide-react";

// Sessão vinda de /api/historico (mesma estrutura do Histórico)
interface HistoricoSession {
  id:             string;
  subjectId:      string;
  subjectName:    string;
  hours:          number;
  hoursFormatted: string;
  questions:      number;
  correct:        number;
  wrong:          number;
  accuracy:       number | null;
  createdAt:      string;
  category:       string;
  topicName:      string;
  pdfTitle:       string;
  comment:        string;
}

interface Pdf {
  id: string; title: string; completed: boolean;
  totalPages: number; lastPageStudied: number; studyHours: number;
  questions: number; correctQuestions: number; wrongQuestions: number;
}
interface Topic { id: string; name: string; pdfs: Pdf[]; }
interface Subject {
  id: string; name: string; editalWeight: number; criticality: number;
  studyHours: number; totalQuestions: number; correctQuestions: number; wrongQuestions: number;
  completedPdfs: number; totalPdfs: number; progress: number;
  topics: Topic[];
}

function toNum(v: any, fallback = 0) { const n = Number(v); return isNaN(n) ? fallback : n; }
function fmtDate(d: string) { return new Date(d).toLocaleDateString("pt-BR"); }
function accuracy(correct: number, total: number) { return total > 0 ? Math.round((correct / total) * 100) : 0; }
function fmtHours(h: number) { return `${h.toFixed(1)}h`; }

// ── PdfCard ──────────────────────────────────────────────────────────────────
function PdfCard({
  pdf, subjectId, onReload, allSessions,
}: {
  pdf: Pdf;
  subjectId: string;
  onReload: () => void;
  allSessions: HistoricoSession[]; // já carregadas pela página pai
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(pdf.title);
  const [editCompleted, setEditCompleted] = useState(pdf.completed);
  const [editTotalPages, setEditTotalPages] = useState(pdf.totalPages);
  const [savingPdf, setSavingPdf] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const pct = pdf.totalPages > 0 ? Math.min(100, Math.round((pdf.lastPageStudied / pdf.totalPages) * 100)) : 0;
  const acc = accuracy(pdf.correctQuestions, pdf.questions);

  // Filtra sessões do histórico que pertencem a este PDF
  // Match robusto: subjectId bate + pdfTitle ou topicName contém o título do PDF (ou vice-versa)
  const normalize = (str: string) => str.trim().toLowerCase();
  const pdfNorm   = normalize(pdf.title);

  const pdfSessions = allSessions.filter(s => {
    if (s.subjectId !== subjectId) return false;
    const titleNorm = normalize(s.pdfTitle);
    const topicNorm = normalize(s.topicName);
    if (!titleNorm && !topicNorm) return false;
    // Match exato
    if (titleNorm === pdfNorm) return true;
    if (topicNorm === pdfNorm) return true;
    // Match por inclusão (um contém o outro)
    if (titleNorm && (titleNorm.includes(pdfNorm) || pdfNorm.includes(titleNorm))) return true;
    if (topicNorm && (topicNorm.includes(pdfNorm) || pdfNorm.includes(topicNorm))) return true;
    return false;
  });

  // KPIs calculados direto das sessões (fonte única de verdade = StudySession)
  const totalHours     = pdfSessions.reduce((a, s) => a + s.hours, 0);
  const totalQuestions = pdfSessions.reduce((a, s) => a + s.questions, 0);
  const totalCorrect   = pdfSessions.reduce((a, s) => a + s.correct, 0);
  const totalWrong     = pdfSessions.reduce((a, s) => a + s.wrong, 0);
  const totalAcc       = accuracy(totalCorrect, totalQuestions);

  const savePdf = async () => {
    setSavingPdf(true);
    await fetch(`/api/pdfs/${pdf.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editTitle, completed: editCompleted, totalPages: editTotalPages }),
    });
    setEditingTitle(false);
    onReload();
    setSavingPdf(false);
  };

  const deletePdf = async () => {
    if (!confirm("Excluir este PDF e todo o seu histórico?")) return;
    await fetch(`/api/pdfs/${pdf.id}`, { method: "DELETE" });
    onReload();
  };

  const deleteSession = async (id: string) => {
    if (!confirm("Excluir este registro de estudo?")) return;
    await fetch(`/api/historico?id=${id}`, { method: "DELETE" });
    onReload();
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
      {/* Header do PDF */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {editingTitle ? (
          <div className="flex flex-1 items-center gap-2">
            <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
              className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-gray-900"/>
            <input type="number" min="0" value={editTotalPages} onChange={e => setEditTotalPages(+e.target.value)}
              placeholder="Total páginas"
              className="w-32 border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"/>
            <label className="flex items-center gap-2 border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-white cursor-pointer">
              <input type="checkbox" checked={editCompleted} onChange={e => setEditCompleted(e.target.checked)} className="w-4 h-4"/>
              Concluído
            </label>
            <button onClick={savePdf} disabled={savingPdf}
              className="px-4 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-bold disabled:opacity-50">
              {savingPdf ? "..." : "Salvar"}
            </button>
            <button onClick={() => setEditingTitle(false)} className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm">
              Cancelar
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 flex-1">
            <span className="text-lg">{pdf.completed ? "✅" : pdf.lastPageStudied > 0 ? "🔵" : "⭕"}</span>
            <div className="flex-1">
              <p className="font-bold text-gray-900">{pdf.title}</p>
              {pdf.totalPages > 0 && (
                <p className="text-xs text-gray-500 mt-0.5">
                  Progresso: {pct}% · Página {pdf.lastPageStudied}/{pdf.totalPages}
                </p>
              )}
            </div>
            <button
              onClick={() => { setEditingTitle(true); setEditTitle(pdf.title); setEditCompleted(pdf.completed); setEditTotalPages(pdf.totalPages); }}
              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors">
              <Pencil className="w-3.5 h-3.5"/>
            </button>
            <button
              onClick={() => fetch(`/api/pdfs/${pdf.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ completed: !pdf.completed }) }).then(() => onReload())}
              className={`p-1.5 rounded-lg transition-colors hover:bg-gray-200 ${pdf.completed ? "text-yellow-500" : "text-gray-400 hover:text-green-600"}`}
              title={pdf.completed ? "Desmarcar" : "Marcar concluído"}>
              <RotateCcw className="w-3.5 h-3.5"/>
            </button>
            <button onClick={deletePdf} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
              <Trash2 className="w-3.5 h-3.5"/>
            </button>
          </div>
        )}
      </div>

      {/* KPIs calculados das sessões */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total horas",    value: fmtHours(totalHours),    color: "" },
          { label: "Total questões", value: totalQuestions,           color: "" },
          { label: "Total acertos",  value: totalCorrect,             color: "text-green-600" },
          { label: "Total erros",    value: totalWrong,               color: "text-red-600" },
          { label: "Acurácia",       value: `${totalAcc}%`,           color: totalAcc >= 70 ? "text-green-600" : totalAcc >= 50 ? "text-yellow-600" : totalAcc > 0 ? "text-red-600" : "" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-3">
            <p className="text-xs text-gray-500">{label}</p>
            <p className={`font-bold text-lg mt-0.5 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Histórico de Estudos — mesmos dados do Histórico */}
      <div className="mt-5">
        <button
          type="button"
          onClick={() => setShowHistory(h => !h)}
          className="w-full flex items-center justify-between py-2 text-left group"
        >
          <h4 className="font-bold text-gray-900">
            Histórico de Estudos{" "}
            {pdfSessions.length > 0 && (
              <span className="text-gray-400 font-normal text-sm">({pdfSessions.length})</span>
            )}
          </h4>
          <span className="text-xs text-gray-400 group-hover:text-gray-700 transition-colors">
            {showHistory ? "▲ Fechar" : "▼ Ver histórico"}
          </span>
        </button>

        {showHistory && (
          pdfSessions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-4 text-sm text-gray-400 text-center mt-2">
              Nenhum estudo registrado ainda.
            </div>
          ) : (
            <div className="space-y-2 mt-2">
              {pdfSessions.map(s => {
                const sAcc = accuracy(s.correct, s.questions);
                return (
                  <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <p className="text-xs font-bold text-gray-700">{fmtDate(s.createdAt)}</p>
                          {s.category && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                              {s.category}
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
                          <div>
                            <p className="text-xs text-gray-500">Horas</p>
                            <p className="font-bold text-sm">{s.hoursFormatted}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Questões</p>
                            <p className="font-bold text-sm">{s.questions}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Acertos</p>
                            <p className="font-bold text-sm text-green-600">{s.correct}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Erros</p>
                            <p className="font-bold text-sm text-red-600">{s.wrong}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Acurácia</p>
                            <p className={`font-bold text-sm ${sAcc >= 70 ? "text-green-600" : sAcc >= 50 ? "text-yellow-600" : sAcc > 0 ? "text-red-600" : "text-gray-400"}`}>
                              {s.questions > 0 ? `${sAcc}%` : "—"}
                            </p>
                          </div>
                        </div>
                        {s.comment && (
                          <p className="mt-2 text-xs text-gray-500 italic">💬 {s.comment}</p>
                        )}
                      </div>
                      <button
                        onClick={() => deleteSession(s.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0">
                        <Trash2 className="w-3.5 h-3.5"/>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function MateriasPage() {
  const [subjects, setSubjects]   = useState<Subject[]>([]);
  const [allSessions, setAllSessions] = useState<HistoricoSession[]>([]);
  const [expanded, setExpanded]   = useState<string | null>(null);
  const [name, setName]           = useState("");
  const [ew, setEw]               = useState("5");
  const [crit, setCrit]           = useState("5");
  const [topicName, setTopicName] = useState("");
  const [topicSubjectId, setTopicSubjectId] = useState("");
  const [pdfTitle, setPdfTitle]   = useState("");
  const [pdfTopicId, setPdfTopicId] = useState("");
  const [pdfPages, setPdfPages]   = useState("0");
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState("");
  const [recalculating, setRecalculating] = useState(false);
  const [recalcDone, setRecalcDone]       = useState(false);
  const [editingSubject, setEditingSubject] = useState<string | null>(null);
  const [editSubjectData, setEditSubjectData] = useState({ name: "", editalWeight: 5, criticality: 5 });
  const [editingTopic, setEditingTopic]     = useState<string | null>(null);
  const [editTopicName, setEditTopicName]   = useState("");

  const load = useCallback(() => {
    // Carrega matérias
    fetch("/api/subjects")
      .then(r => r.json())
      .then(d => setSubjects(Array.isArray(d) ? d : (d.subjects ?? [])))
      .catch(console.error);

    // Carrega TODAS as sessões do histórico (mesma fonte do Histórico)
    fetch("/api/historico")
      .then(r => r.json())
      .then((days: { sessions: HistoricoSession[] }[]) => {
        if (!Array.isArray(days)) return;
        const sessions = days.flatMap(d => d.sessions);
        setAllSessions(sessions);
      })
      .catch(console.error);
  }, []);

  // Carrega ao montar e toda vez que a aba volta ao foco (ex: usuário navegou de Sessão → Materiais)
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  const addSubject = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError("");
    const res = await fetch("/api/subjects", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, editalWeight: +ew, criticality: +crit }),
    });
    if (res.ok) { setName(""); load(); } else { const d = await res.json(); setError(d.message); }
    setSaving(false);
  };

  const saveSubject = async (id: string) => {
    setSaving(true);
    await fetch(`/api/subjects/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editSubjectData) });
    setEditingSubject(null); load(); setSaving(false);
  };

  const deleteSubject = async (id: string) => {
    if (!confirm("Excluir esta matéria?")) return;
    await fetch(`/api/subjects/${id}`, { method: "DELETE" }); load();
  };

  const addTopic = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    await fetch("/api/topics", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: topicName, subjectId: topicSubjectId }) });
    setTopicName(""); load(); setSaving(false);
  };

  const saveTopic = async (id: string) => {
    setSaving(true);
    await fetch(`/api/topics/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: editTopicName }) });
    setEditingTopic(null); load(); setSaving(false);
  };

  const deleteTopic = async (id: string) => {
    if (!confirm("Excluir este tópico?")) return;
    await fetch(`/api/topics/${id}`, { method: "DELETE" }); load();
  };

  const addPdf = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    await fetch("/api/pdfs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: pdfTitle, topicId: pdfTopicId, totalPages: +pdfPages }) });
    setPdfTitle(""); load(); setSaving(false);
  };

  const recalc = async () => {
    setRecalculating(true);
    await fetch("/api/recalc", { method: "POST" });
    setRecalcDone(true);
    load();
    setRecalculating(false);
    setTimeout(() => setRecalcDone(false), 3000);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="text-white px-8 py-8" style={{ backgroundColor: "#1B4040" }}>
        <h1 className="text-3xl font-bold">Matérias</h1>
        <p className="text-gray-400 text-sm mt-1">Cadastre disciplinas, tópicos e PDFs. O histórico é sincronizado com a Sessão de Estudos.</p>
      </div>
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* Nova matéria */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Nova matéria</h2>
          <form onSubmit={addSubject} className="space-y-4">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Direito Constitucional" required
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"/>
            <div className="grid grid-cols-2 gap-4">
              {[["Peso no edital (1-10)", ew, setEw], ["Criticidade (1-10)", crit, setCrit]].map(([l, v, s]: any) => (
                <div key={l}>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">{l}</label>
                  <input type="number" min="1" max="10" value={v} onChange={e => s(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"/>
                </div>
              ))}
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <div className="flex items-center justify-between">
              <button type="submit" disabled={saving}
                className="flex items-center gap-2 px-5 py-3 bg-gray-900 hover:bg-gray-700 text-white font-bold rounded-xl text-sm transition-colors disabled:opacity-50">
                <Plus className="w-4 h-4"/>Adicionar matéria
              </button>
              <button type="button" onClick={recalc} disabled={recalculating}
                className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-colors disabled:opacity-50 ${recalcDone ? "bg-green-700 text-white" : "bg-green-600 hover:bg-green-500 text-white"}`}>
                <RotateCcw className={`w-4 h-4 ${recalculating ? "animate-spin" : ""}`}/>
                {recalculating ? "Recalculando..." : recalcDone ? "✓ Corrigido!" : "Recalcular métricas"}
              </button>
            </div>
          </form>
        </div>

        {/* Lista de matérias */}
        <div className="space-y-4">
          {subjects.map(s => {
            // KPIs da matéria calculados das sessões
            // "sem PDF" = pdfTitle E topicName ambos vazios
            const subjectSessions = allSessions.filter(ss => ss.subjectId === s.id);
            const sessionsComPdf  = subjectSessions.filter(ss => ss.pdfTitle.trim() !== "" || ss.topicName.trim() !== "");
            const sessionsSemPdf  = subjectSessions.filter(ss => ss.pdfTitle.trim() === "" && ss.topicName.trim() === "");

            const horasComPdf  = sessionsComPdf.reduce((a, ss) => a + ss.hours, 0);
            const horasSemPdf  = sessionsSemPdf.reduce((a, ss) => a + ss.hours, 0);
            const totalHoras   = horasComPdf + horasSemPdf;

            const totalQ = subjectSessions.reduce((a, ss) => a + ss.questions, 0);
            const totalC = subjectSessions.reduce((a, ss) => a + ss.correct, 0);
            const totalW = subjectSessions.reduce((a, ss) => a + ss.wrong, 0);
            const acc    = accuracy(totalC, totalQ);

            return (
              <div key={s.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                {editingSubject === s.id ? (
                  <div className="flex items-center gap-3 px-6 py-4 bg-blue-50 border-b border-blue-100">
                    <input value={editSubjectData.name} onChange={e => setEditSubjectData(d => ({ ...d, name: e.target.value }))}
                      className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"/>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 shrink-0">
                      <span>Peso</span>
                      <input type="number" min="1" max="10" value={editSubjectData.editalWeight}
                        onChange={e => setEditSubjectData(d => ({ ...d, editalWeight: +e.target.value }))}
                        className="w-14 border border-gray-300 rounded-lg px-2 py-2 text-sm text-center"/>
                      <span>Crit</span>
                      <input type="number" min="1" max="10" value={editSubjectData.criticality}
                        onChange={e => setEditSubjectData(d => ({ ...d, criticality: +e.target.value }))}
                        className="w-14 border border-gray-300 rounded-lg px-2 py-2 text-sm text-center"/>
                    </div>
                    <button onClick={() => saveSubject(s.id)} className="p-2 text-green-600 hover:bg-green-50 rounded-lg"><Check className="w-4 h-4"/></button>
                    <button onClick={() => setEditingSubject(null)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4"/></button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors">
                    <button onClick={() => setExpanded(expanded === s.id ? null : s.id)} className="flex items-center gap-3 flex-1 text-left">
                      <BookOpen className="w-5 h-5 text-gray-400 shrink-0"/>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-gray-900">{s.name}</p>
                          {s.totalPdfs > 0 && (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.completedPdfs === s.totalPdfs ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                              {s.completedPdfs}/{s.totalPdfs} PDFs
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                          <p className="text-xs text-gray-500">{totalHoras.toFixed(1)}h estudadas</p>
                          <p className="text-xs text-gray-500">{totalQ} questões</p>
                          {totalQ > 0 && (
                            <p className={`text-xs font-medium ${acc >= 70 ? "text-green-600" : acc >= 50 ? "text-yellow-600" : "text-red-600"}`}>
                              {acc}% acerto
                            </p>
                          )}
                          <p className="text-xs text-gray-400">Peso: {s.editalWeight}/10 · Crit: {s.criticality}/10</p>
                        </div>
                        {s.totalPdfs > 0 && (
                          <div className="mt-1.5 h-1 bg-gray-100 rounded-full overflow-hidden w-48">
                            <div className="h-full bg-gray-900 rounded-full" style={{ width: `${s.progress}%` }}/>
                          </div>
                        )}
                      </div>
                    </button>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => { setEditingSubject(s.id); setEditSubjectData({ name: s.name, editalWeight: s.editalWeight, criticality: s.criticality }); setExpanded(s.id); }}
                        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"><Pencil className="w-3.5 h-3.5"/></button>
                      <button onClick={() => deleteSubject(s.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5"/></button>
                      <button onClick={() => setExpanded(expanded === s.id ? null : s.id)} className="p-1.5 text-gray-400">
                        {expanded === s.id ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
                      </button>
                    </div>
                  </div>
                )}

                {expanded === s.id && (
                  <div className="border-t border-gray-100 px-6 py-5 space-y-5 bg-gray-50">

                    {/* Sessões sem PDF vinculado */}
                    {sessionsSemPdf.length > 0 && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                        <p className="text-xs font-bold text-amber-700 mb-2 uppercase tracking-wide">
                          Sessões sem PDF vinculado ({sessionsSemPdf.length})
                        </p>
                        <div className="space-y-2">
                          {sessionsSemPdf.map(ss => (
                            <div key={ss.id} className="flex items-center justify-between text-xs text-amber-800 bg-white rounded-lg px-3 py-2 border border-amber-100">
                              <span>{fmtDate(ss.createdAt)} · {ss.hoursFormatted} · {ss.category}</span>
                              <span className="text-gray-500">{ss.questions > 0 ? `${ss.correct}✓ ${ss.wrong}✗` : "Sem questões"}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Novo tópico */}
                    <form onSubmit={e => { setTopicSubjectId(s.id); addTopic(e); }} className="flex gap-2">
                      <input
                        value={topicSubjectId === s.id ? topicName : ""}
                        onChange={e => { setTopicSubjectId(s.id); setTopicName(e.target.value); }}
                        placeholder="Novo tópico" required
                        className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"/>
                      <button type="submit" disabled={saving}
                        className="px-4 py-2.5 bg-gray-800 text-white rounded-xl text-sm font-bold disabled:opacity-50">
                        + Tópico
                      </button>
                    </form>

                    {s.topics.map(t => (
                      <div key={t.id} className="bg-white rounded-2xl border border-gray-200 p-5">
                        {/* Header tópico */}
                        <div className="flex items-center gap-3 mb-4">
                          {editingTopic === t.id ? (
                            <div className="flex items-center gap-2 flex-1">
                              <input value={editTopicName} onChange={e => setEditTopicName(e.target.value)}
                                className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-gray-900"/>
                              <button onClick={() => saveTopic(t.id)} className="px-4 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-bold">Salvar</button>
                              <button onClick={() => setEditingTopic(null)} className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm">Cancelar</button>
                            </div>
                          ) : (
                            <>
                              <p className="font-bold text-gray-900 flex-1">{t.name}</p>
                              <button onClick={() => { setEditingTopic(t.id); setEditTopicName(t.name); }}
                                className="px-3 py-2 bg-gray-900 text-white rounded-xl text-xs font-bold">Editar tópico</button>
                              <button onClick={() => deleteTopic(t.id)}
                                className="px-3 py-2 bg-red-600 text-white rounded-xl text-xs font-bold">Excluir tópico</button>
                            </>
                          )}
                        </div>

                        {/* Adicionar PDF */}
                        <form onSubmit={addPdf} className="flex gap-2 flex-wrap items-end mb-4">
                          <div className="flex-1">
                            <input
                              value={pdfTopicId === t.id ? pdfTitle : ""}
                              onChange={e => { setPdfTopicId(t.id); setPdfTitle(e.target.value); }}
                              onClick={() => setPdfTopicId(t.id)}
                              placeholder="Ex: Aula 00" required
                              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"/>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Qtde Páginas</label>
                            <input type="number" min="0"
                              value={pdfTopicId === t.id ? pdfPages : "0"}
                              onChange={e => { setPdfTopicId(t.id); setPdfPages(e.target.value); }}
                              onClick={() => setPdfTopicId(t.id)}
                              className="w-28 border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"/>
                          </div>
                          <button type="submit" disabled={saving || pdfTopicId !== t.id}
                            className="px-4 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-bold disabled:opacity-50">
                            + PDF
                          </button>
                        </form>

                        {/* PDFs */}
                        <div className="space-y-4">
                          {t.pdfs.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-gray-200 p-4 text-sm text-gray-400 text-center">
                              Nenhum PDF cadastrado neste tópico.
                            </div>
                          ) : (
                            t.pdfs.map(p => (
                              <PdfCard
                                key={p.id}
                                pdf={p}
                                subjectId={s.id}
                                onReload={load}
                                allSessions={allSessions}
                              />
                            ))
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {subjects.length === 0 && (
            <div className="text-center py-12 text-gray-400">Nenhuma matéria cadastrada ainda.</div>
          )}
        </div>
      </div>
    </div>
  );
}
