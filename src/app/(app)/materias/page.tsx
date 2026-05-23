"use client";
import { useState, useEffect } from "react";
import { Plus, ChevronDown, ChevronUp, BookOpen, Trash2, Pencil, Check, X } from "lucide-react";

interface Pdf { id: string; title: string; completed: boolean; totalPages: number; }
interface Topic { id: string; name: string; pdfs: Pdf[]; }
interface Subject { id: string; name: string; editalWeight: number; criticality: number; studyHours: number; totalQuestions: number; correctQuestions: number; topics: Topic[]; }

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
  const [editPdfData, setEditPdfData] = useState({ title: "", totalPages: 0 });

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
    await fetch(`/api/subjects/${id}`, { method: "DELETE" });
    load();
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
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Direito Constitucional" required className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"/>
            <div className="grid grid-cols-2 gap-4">
              {[["Peso no edital (1-10)", ew, setEw], ["Criticidade (1-10)", crit, setCrit]].map(([l, v, s]: any) => (
                <div key={l}>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">{l}</label>
                  <input type="number" min="1" max="10" value={v} onChange={e => s(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"/>
                </div>
              ))}
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 hover:bg-gray-700 text-white font-semibold rounded-xl text-sm transition-colors disabled:opacity-50">
              <Plus className="w-4 h-4"/>Adicionar matéria
            </button>
          </form>
        </div>

        <div className="space-y-3">
          {subjects.map(s => (
            <div key={s.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              {editingSubject === s.id ? (
                <div className="flex items-center gap-3 px-6 py-4 bg-blue-50 border-b border-blue-100">
                  <input value={editSubjectData.name} onChange={e => setEditSubjectData(d => ({ ...d, name: e.target.value }))} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"/>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <span>Peso</span>
                    <input type="number" min="1" max="10" value={editSubjectData.editalWeight} onChange={e => setEditSubjectData(d => ({ ...d, editalWeight: +e.target.value }))} className="w-14 border border-gray-300 rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-gray-900"/>
                    <span>Crit</span>
                    <input type="number" min="1" max="10" value={editSubjectData.criticality} onChange={e => setEditSubjectData(d => ({ ...d, criticality: +e.target.value }))} className="w-14 border border-gray-300 rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-gray-900"/>
                  </div>
                  <button onClick={() => saveSubject(s.id)} className="p-2 text-green-600 hover:bg-green-50 rounded-lg"><Check className="w-4 h-4"/></button>
                  <button onClick={() => setEditingSubject(null)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4"/></button>
                </div>
              ) : (
                <div className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors">
                  <button onClick={() => setExpanded(expanded === s.id ? null : s.id)} className="flex items-center gap-3 flex-1 text-left">
                    <BookOpen className="w-5 h-5 text-gray-400"/>
                    <div>
                      <p className="font-semibold text-gray-900">{s.name}</p>
                      <p className="text-xs text-gray-500">{s.topics.length} tópico(s) • {s.studyHours.toFixed(1)}h estudadas • {s.totalQuestions} questões</p>
                    </div>
                  </button>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-500 mr-3">Peso: {s.editalWeight}/10 • Crit: {s.criticality}/10</span>
                    <button onClick={() => { setEditingSubject(s.id); setEditSubjectData({ name: s.name, editalWeight: s.editalWeight, criticality: s.criticality }); setExpanded(s.id); }} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"><Pencil className="w-3.5 h-3.5"/></button>
                    <button onClick={() => deleteSubject(s.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-3.5 h-3.5"/></button>
                    <button onClick={() => setExpanded(expanded === s.id ? null : s.id)} className="p-1.5 text-gray-400">{expanded === s.id ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}</button>
                  </div>
                </div>
              )}

              {expanded === s.id && (
                <div className="border-t border-gray-100 px-6 py-4 space-y-4 bg-gray-50">
                  {s.topics.map(t => (
                    <div key={t.id} className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="flex items-center justify-between mb-2">
                        {editingTopic === t.id ? (
                          <div className="flex items-center gap-2 flex-1">
                            <input value={editTopicName} onChange={e => setEditTopicName(e.target.value)} className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"/>
                            <button onClick={() => saveTopic(t.id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg"><Check className="w-4 h-4"/></button>
                            <button onClick={() => setEditingTopic(null)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"><X className="w-4 h-4"/></button>
                          </div>
                        ) : (
                          <>
                            <p className="font-medium text-sm">{t.name}</p>
                            <div className="flex items-center gap-1">
                              <button onClick={() => { setEditingTopic(t.id); setEditTopicName(t.name); }} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"><Pencil className="w-3 h-3"/></button>
                              <button onClick={() => deleteTopic(t.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-3 h-3"/></button>
                            </div>
                          </>
                        )}
                      </div>
                      <div className="space-y-1.5 pl-2">
                        {t.pdfs.map(p => (
                          <div key={p.id} className="flex items-center gap-2">
                            {editingPdf === p.id ? (
                              <div className="flex items-center gap-2 flex-1">
                                <input value={editPdfData.title} onChange={e => setEditPdfData(d => ({ ...d, title: e.target.value }))} className="flex-1 border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-gray-900"/>
                                <input type="number" value={editPdfData.totalPages} onChange={e => setEditPdfData(d => ({ ...d, totalPages: +e.target.value }))} className="w-16 border border-gray-300 rounded-lg px-2 py-1 text-xs text-center focus:outline-none focus:ring-2 focus:ring-gray-900"/>
                                <button onClick={() => savePdf(p.id)} className="p-1 text-green-600 hover:bg-green-50 rounded"><Check className="w-3.5 h-3.5"/></button>
                                <button onClick={() => setEditingPdf(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded"><X className="w-3.5 h-3.5"/></button>
                              </div>
                            ) : (
                              <>
                                <span className={`w-2 h-2 rounded-full shrink-0 ${p.completed ? "bg-green-500" : "bg-gray-300"}`}/>
                                <span className="text-xs text-gray-600 flex-1">{p.title} {p.totalPages > 0 && `(${p.totalPages}p)`} {p.completed && "✓"}</span>
                                <button onClick={() => { setEditingPdf(p.id); setEditPdfData({ title: p.title, totalPages: p.totalPages }); }} className="p-1 text-gray-300 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"><Pencil className="w-3 h-3"/></button>
                                <button onClick={() => deletePdf(p.id)} className="p-1 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"><Trash2 className="w-3 h-3"/></button>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  <form onSubmit={e => { setTopicSubjectId(s.id); addTopic(e); }} className="flex gap-2">
                    <input value={topicSubjectId === s.id ? topicName : ""} onChange={e => { setTopicSubjectId(s.id); setTopicName(e.target.value); }} placeholder="Novo tópico (ex: CPC 00)" required className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"/>
                    <button type="submit" disabled={saving} className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium disabled:opacity-50">+ Tópico</button>
                  </form>

                  {s.topics.length > 0 && (
                    <form onSubmit={addPdf} className="flex gap-2 flex-wrap">
                      <select value={pdfTopicId} onChange={e => setPdfTopicId(e.target.value)} required className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                        <option value="">Tópico</option>
                        {s.topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                      <input value={pdfTitle} onChange={e => setPdfTitle(e.target.value)} placeholder="Título do PDF" required className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"/>
                      <input type="number" value={pdfPages} onChange={e => setPdfPages(e.target.value)} placeholder="Páginas" min="0" className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"/>
                      <button type="submit" disabled={saving} className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium disabled:opacity-50">+ PDF</button>
                    </form>
                  )}
                </div>
              )}
            </div>
          ))}
          {subjects.length === 0 && <div className="text-center py-12 text-gray-400">Nenhuma matéria cadastrada ainda.</div>}
        </div>
      </div>
    </div>
  );
}
