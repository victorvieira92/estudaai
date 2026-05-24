"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { Plus, CheckCircle, XCircle, Pencil, Trash2, X, Check, ChevronDown, ChevronRight } from "lucide-react";

interface Subject { id: string; name: string; }
interface ErrorNote {
  id: string; title: string; description: string; topic: string | null;
  banca: string | null; difficulty: string; errorType: string | null;
  resolved: boolean; reviewCount: number; wrongCount: number;
  subject: { name: string }; subjectId: string;
}

const ERROR_TYPES = [
  { value: "desatencao",         label: "Desatenção",            desc: "Leu errado ou marcou sem pensar",         emoji: "😵" },
  { value: "nao_estudei",        label: "Não estudei",           desc: "Conteúdo ainda não visto",                emoji: "📚" },
  { value: "nao_lembrei",        label: "Não lembrei",           desc: "Estudou mas esqueceu na hora",            emoji: "🧠" },
  { value: "confundi_conceitos", label: "Confundi conceitos",    desc: "Misturou dois assuntos parecidos",        emoji: "🔀" },
  { value: "interpretacao",      label: "Erro de interpretação", desc: "Entendeu o enunciado de forma errada",    emoji: "📖" },
  { value: "pegadinha",          label: "Pegadinha",             desc: "Questão com detalhe que induziu ao erro", emoji: "🪤" },
  { value: "outro",              label: "Outro",                 desc: "Motivo diferente dos acima",              emoji: "❓" },
];

const COLORS = ["#000000","#dc2626","#16a34a","#2563eb","#9333ea","#ea580c","#0891b2"];
const FONT_SIZES = ["12px","14px","16px","18px","20px","24px"];

function errorTypeLabel(v: string | null) { return v ? ERROR_TYPES.find(e => e.value === v) ?? null : null; }

// Editor rico reutilizável
function RichEditor({ value, onChange, placeholder, minRows = 3 }: { value: string; onChange: (v: string) => void; placeholder?: string; minRows?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  const exec = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    if (ref.current) onChange(ref.current.innerHTML);
  };

  return (
    <div className="border border-gray-300 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-gray-900">
      <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-200 bg-gray-50 flex-wrap">
        <button type="button" onMouseDown={e => { e.preventDefault(); exec("bold"); }}
          className="w-7 h-7 flex items-center justify-center font-bold text-sm hover:bg-gray-200 rounded transition-colors">B</button>
        <button type="button" onMouseDown={e => { e.preventDefault(); exec("italic"); }}
          className="w-7 h-7 flex items-center justify-center italic text-sm hover:bg-gray-200 rounded transition-colors">I</button>
        <button type="button" onMouseDown={e => { e.preventDefault(); exec("underline"); }}
          className="w-7 h-7 flex items-center justify-center underline text-sm hover:bg-gray-200 rounded transition-colors">U</button>
        <div className="w-px h-5 bg-gray-300 mx-1"/>
        {COLORS.map(c => (
          <button key={c} type="button" onMouseDown={e => { e.preventDefault(); exec("foreColor", c); }}
            className="w-5 h-5 rounded-full border-2 border-white shadow-sm hover:scale-110 transition-transform"
            style={{ backgroundColor: c }}/>
        ))}
        <div className="w-px h-5 bg-gray-300 mx-1"/>
        <select onChange={e => { exec("fontSize", "7"); /* workaround */ document.execCommand("styleWithCSS", false, "true"); exec("fontSize", e.target.value); }}
          className="text-xs border border-gray-200 rounded px-1 py-0.5 bg-white focus:outline-none" defaultValue="">
          <option value="" disabled>Tamanho</option>
          {["1","2","3","4","5","6","7"].map((s, i) => <option key={s} value={s}>{FONT_SIZES[Math.min(i, FONT_SIZES.length-1)]}</option>)}
        </select>
        <div className="w-px h-5 bg-gray-300 mx-1"/>
        <button type="button" onMouseDown={e => { e.preventDefault(); exec("removeFormat"); }}
          className="px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-200 rounded transition-colors">Limpar</button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={() => { if (ref.current) onChange(ref.current.innerHTML); }}
        className="px-4 py-3 text-sm text-gray-900 focus:outline-none"
        style={{ minHeight: `${minRows * 28}px` }}
        dangerouslySetInnerHTML={{ __html: value }}
      />
      <style>{`[contenteditable]:empty:before{content:attr(data-placeholder);color:#9ca3af;pointer-events:none;}`}</style>
    </div>
  );
}

