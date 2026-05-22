"use client";
import { useState, useEffect } from "react";
import { Plus, ChevronDown, ChevronUp, BookOpen } from "lucide-react";

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

  const load = () => fetch("/api/subjects").then(r=>r.json()).then(d=>setSubjects(Array.isArray(d)?d:(d.subjects??[]))).catch(console.error);
  useEffect(()=>{ load(); },[]);

  const addSubject = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError("");
    const res = await fetch("/api/subjects",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name,editalWeight:+ew,criticality:+crit})});
    if(res.ok){setName("");load();}else{const d=await res.json();setError(d.message);}
    setSaving(false);
  };
  const addTopic = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    const res = await fetch("/api/topics",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:topicName,subjectId:topicSubjectId})});
    if(res.ok){setTopicName("");load();}
    setSaving(false);
  };
  const addPdf = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    const res = await fetch("/api/pdfs",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:pdfTitle,topicId:pdfTopicId,totalPages:+pdfPages})});
    if(res.ok){setPdfTitle("");load();}
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gray-950 text-white px-8 py-8">
        <h1 className="text-3xl font-bold">Matérias</h1>
        <p className="text-gray-400 text-sm mt-1">Cadastre disciplinas, tópicos e PDFs do edital.</p>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* Nova matéria */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Nova matéria</h2>
          <form onSubmit={addSubject} className="space-y-4">
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="Ex: Direito Constitucional" required
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"/>
            <div className="grid grid-cols-2 gap-4">
              {[["Peso no edital (1-10)",ew,setEw],["Criticidade (1-10)",crit,setCrit]].map(([l,v,s]:any)=>(
                <div key={l}>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">{l}</label>
                  <input type="number" min="1" max="10" value={v} onChange={e=>s(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"/>
                </div>
              ))}
            </div>
            {error && <p className="text-red-600 text-sm">{error}</p>}
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 hover:bg-gray-700 text-white font-semibold rounded-xl text-sm transition-colors disabled:opacity-50">
              <Plus className="w-4 h-4"/>Adicionar matéria
            </button>
          </form>
        </div>

        {/* Lista de matérias */}
        <div className="space-y-3">
          {subjects.map(s => (
            <div key={s.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <button onClick={()=>setExpanded(expanded===s.id?null:s.id)} className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <BookOpen className="w-5 h-5 text-gray-400"/>
                  <div className="text-left">
                    <p className="font-semibold text-gray-900">{s.name}</p>
                    <p className="text-xs text-gray-500">{s.topics.length} tópico(s) • {s.studyHours.toFixed(1)}h estudadas • {s.totalQuestions} questões</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-gray-500">Peso: {s.editalWeight}/10 • Crit: {s.criticality}/10</span>
                  {expanded===s.id ? <ChevronUp className="w-4 h-4 text-gray-400"/> : <ChevronDown className="w-4 h-4 text-gray-400"/>}
                </div>
              </button>

              {expanded===s.id && (
                <div className="border-t border-gray-100 px-6 py-4 space-y-4 bg-gray-50">
                  {/* Tópicos */}
                  {s.topics.map(t=>(
                    <div key={t.id} className="bg-white rounded-xl border border-gray-200 p-4">
                      <p className="font-medium text-sm mb-2">{t.name}</p>
                      <div className="space-y-1 pl-2">
                        {t.pdfs.map(p=>(
                          <div key={p.id} className="flex items-center gap-2 text-xs text-gray-600">
                            <span className={`w-2 h-2 rounded-full ${p.completed?"bg-green-500":"bg-gray-300"}`}/>
                            {p.title} {p.totalPages>0&&`(${p.totalPages}p)`} {p.completed&&"✓"}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* Formulário novo tópico */}
                  <form onSubmit={e=>{setTopicSubjectId(s.id);addTopic(e);}} className="flex gap-2">
                    <input value={topicSubjectId===s.id?topicName:""} onChange={e=>{setTopicSubjectId(s.id);setTopicName(e.target.value);}} placeholder="Novo tópico (ex: CPC 00)" required
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"/>
                    <button type="submit" disabled={saving} className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium disabled:opacity-50">+ Tópico</button>
                  </form>

                  {/* Formulário novo PDF */}
                  {s.topics.length > 0 && (
                    <form onSubmit={addPdf} className="flex gap-2 flex-wrap">
                      <select value={pdfTopicId} onChange={e=>setPdfTopicId(e.target.value)} required
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                        <option value="">Tópico</option>
                        {s.topics.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                      <input value={pdfTitle} onChange={e=>setPdfTitle(e.target.value)} placeholder="Título do PDF" required
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"/>
                      <input type="number" value={pdfPages} onChange={e=>setPdfPages(e.target.value)} placeholder="Páginas" min="0"
                        className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"/>
                      <button type="submit" disabled={saving} className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium disabled:opacity-50">+ PDF</button>
                    </form>
                  )}
                </div>
              )}
            </div>
          ))}
          {subjects.length===0&&<div className="text-center py-12 text-gray-400">Nenhuma matéria cadastrada ainda.</div>}
        </div>
      </div>
    </div>
  );
}
