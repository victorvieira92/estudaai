"use client";
import { useState, useEffect } from "react";
import { Plus, ChevronDown, ChevronUp, BookOpen, Trash2, Pencil, Check, X, Clock, FileText, TrendingUp, RotateCcw } from "lucide-react";

interface Pdf {
  id: string; title: string; completed: boolean;
  totalPages: number; lastPageStudied: number; studyHours: number;
  questions: number; correctQuestions: number;
}
interface Topic { id: string; name: string; pdfs: Pdf[]; }
interface Subject {
  id: string; name: string; editalWeight: number; criticality: number;
  studyHours: number; totalQuestions: number; correctQuestions: number;
  completedPdfs: number; totalPdfs: number; progress: number;
  topics: Topic[];
}

export default function MateriasPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [name, setName] = useState(""); const [ew, setEw] = useState("5"); const [crit, setCrit] = useState("5");
  const [topicName, setTopicName] = useState(""); const [topicSubjectId, setTopicSubjectId] = useState("");
  const [pdfTitle, setPdfTitle] = useState(""); const [pdfTopicId, setPdfTopicId] = useState(""); const [pdfPages, setPdfPages] = useState("0");
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  const [editingSubject, setEditingSubject] = useState<string | null>(null);
  const [editSubjectData, setEditSubjectData] = useState({ name: "", editalWeight: 5, criticality: 5 });
  const [editingTopic, setEditingTopic] = useState<string | null>(null);
  const [editTopicName, setEditTopicName] = useState("");
  const [editingPdf, setEditingPdf] = useState<string | null>(null);
  const [editPdfData, setEditPdfData] = useState({
    title: "", totalPages: 0, lastPageStudied: 0,
    studyHours: 0, questions: 0, correctQuestions: 0, completed: false,
  });

  const load = () => fetch("/api/subjects").then(r => r.json()).then(d => setSubjects(Array.isArray(d) ? d : (d.subjects ?? []))).catch(console.error);
  useEffect(() => { load(); }, []);

  const addSubject = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError("");
    const res = await fetch("/api/subjects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, editalWeight: +ew, criticality: +crit }) });
    if (res.ok) { setName(""); load(); } else { const d = await res.json(); setError(d.message); }
    setSaving(false);
  };
  const saveSubject = async (id: string) => {
    setSaving(true);
    await fetch(`/api/subjects/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editSubjectData) });
    setEditingSubject(null); load(); setSaving(false);
  };
  const deleteSubject = async (id: string) => {
    if (!confirm("Excluir esta matéria e todos os seus tópicos e PDFs?")) return;
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
    if (!confirm("Excluir este tópico e todos os seus PDFs?")) return;
    await fetch(`/api/topics/${id}`, { method: "DELETE" }); load();
  };
  const addPdf = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    await fetch("/api/pdfs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: pdfTitle, topicId: pdfTopicId, totalPages: +pdfPages }) });
    setPdfTitle(""); load(); setSaving(false);
  };
  const savePdf = async (id: string) => {
    setSaving(true);
    await fetch(`/api/pdfs/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editPdfData) });
    setEditingPdf(null); load(); setSaving(false);
  };
  const deletePdf = async (id: string) => {
    if (!confirm("Excluir este PDF?")) return;
    await fetch(`/api/pdfs/${id}`, { method: "DELETE" }); load();
  };
  const toggleCompleted = async (pdf: Pdf) => {
    await fetch(`/api/pdfs/${pdf.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ completed: !pdf.completed }) });
    load();
  };

  function PdfProgress({ pdf }: { pdf: Pdf }) {
    const pct = pdf.totalPages > 0 ? Math.min(100, Math.round((pdf.lastPageStudied / pdf.totalPages) * 100)) : 0;
    const accuracy = pdf.questions > 0 ? Math.round((pdf.correctQuestions / pdf.questions) * 100) : null;
    const status = pdf.completed ? "concluido" : pdf.lastPageStudied > 0 ? "andamento" : "nao_iniciado";
    const isEditing = editingPdf === pdf.id;

    return (
      <div className={`rounded-xl border p-3 ${pdf.completed ? "bg-green-50 border-green-200" : pdf.lastPageStudied > 0 ? "bg-blue-50 border-blue-200" : "bg-gray-50 border-gray-200"}`}>
        {/* Header do PDF */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-base shrink-0">
              {status === "concluido" ? "✅" : status === "andamento" ? "🔵" : "⭕"}
            </span>
            <p className="text-sm font-medium text-gray-900 truncate">{pdf.title}</p>
          </div>
          {!isEditing && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => { setEditingPdf(pdf.id); setEditPdfData({ title: pdf.title, totalPages: pdf.totalPages, lastPageStudied: pdf.lastPageStudied, studyHours: pdf.studyHours, questions: pdf.questions, correctQuestions: pdf.correctQuestions, completed: pdf.completed }); }}
                className="p-1 text-gray-400 hover:text-gray-700 hover:bg-white rounded transition-colors" title="Editar">
                <Pencil className="w-3 h-3"/>
              </button>
              <button onClick={() => toggleCompleted(pdf)}
                className={`p-1 rounded transition-colors hover:bg-white ${pdf.completed ? "text-yellow-500 hover:text-yellow-700" : "text-gray-400 hover:text-green-600"}`}
                title={pdf.completed ? "Desmarcar concluído" : "Marcar como concluído"}>
                <RotateCcw className="w-3 h-3"/>
              </button>
              <button onClick={() => deletePdf(pdf.id)} className="p-1 text-gray-400 hover:text-red-500 hover:bg-white rounded transition-colors" title="Excluir">
                <Trash2 className="w-3 h-3"/>
              </button>
            </div>
          )}
        </div>

        {/* Barra de progresso */}
        {!isEditing && pdf.totalPages > 0 && (
          <div className="mt-2">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Página {pdf.lastPageStudied} de {pdf.totalPages}</span>
              <span>{pct}%</span>
            </div>
            <div className="h-1.5 bg-white rounded-full overflow-hidden border border-gray-200">
              <div className={`h-full rounded-full transition-all ${pdf.completed ? "bg-green-500" : "bg-blue-500"}`} style={{ width: `${pct}%` }}/>
            </div>
          </div>
        )}

        {/* Stats */}
        {!isEditing && (pdf.studyHours > 0 || pdf.questions > 0) && (
          <div className="flex items-center gap-3 mt-2">
            {pdf.studyHours > 0 && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Clock className="w-3 h-3"/>{pdf.studyHours.toFixed(1)}h
              </span>
            )}
            {pdf.questions > 0 && (
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <FileText className="w-3 h-3"/>{pdf.questions} questões
              </span>
            )}
            {accuracy !== null && (
              <span className={`flex items-center gap-1 text-xs font-medium ${accuracy >= 70 ? "text-green-600" : accuracy >= 50 ? "text-yellow-600" : "text-red-600"}`}>
                <TrendingUp className="w-3 h-3"/>{accuracy}% acerto
              </span>
            )}
          </div>
        )}

        {/* Formulário de edição completo */}
        {isEditing && (
          <div className="mt-3 space-y-3 bg-white rounded-lg p-3 border border-gray-200">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Título</label>
              <input value={editPdfData.title} onChange={e => setEditPdfData(d => ({ ...d, title: e.target.value }))}
                className="w-full mt-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"/>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total de páginas</label>
                <input type="number" min="0" value={editPdfData.totalPages} onChange={e => setEditPdfData(d => ({ ...d, totalPages: +e.target.value }))}
                  className="w-full mt-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"/>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Última página lida</label>
                <input type="number" min="0" value={editPdfData.lastPageStudied} onChange={e => setEditPdfData(d => ({ ...d, lastPageStudied: +e.target.value }))}
                  className="w-full mt-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"/>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Horas estudadas</label>
                <input type="number" min="0" step="0.1" value={editPdfData.studyHours} onChange={e => setEditPdfData(d => ({ ...d, studyHours: +e.target.value }))}
                  className="w-full mt-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"/>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Questões feitas</label>
                <input type="number" min="0" value={editPdfData.questions} onChange={e => setEditPdfData(d => ({ ...d, questions: +e.target.value }))}
                  className="w-full mt-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"/>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Acertos</label>
                <input type="number" min="0" value={editPdfData.correctQuestions} onChange={e => setEditPdfData(d => ({ ...d, correctQuestions: +e.target.value }))}
                  className="w-full mt-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"/>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer mt-1">
                  <input type="checkbox" checked={editPdfData.completed} onChange={e => setEditPdfData(d => ({ ...d, completed: e.target.checked }))}
                    className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"/>
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Concluído</span>
                </label>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => savePdf(pdf.id)} disabled={saving}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 hover:bg-gray-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50">
                <Check className="w-3.5 h-3.5"/> Salvar
              </button>
              <button onClick={() => setEditingPdf(null)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium transition-colors">
                <X className="w-3.5 h-3.5"/> Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gray-950 text-white px-8 py-8">
        <h1 className="text-3xl font-bold">Matérias</h1>
        <p className="text-gray-400 text-sm mt-1">Cadastre disciplinas, tópicos e PDFs do edital.</p>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Nova matéria</h2>
          <form onSubmit={addSubject} className="space-y-4">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Direito Constitucional" required
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"/>
            <div className="grid grid-cols-2 gap-4">
              {[["Peso no edital (1-10)", ew, setEw], ["Criticidade (1-10)", crit, setCrit]].map(([l, v, s]: any) => (
                <div key={l}>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">{l}</label>
                  <input type="number" min="1" max="10" value={v} onChange={e => s(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"/>
                </div>
              ))}
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 hover:bg-gray-700 text-white font-semibold rounded-xl text-sm transition-colors disabled:opacity-50">
              <Plus className="w-4 h-4"/>Adicionar matéria
            </button>
          </form>
        </div>

        <div className="space-y-3">
          {subjects.map(s => {
            const accuracy = s.totalQuestions > 0 ? Math.round((s.correctQuestions / s.totalQuestions) * 100) : null;
            return (
              <div key={s.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                {editingSubject === s.id ? (
                  <div className="flex items-center gap-3 px-6 py-4 bg-blue-50 border-b border-blue-100">
                    <input value={editSubjectData.name} onChange={e => setEditSubjectData(d => ({ ...d, name: e.target.value }))}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"/>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 shrink-0">
                      <span>Peso</span>
                      <input type="number" min="1" max="10" value={editSubjectData.editalWeight}
                        onChange={e => setEditSubjectData(d => ({ ...d, editalWeight: +e.target.value }))}
                        className="w-14 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-gray-900"/>
                      <span>Crit</span>
                      <input type="number" min="1" max="10" value={editSubjectData.criticality}
                        onChange={e => setEditSubjectData(d => ({ ...d, criticality: +e.target.value }))}
                        className="w-14 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-gray-900"/>
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
                          <p className="font-semibold text-gray-900">{s.name}</p>
                          {s.totalPdfs > 0 && (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.completedPdfs === s.totalPdfs ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>
                              {s.completedPdfs}/{s.totalPdfs} PDFs
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <p className="text-xs text-gray-500">{s.studyHours.toFixed(1)}h estudadas</p>
                          {accuracy !== null && <p className={`text-xs font-medium ${accuracy >= 70 ? "text-green-600" : accuracy >= 50 ? "text-yellow-600" : "text-red-600"}`}>{accuracy}% acerto</p>}
                          <p className="text-xs text-gray-400">Peso: {s.editalWeight}/10 · Crit: {s.criticality}/10</p>
                        </div>
                        {s.totalPdfs > 0 && (
                          <div className="mt-1.5 h-1 bg-gray-100 rounded-full overflow-hidden w-48">
                            <div className="h-full bg-gray-900 rounded-full transition-all" style={{ width: `${s.progress}%` }}/>
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
                  <div className="border-t border-gray-100 px-6 py-4 space-y-4 bg-gray-50">
                    {s.topics.map(t => (
                      <div key={t.id} className="bg-white rounded-xl border border-gray-200 p-4">
                        <div className="flex items-center justify-between mb-3">
                          {editingTopic === t.id ? (
                            <div className="flex items-center gap-2 flex-1">
                              <input value={editTopicName} onChange={e => setEditTopicName(e.target.value)}
                                className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"/>
                              <button onClick={() => saveTopic(t.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"><Check className="w-4 h-4"/></button>
                              <button onClick={() => setEditingTopic(null)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4"/></button>
                            </div>
                          ) : (
                            <>
                              <p className="font-medium text-sm text-gray-800">{t.name}</p>
                              <div className="flex items-center gap-1">
                                <button onClick={() => { setEditingTopic(t.id); setEditTopicName(t.name); }}
                                  className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"><Pencil className="w-3 h-3"/></button>
                                <button onClick={() => deleteTopic(t.id)}
                                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-3 h-3"/></button>
                              </div>
                            </>
                          )}
                        </div>
                        <div className="space-y-2">
                          {t.pdfs.map(p => <PdfProgress key={p.id} pdf={p}/>)}
                        </div>
                      </div>
                    ))}

                    <form onSubmit={e => { setTopicSubjectId(s.id); addTopic(e); }} className="flex gap-2">
                      <input value={topicSubjectId === s.id ? topicName : ""} onChange={e => { setTopicSubjectId(s.id); setTopicName(e.target.value); }}
                        placeholder="Novo tópico" required
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"/>
                      <button type="submit" disabled={saving} className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium disabled:opacity-50">+ Tópico</button>
                    </form>

                    {s.topics.length > 0 && (
                      <form onSubmit={addPdf} className="flex gap-2 flex-wrap">
                        <select value={pdfTopicId} onChange={e => setPdfTopicId(e.target.value)} required
                          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                          <option value="">Tópico</option>
                          {s.topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                        <input value={pdfTitle} onChange={e => setPdfTitle(e.target.value)} placeholder="Título do PDF" required
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"/>
                        <input type="number" value={pdfPages} onChange={e => setPdfPages(e.target.value)} placeholder="Páginas" min="0"
                          className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"/>
                        <button type="submit" disabled={saving} className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium disabled:opacity-50">+ PDF</button>
                      </form>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {subjects.length === 0 && <div className="text-center py-12 text-gray-400">Nenhuma matéria cadastrada ainda.</div>}
        </div>
      </div>
    </div>
  );
}