export default function CadernoPage() {
  const [notes, setNotes] = useState<ErrorNote[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [filter, setFilter] = useState<"pending"|"all"|"resolved">("pending");
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());

  // Novo erro
  const [subjectId, setSubjectId] = useState("");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [topic, setTopic] = useState("");
  const [banca, setBanca] = useState("");
  const [difficulty, setDifficulty] = useState("Media");
  const [errorType, setErrorType] = useState("");
  const [saving, setSaving] = useState(false);

  // Edição
  const [editingNote, setEditingNote] = useState<ErrorNote | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editTopic, setEditTopic] = useState("");
  const [editBanca, setEditBanca] = useState("");
  const [editDifficulty, setEditDifficulty] = useState("Media");
  const [editErrorType, setEditErrorType] = useState("");
  const [editSubjectId, setEditSubjectId] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const load = () => fetch("/api/error-notes").then(r => r.json()).then(d => setNotes(Array.isArray(d) ? d : [])).catch(console.error);
  useEffect(() => {
    load();
    fetch("/api/subjects").then(r => r.json()).then(d => setSubjects(Array.isArray(d) ? d : (d.subjects ?? []))).catch(console.error);
  }, []);

  const filtered = useMemo(() => notes.filter(n =>
    filter === "all" ? true : filter === "pending" ? !n.resolved : n.resolved
  ), [notes, filter]);

  // Agrupamento: disciplina > tópico > erros
  const grouped = useMemo(() => {
    const bySubject: Record<string, { name: string; topics: Record<string, ErrorNote[]>; noTopic: ErrorNote[] }> = {};
    for (const n of filtered) {
      const sName = n.subject.name;
      if (!bySubject[sName]) bySubject[sName] = { name: sName, topics: {}, noTopic: [] };
      if (n.topic) {
        if (!bySubject[sName].topics[n.topic]) bySubject[sName].topics[n.topic] = [];
        bySubject[sName].topics[n.topic].push(n);
      } else {
        bySubject[sName].noTopic.push(n);
      }
    }
    return bySubject;
  }, [filtered]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    const strip = (h: string) => h.replace(/<[^>]*>/g, "").trim();
    if (!strip(title)) { setSaving(false); return; }
    const res = await fetch("/api/error-notes", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description: desc, subjectId, topic, banca, difficulty, errorType: errorType || null }),
    });
    if (res.ok) { setTitle(""); setDesc(""); setTopic(""); setBanca(""); setErrorType(""); load(); }
    setSaving(false);
  };

  const action = async (id: string, act: string) => {
    await fetch("/api/error-notes", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action: act }) });
    load();
  };

  const deleteNote = async (id: string) => {
    if (!confirm("Excluir este erro?")) return;
    await fetch(`/api/error-notes/${id}`, { method: "DELETE" }); load();
  };

  const startEdit = (n: ErrorNote) => {
    setEditingNote(n); setEditTitle(n.title); setEditDesc(n.description);
    setEditTopic(n.topic ?? ""); setEditBanca(n.banca ?? "");
    setEditDifficulty(n.difficulty); setEditErrorType(n.errorType ?? ""); setEditSubjectId(n.subjectId);
  };

  const saveEdit = async () => {
    if (!editingNote) return; setSavingEdit(true);
    await fetch(`/api/error-notes/${editingNote.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editTitle, description: editDesc, topic: editTopic, banca: editBanca, difficulty: editDifficulty, errorType: editErrorType || null, subjectId: editSubjectId }),
    });
    setEditingNote(null); setSavingEdit(false); load();
  };

  const toggleSubject = (s: string) => setExpandedSubjects(prev => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n; });
  const toggleTopic = (k: string) => setExpandedTopics(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });

  // Card de erro individual
  const NoteCard = ({ n }: { n: ErrorNote }) => {
    const errType = errorTypeLabel(n.errorType);
    return (
      <div className={`bg-white rounded-2xl border p-5 ${n.resolved ? "border-green-200 opacity-70" : "border-gray-200"}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${n.difficulty === "Alta" ? "bg-red-100 text-red-700" : n.difficulty === "Media" ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"}`}>
                {n.difficulty}
              </span>
              {errType && <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-700">{errType.emoji} {errType.label}</span>}
              {n.banca && <span className="text-xs text-gray-400">• {n.banca}</span>}
            </div>
            <div className="font-semibold text-gray-900 mb-2" dangerouslySetInnerHTML={{ __html: n.title }}/>
            {n.description && <div className="text-sm text-gray-600 leading-relaxed" dangerouslySetInnerHTML={{ __html: n.description }}/>}
            <p className="text-xs text-gray-400 mt-2">Revisões: {n.reviewCount} · Errou de novo: {n.wrongCount}x</p>
          </div>
          <div className="flex flex-col gap-2 shrink-0 items-end">
            {!n.resolved && (
              <div className="flex gap-1.5">
                <button onClick={() => action(n.id, "wrong")} title="Errei de novo"
                  className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors">
                  <XCircle className="w-4 h-4"/>
                </button>
                <button onClick={() => action(n.id, "review")}
                  className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-medium transition-colors">
                  Revisei
                </button>
                <button onClick={() => action(n.id, "resolve")} title="Resolvido"
                  className="p-2 bg-green-50 hover:bg-green-100 text-green-600 rounded-lg transition-colors">
                  <CheckCircle className="w-4 h-4"/>
                </button>
              </div>
            )}
            <div className="flex gap-1.5">
              <button onClick={() => startEdit(n)} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                <Pencil className="w-4 h-4"/>
              </button>
              <button onClick={() => deleteNote(n.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                <Trash2 className="w-4 h-4"/>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gray-950 text-white px-8 py-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Caderno de Erros</h1>
          <p className="text-gray-400 text-sm mt-1">Registre, revise e resolva seus erros por disciplina</p>
        </div>
        <div className="flex gap-2">
          {(["pending","all","resolved"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${filter === f ? "bg-white text-gray-900" : "bg-gray-800 text-gray-300 hover:bg-gray-700"}`}>
              {f === "pending" ? "Pendentes" : f === "all" ? "Todos" : "Resolvidos"}
            </button>
          ))}
        </div>
      </div>

      {/* Modal edição */}
      {editingNote && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Editar erro</h2>
              <button onClick={() => setEditingNote(null)} className="p-2 text-gray-400 hover:text-gray-700 rounded-lg"><X className="w-5 h-5"/></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Disciplina</label>
                <select value={editSubjectId} onChange={e => setEditSubjectId(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Tópico / Conteúdo</label>
                <input value={editTopic} onChange={e => setEditTopic(e.target.value)} placeholder="Ex: Conceito de Tributo"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"/>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Dificuldade</label>
                <select value={editDifficulty} onChange={e => setEditDifficulty(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                  {["Baixa","Media","Alta"].map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Motivo</label>
                <select value={editErrorType} onChange={e => setEditErrorType(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                  <option value="">Selecione</option>
                  {ERROR_TYPES.map(t => <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Banca</label>
              <input value={editBanca} onChange={e => setEditBanca(e.target.value)} placeholder="Ex: FGV"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Questão / Título</label>
              <RichEditor value={editTitle} onChange={setEditTitle} placeholder="Questão ou título..." minRows={2}/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Explicação / Por que errei</label>
              <RichEditor value={editDesc} onChange={setEditDesc} placeholder="Explique o conceito correto..." minRows={4}/>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={saveEdit} disabled={savingEdit} className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 hover:bg-gray-700 text-white font-semibold rounded-xl text-sm disabled:opacity-50">
                <Check className="w-4 h-4"/>{savingEdit ? "Salvando..." : "Salvar"}
              </button>
              <button onClick={() => setEditingNote(null)} className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <div className="px-8 py-8 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-4 gap-4">
          {[
            ["Total", notes.length, "text-gray-900"],
            ["Pendentes", notes.filter(n => !n.resolved).length, "text-red-600"],
            ["Resolvidos", notes.filter(n => n.resolved).length, "text-green-600"],
            ["Críticos", notes.filter(n => !n.resolved && n.difficulty === "Alta").length, "text-orange-600"],
          ].map(([l, v, c]) => (
            <div key={l as string} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">{l}</p>
              <p className={`text-3xl font-bold ${c}`}>{v}</p>
            </div>
          ))}
        </div>

        {/* Formulário + tipos lado a lado */}
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Registrar novo erro</h2>
            <form onSubmit={add} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Disciplina *</label>
                  <select value={subjectId} onChange={e => setSubjectId(e.target.value)} required
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                    <option value="">Selecione</option>
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Tópico / Conteúdo</label>
                  <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="Ex: Conceito de Tributo"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"/>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Dificuldade</label>
                  <select value={difficulty} onChange={e => setDifficulty(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                    {["Baixa","Media","Alta"].map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Motivo do erro</label>
                  <select value={errorType} onChange={e => setErrorType(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                    <option value="">Selecione</option>
                    {ERROR_TYPES.map(t => <option key={t.value} value={t.value}>{t.emoji} {t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Banca</label>
                  <input value={banca} onChange={e => setBanca(e.target.value)} placeholder="Ex: FGV"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"/>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Questão / Título *</label>
                <RichEditor value={title} onChange={setTitle} placeholder="Digite a questão ou título do erro..." minRows={2}/>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Por que errei / Explicação *</label>
                <RichEditor value={desc} onChange={setDesc} placeholder="Explique o conceito correto, o que confundiu, como lembrar..." minRows={4}/>
              </div>
              <button type="submit" disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 hover:bg-gray-700 text-white font-semibold rounded-xl text-sm disabled:opacity-50 transition-colors">
                <Plus className="w-4 h-4"/>Registrar erro
              </button>
            </form>
          </div>

          {/* Tipos de erro */}
          <div className="col-span-1 bg-white rounded-2xl border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-1">Tipos de erro</h2>
            <p className="text-xs text-gray-400 mb-3">Clique para selecionar.</p>
            <div className="space-y-2">
              {ERROR_TYPES.map(t => (
                <button key={t.value} type="button" onClick={() => setErrorType(t.value)}
                  className={`w-full flex items-start gap-2 p-2.5 rounded-xl text-left transition-colors border ${errorType === t.value ? "border-gray-900 bg-gray-900/5" : "border-gray-100 bg-gray-50 hover:border-gray-300"}`}>
                  <span className="text-base shrink-0">{t.emoji}</span>
                  <div>
                    <p className="text-xs font-semibold text-gray-800">{t.label}</p>
                    <p className="text-xs text-gray-400 leading-tight">{t.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Lista agrupada por disciplina > tópico */}
        <div className="space-y-3">
          {Object.keys(grouped).length === 0 && (
            <div className="text-center py-12 text-gray-400">
              Nenhum erro {filter === "pending" ? "pendente" : filter === "resolved" ? "resolvido" : "registrado"}.
            </div>
          )}
          {Object.entries(grouped).map(([subName, subData]) => {
            const isExpanded = expandedSubjects.has(subName);
            const total = subData.noTopic.length + Object.values(subData.topics).reduce((a, arr) => a + arr.length, 0);
            return (
              <div key={subName} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                {/* Header da disciplina */}
                <button onClick={() => toggleSubject(subName)}
                  className="w-full flex items-center gap-3 px-6 py-4 hover:bg-gray-50 transition-colors text-left">
                  {isExpanded ? <ChevronDown className="w-5 h-5 text-gray-400 shrink-0"/> : <ChevronRight className="w-5 h-5 text-gray-400 shrink-0"/>}
                  <div className="flex-1">
                    <p className="font-bold text-gray-900">{subName}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {total} erro{total !== 1 ? "s" : ""}
                      {Object.keys(subData.topics).length > 0 && ` · ${Object.keys(subData.topics).length} tópico${Object.keys(subData.topics).length !== 1 ? "s" : ""}`}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{isExpanded ? "Recolher" : "Expandir"}</span>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-100">
                    {/* Erros sem tópico */}
                    {subData.noTopic.length > 0 && (
                      <div className="px-6 py-4 space-y-3 bg-gray-50/50">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sem tópico</p>
                        {subData.noTopic.map(n => <NoteCard key={n.id} n={n}/>)}
                      </div>
                    )}

                    {/* Tópicos */}
                    {Object.entries(subData.topics).map(([topicName, topicNotes]) => {
                      const topicKey = `${subName}::${topicName}`;
                      const topicExpanded = expandedTopics.has(topicKey);
                      return (
                        <div key={topicName} className="border-t border-gray-100">
                          <button onClick={() => toggleTopic(topicKey)}
                            className="w-full flex items-center gap-3 px-8 py-3.5 hover:bg-gray-50 transition-colors text-left">
                            {topicExpanded ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0"/> : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0"/>}
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-gray-700">› {topicName}</p>
                              <p className="text-xs text-gray-400">{topicNotes.length} erro{topicNotes.length !== 1 ? "s" : ""}</p>
                            </div>
                          </button>
                          {topicExpanded && (
                            <div className="px-8 pb-4 space-y-3 bg-gray-50/30">
                              {topicNotes.map(n => <NoteCard key={n.id} n={n}/>)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
