"use client";
import Link from "next/link";
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
function PdfRow({
  pdf, subjectId, onReload, allSessions,
}: {
  pdf: Pdf;
  subjectId: string;
  onReload: () => void;
  allSessions: HistoricoSession[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(pdf.title);
  const [editTotalPages, setEditTotalPages] = useState(pdf.totalPages);
  const [editLastPage, setEditLastPage] = useState(pdf.lastPageStudied);
  const [savingPdf, setSavingPdf] = useState(false);

  const normalize = (str: string) => str.trim().toLowerCase();
  const pdfNorm   = normalize(pdf.title);

  const pdfSessions = allSessions.filter(s => {
    if (s.subjectId !== subjectId) return false;
    const titleNorm = normalize(s.pdfTitle);
    const topicNorm = normalize(s.topicName);
    if (titleNorm) return titleNorm === pdfNorm;
    if (topicNorm) return topicNorm === pdfNorm;
    return false;
  });

  const totalHours     = pdfSessions.reduce((a, s) => a + s.hours, 0);
  const totalQuestions = pdfSessions.reduce((a, s) => a + s.questions, 0);
  const totalCorrect   = pdfSessions.reduce((a, s) => a + s.correct, 0);
  const totalWrong     = pdfSessions.reduce((a, s) => a + s.wrong, 0);
  const totalAcc       = accuracy(totalCorrect, totalQuestions);

  const pct = pdf.totalPages > 0 ? Math.min(100, Math.round((pdf.lastPageStudied / pdf.totalPages) * 100)) : 0;

  const statusIcon = pdf.completed ? "✅" : pdf.lastPageStudied > 0 ? "🔵" : "⭕";

  const savePdf = async () => {
    setSavingPdf(true);
    const shouldFinish = editTotalPages > 0 && editLastPage >= editTotalPages;
    await fetch(`/api/pdfs/${pdf.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editTitle,
        totalPages: editTotalPages,
        lastPageStudied: editLastPage,
        completed: shouldFinish,
      }),
    });
    setEditing(false);
    onReload();
    setSavingPdf(false);
  };

  const deletePdf = async () => {
    if (!confirm("Excluir este PDF e todo o seu histórico?")) return;
    await fetch(`/api/pdfs/${pdf.id}`, { method: "DELETE" });
    onReload();
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Linha principal — clicável */}
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-gray-50 transition-colors ${expanded ? "bg-gray-50" : ""}`}>
        <span className="text-base shrink-0 w-[18px] text-center">{statusIcon}</span>
        <p className="font-semibold text-sm text-gray-900 truncate" style={{ minWidth: 100, maxWidth: 140 }}>{pdf.title}</p>
        <div className="flex items-center gap-2 flex-1 min-w-[110px]">
          {pdf.totalPages > 0 ? (
            <>
              <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: pct >= 100 ? "#16a34a" : "#2563eb" }} />
              </div>
              <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">{pdf.lastPageStudied}/{pdf.totalPages}</span>
            </>
          ) : (
            <span className="text-xs text-gray-300">sem páginas</span>
          )}
        </div>
        <span className="text-xs text-gray-500 w-12 text-right shrink-0">{totalHours > 0 ? fmtHours(totalHours) : "—"}</span>
        <span className="text-xs text-gray-500 w-9 text-right shrink-0">{totalQuestions > 0 ? totalQuestions : "—"}</span>
        <span className="text-xs text-green-600 font-medium w-9 text-right shrink-0">{totalCorrect > 0 ? totalCorrect : "—"}</span>
        <span className="text-xs text-red-500 font-medium w-9 text-right shrink-0">{totalWrong > 0 ? totalWrong : "—"}</span>
        <span className={`text-xs font-bold w-10 text-right shrink-0 ${totalAcc >= 70 ? "text-green-600" : totalAcc >= 50 ? "text-yellow-600" : totalAcc > 0 ? "text-red-600" : "text-gray-300"}`}>
          {totalQuestions > 0 ? `${totalAcc}%` : "—"}
        </span>
        <span className="shrink-0 w-6 text-center text-gray-300">{expanded ? "▲" : "▼"}</span>
      </button>

      {/* Detalhes expandidos */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-4 pl-11 bg-gray-50/60">

          {editing ? (
            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-3">
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wide mb-3">✏️ Editar dados da aula</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="block text-[10px] text-gray-400 mb-1">Título</label>
                  <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-gray-900"/>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 mb-1">Total de páginas</label>
                  <input type="number" min="0" value={editTotalPages} onChange={e => setEditTotalPages(+e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-gray-900"/>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 mb-1">Página lida até</label>
                  <input type="number" min="0" value={editLastPage} onChange={e => setEditLastPage(+e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-bold text-blue-600 focus:outline-none focus:ring-1 focus:ring-gray-900"/>
                </div>
              </div>
              <p className="text-[10px] text-gray-400 mb-3">
                Tempo, questões, acertos e erros são calculados a partir das sessões no Histórico — edite-os por lá.
              </p>
              <div className="flex gap-2">
                <button onClick={savePdf} disabled={savingPdf}
                  className="px-4 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-bold disabled:opacity-50">
                  {savingPdf ? "Salvando..." : "Salvar alterações"}
                </button>
                <button onClick={() => setEditing(false)} className="px-4 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs">
                  Cancelar
                </button>
                <button onClick={deletePdf} className="px-4 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold ml-auto">
                  <Trash2 className="w-3 h-3 inline mr-1"/>Excluir aula
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2 mb-3">
              <button onClick={() => { setEditing(true); setEditTitle(pdf.title); setEditTotalPages(pdf.totalPages); setEditLastPage(pdf.lastPageStudied); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors">
                <Pencil className="w-3 h-3"/>Editar
              </button>
              <button
                onClick={() => fetch(`/api/pdfs/${pdf.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ completed: !pdf.completed }) }).then(() => onReload())}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-50 transition-colors">
                <RotateCcw className="w-3 h-3"/>{pdf.completed ? "Desmarcar concluído" : "Marcar concluído"}
              </button>
            </div>
          )}

          {/* Histórico de Estudos */}
          <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2">
            Histórico de estudos {pdfSessions.length > 0 && <span className="text-gray-400 font-normal">({pdfSessions.length})</span>}
          </p>
          {pdfSessions.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-3 border border-dashed border-gray-200 rounded-lg bg-white">
              Nenhum estudo registrado ainda.
            </p>
          ) : (
            <div className="space-y-1.5">
              {pdfSessions.map(s => {
                const sAcc = accuracy(s.correct, s.questions);
                return (
                  <div key={s.id} className="flex items-center gap-3 text-xs bg-white rounded-lg px-3 py-2 border border-gray-100">
                    <span className="text-gray-500 w-14 shrink-0">{fmtDate(s.createdAt)}</span>
                    {s.category && <span className="px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px] shrink-0">{s.category}</span>}
                    <span className="flex-1 text-gray-400 truncate">{s.comment || ""}</span>
                    <span className="text-gray-500 shrink-0">{s.hoursFormatted}</span>
                    <span className="text-green-600 font-medium shrink-0 w-8 text-right">{s.correct > 0 ? `${s.correct}✓` : ""}</span>
                    <span className="text-red-500 font-medium shrink-0 w-8 text-right">{s.wrong > 0 ? `${s.wrong}✗` : ""}</span>
                    <span className={`font-bold shrink-0 w-10 text-right ${sAcc >= 70 ? "text-green-600" : sAcc >= 50 ? "text-yellow-600" : sAcc > 0 ? "text-red-600" : "text-gray-300"}`}>
                      {s.questions > 0 ? `${sAcc}%` : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Matérias</h1>
            <p className="text-gray-400 text-sm mt-1">Cadastre disciplinas, tópicos e PDFs. O histórico é sincronizado com a Sessão de Estudos.</p>
          </div>
          <Link href="/importar"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
            style={{ backgroundColor: "rgba(255,255,255,0.15)", color: "#fff" }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Importar planilha
          </Link>
        </div>
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
                        <div>
                          {t.pdfs.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-gray-200 p-4 text-sm text-gray-400 text-center">
                              Nenhum PDF cadastrado neste tópico.
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {/* Cabeçalho das colunas */}
                              <div className="flex items-center gap-2.5 px-4 text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                                <span className="shrink-0 w-[18px]"></span>
                                <span style={{ minWidth: 100, maxWidth: 140 }}>Aula</span>
                                <span className="flex-1 min-w-[110px]">Progresso</span>
                                <span className="w-12 text-right shrink-0">Tempo</span>
                                <span className="w-9 text-right shrink-0">Quest.</span>
                                <span className="w-9 text-right shrink-0">Acert.</span>
                                <span className="w-9 text-right shrink-0">Erros</span>
                                <span className="w-10 text-right shrink-0">Acur.</span>
                                <span className="shrink-0 w-6"></span>
                              </div>
                              {t.pdfs.map(p => (
                                <PdfRow
                                  key={p.id}
                                  pdf={p}
                                  subjectId={s.id}
                                  onReload={load}
                                  allSessions={allSessions}
                                />
                              ))}
                            </div>
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
