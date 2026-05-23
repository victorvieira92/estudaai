"use client";
import { useState, useEffect } from "react";
import { Plus, CheckCircle, XCircle, Brain } from "lucide-react";

interface Subject { id: string; name: string; }
interface ErrorNote {
  id: string; title: string; description: string; topic: string | null;
  banca: string | null; difficulty: string; resolved: boolean;
  reviewCount: number; wrongCount: number;
  subject: { name: string };
  subjectId: string;
}

export default function CadernoPage() {
  const [notes, setNotes] = useState<ErrorNote[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "resolved">("pending");
  const [subjectId, setSubjectId] = useState("");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [topic, setTopic] = useState("");
  const [banca, setBanca] = useState("");
  const [difficulty, setDifficulty] = useState("Media");
  const [saving, setSaving] = useState(false);
  const [creatingFlashcard, setCreatingFlashcard] = useState<string | null>(null);
  const [flashcardSuccess, setFlashcardSuccess] = useState<string | null>(null);

  const load = () => fetch("/api/error-notes").then(r => r.json()).then(d => setNotes(Array.isArray(d) ? d : [])).catch(console.error);
  useEffect(() => {
    load();
    fetch("/api/subjects").then(r => r.json()).then(d => setSubjects(Array.isArray(d) ? d : (d.subjects ?? []))).catch(console.error);
  }, []);

  const filtered = notes.filter(n => filter === "all" ? true : filter === "pending" ? !n.resolved : n.resolved);

  const add = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    const res = await fetch("/api/error-notes", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description: desc, subjectId, topic, banca, difficulty }),
    });
    if (res.ok) { setTitle(""); setDesc(""); setTopic(""); setBanca(""); load(); }
    setSaving(false);
  };

  const action = async (id: string, act: string) => {
    await fetch("/api/error-notes", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: act }),
    });
    load();
  };

  const createFlashcard = async (note: ErrorNote) => {
    setCreatingFlashcard(note.id);
    const res = await fetch("/api/flashcards", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: note.title,
        answer: note.description,
        subjectId: note.subjectId,
        topic: note.topic ?? "",
        banca: note.banca ?? "",
      }),
    });
    if (res.ok) {
      setFlashcardSuccess(note.id);
      setTimeout(() => setFlashcardSuccess(null), 3000);
    }
    setCreatingFlashcard(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gray-950 text-white px-8 py-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Caderno de Erros</h1>
          <p className="text-gray-400 text-sm mt-1">Registre, revise e resolva seus erros — método Davi Lago</p>
        </div>
        <div className="flex gap-2">
          {(["pending", "all", "resolved"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${filter === f ? "bg-white text-gray-900" : "bg-gray-800 text-gray-300 hover:bg-gray-700"}`}>
              {f === "pending" ? "Pendentes" : f === "all" ? "Todos" : "Resolvidos"}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
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

        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Registrar novo erro</h2>
          <form onSubmit={add} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Disciplina *</label>
                <select value={subjectId} onChange={e => setSubjectId(e.target.value)} required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                  <option value="">Selecione</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Dificuldade</label>
                <select value={difficulty} onChange={e => setDifficulty(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                  {["Baixa", "Media", "Alta"].map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Questão / Título *</label>
              <input value={title} onChange={e => setTitle(e.target.value)} required
                placeholder="Ex: O que é despesa antecipada?"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Por que errei / Explicação *</label>
              <textarea value={desc} onChange={e => setDesc(e.target.value)} required rows={3}
                placeholder="Explique o conceito correto, o que confundiu, como lembrar..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"/>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[["Tema", topic, setTopic, "Ex: CPC 27"], ["Banca", banca, setBanca, "Ex: FGV"]].map(([l, v, s, p]: any) => (
                <div key={l}>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">{l}</label>
                  <input value={v} onChange={e => s(e.target.value)} placeholder={p}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"/>
                </div>
              ))}
            </div>
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 hover:bg-gray-700 text-white font-semibold rounded-xl text-sm disabled:opacity-50">
              <Plus className="w-4 h-4"/>Registrar erro
            </button>
          </form>
        </div>

        <div className="space-y-3">
          {filtered.map(n => (
            <div key={n.id} className={`bg-white rounded-2xl border p-5 ${n.resolved ? "border-green-200 opacity-75" : "border-gray-200"}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${n.difficulty === "Alta" ? "bg-red-100 text-red-700" : n.difficulty === "Media" ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700"}`}>
                      {n.difficulty}
                    </span>
                    <span className="text-xs text-gray-500">
                      {n.subject.name}{n.topic && ` • ${n.topic}`}{n.banca && ` • ${n.banca}`}
                    </span>
                  </div>
                  <p className="font-semibold text-gray-900 mb-1">{n.title}</p>
                  <p className="text-sm text-gray-600">{n.description}</p>
                  <p className="text-xs text-gray-400 mt-2">Revisões: {n.reviewCount} · Errou de novo: {n.wrongCount}x</p>
                </div>
                <div className="flex flex-col gap-2 shrink-0 items-end">
                  {!n.resolved && (
                    <div className="flex gap-2">
                      <button onClick={() => action(n.id, "wrong")} title="Errei de novo"
                        className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-colors">
                        <XCircle className="w-4 h-4"/>
                      </button>
                      <button onClick={() => action(n.id, "review")}
                        className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-medium transition-colors">
                        Revisei
                      </button>
                      <button onClick={() => action(n.id, "resolve")} title="Resolver"
                        className="p-2 bg-green-50 hover:bg-green-100 text-green-600 rounded-lg transition-colors">
                        <CheckCircle className="w-4 h-4"/>
                      </button>
                    </div>
                  )}
                  {flashcardSuccess === n.id ? (
                    <span className="text-xs text-green-600 font-medium">✓ Flashcard criado!</span>
                  ) : (
                    <button onClick={() => createFlashcard(n)} disabled={creatingFlashcard === n.id}
                      className="flex items-center gap-1.5 px-3 py-2 bg-violet-50 hover:bg-violet-100 text-violet-700 rounded-lg text-xs font-medium transition-colors disabled:opacity-50">
                      <Brain className="w-3.5 h-3.5"/>
                      {creatingFlashcard === n.id ? "Criando..." : "→ Flashcard"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              Nenhum erro {filter === "pending" ? "pendente" : filter === "resolved" ? "resolvido" : "registrado"}.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
