"use client";
import { useState, useEffect, useRef } from "react";
import { Plus, Pencil, Trash2, X, Check, Bold, Italic, Underline } from "lucide-react";

interface Subject { id: string; name: string; }
interface Card {
  id: string; origin: "FLASHCARD"|"ERROR_NOTE"; question: string; answer: string;
  topic: string; banca: string; difficulty: string; subjectName: string;
  subjectId: string; reviewCount: number; wrongCount: number; intervalDays: number;
}

const COLORS = ["#000000","#dc2626","#16a34a","#2563eb","#9333ea","#ea580c","#0891b2","#64748b"];

function RichEditor({ value, onChange, placeholder, rows = 4 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  const exec = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    if (ref.current) onChange(ref.current.innerHTML);
  };

  return (
    <div className="border border-gray-300 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-gray-900">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-200 bg-gray-50 flex-wrap">
        <button type="button" onMouseDown={e => { e.preventDefault(); exec("bold"); }}
          className="p-1.5 hover:bg-gray-200 rounded font-bold text-sm w-7 h-7 flex items-center justify-center transition-colors">B</button>
        <button type="button" onMouseDown={e => { e.preventDefault(); exec("italic"); }}
          className="p-1.5 hover:bg-gray-200 rounded italic text-sm w-7 h-7 flex items-center justify-center transition-colors">I</button>
        <button type="button" onMouseDown={e => { e.preventDefault(); exec("underline"); }}
          className="p-1.5 hover:bg-gray-200 rounded underline text-sm w-7 h-7 flex items-center justify-center transition-colors">U</button>
        <div className="w-px h-5 bg-gray-300 mx-1"/>
        {COLORS.map(c => (
          <button key={c} type="button" onMouseDown={e => { e.preventDefault(); exec("foreColor", c); }}
            className="w-5 h-5 rounded-full border-2 border-white shadow-sm hover:scale-110 transition-transform"
            style={{ backgroundColor: c }}/>
        ))}
        <div className="w-px h-5 bg-gray-300 mx-1"/>
        <button type="button" onMouseDown={e => { e.preventDefault(); exec("removeFormat"); }}
          className="px-2 py-1 hover:bg-gray-200 rounded text-xs text-gray-500 transition-colors">Limpar</button>
      </div>
      {/* Editor */}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={() => { if (ref.current) onChange(ref.current.innerHTML); }}
        className="min-h-[80px] px-4 py-3 text-sm text-gray-900 focus:outline-none"
        style={{ minHeight: `${rows * 24}px` }}
        data-placeholder={placeholder}
        dangerouslySetInnerHTML={{ __html: value }}
      />
      <style>{`[contenteditable]:empty:before { content: attr(data-placeholder); color: #9ca3af; pointer-events: none; }`}</style>
    </div>
  );
}

export default function NovoFlashcardPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [topic, setTopic] = useState("");
  const [banca, setBanca] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Edição
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [editQ, setEditQ] = useState("");
  const [editA, setEditA] = useState("");
  const [editTopic, setEditTopic] = useState("");
  const [editBanca, setEditBanca] = useState("");
  const [editSubjectId, setEditSubjectId] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const load = async () => {
    const [fc, en, su] = await Promise.all([
      fetch("/api/flashcards").then(r => r.json()).catch(() => []),
      fetch("/api/error-notes").then(r => r.json()).catch(() => []),
      fetch("/api/subjects").then(r => r.json()).catch(() => []),
    ]);
    const subList: Subject[] = Array.isArray(su) ? su : su?.subjects ?? [];
    setSubjects(subList);
    const nameById = new Map(subList.map((s: any) => [s.id, s.name]));
    const all: Card[] = [
      ...(Array.isArray(fc) ? fc : []).map((c: any) => ({ id: c.id, origin: "FLASHCARD" as const, question: c.question, answer: c.answer, topic: c.topic ?? "", banca: c.banca ?? "", difficulty: c.difficulty ?? "Media", subjectId: c.subjectId ?? "", subjectName: nameById.get(c.subjectId) ?? "", reviewCount: c.reviewCount ?? 0, wrongCount: c.wrongCount ?? 0, intervalDays: c.intervalDays ?? 1 })),
      ...(Array.isArray(en) ? en : []).map((c: any) => ({ id: c.id, origin: "ERROR_NOTE" as const, question: c.title, answer: c.description, topic: c.topic ?? "", banca: c.banca ?? "", difficulty: c.difficulty ?? "Media", subjectId: c.subjectId ?? "", subjectName: nameById.get(c.subjectId) ?? "", reviewCount: c.reviewCount ?? 0, wrongCount: c.wrongCount ?? 0, intervalDays: c.intervalDays ?? 1 })),
    ];
    setCards(all);
  };

  useEffect(() => { load(); }, []);

  const add = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    const strip = (html: string) => html.replace(/<[^>]*>/g, "").trim();
    if (!strip(question) || !strip(answer)) { setSaving(false); return; }
    const res = await fetch("/api/flashcards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, answer, subjectId, topic, banca }) });
    if (res.ok) { setQuestion(""); setAnswer(""); setTopic(""); setBanca(""); setSaved(true); setTimeout(() => setSaved(false), 2000); load(); }
    setSaving(false);
  };

  const deleteCard = async (card: Card) => {
    if (!confirm("Excluir este card?")) return;
    await fetch(card.origin === "FLASHCARD" ? `/api/flashcards/${card.id}` : `/api/error-notes/${card.id}`, { method: "DELETE" });
    load();
  };

  const startEdit = (card: Card) => { setEditingCard(card); setEditQ(card.question); setEditA(card.answer); setEditTopic(card.topic); setEditBanca(card.banca); setEditSubjectId(card.subjectId); };

  const saveEdit = async () => {
    if (!editingCard) return; setSavingEdit(true);
    if (editingCard.origin === "FLASHCARD") await fetch(`/api/flashcards/${editingCard.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: editQ, answer: editA, topic: editTopic, banca: editBanca, subjectId: editSubjectId }) });
    else await fetch(`/api/error-notes/${editingCard.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: editQ, description: editA, topic: editTopic, banca: editBanca, subjectId: editSubjectId }) });
    setEditingCard(null); setSavingEdit(false); load();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gray-950 text-white px-8 py-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gerenciar Flashcards</h1>
          <p className="text-gray-400 text-sm mt-1">Crie, edite e exclua seus cards</p>
        </div>
        <a href="/flashcards" className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold rounded-xl transition-colors">
          ▶ Iniciar revisão
        </a>
      </div>

      {/* Modal de edição */}
      {editingCard && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Editar card</h2>
              <button onClick={() => setEditingCard(null)} className="p-2 text-gray-400 hover:text-gray-700 rounded-lg"><X className="w-5 h-5"/></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Disciplina</label>
                <select value={editSubjectId} onChange={e => setEditSubjectId(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Tema</label>
                  <input value={editTopic} onChange={e => setEditTopic(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"/>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Banca</label>
                  <input value={editBanca} onChange={e => setEditBanca(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"/>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Pergunta / Frente</label>
              <RichEditor value={editQ} onChange={setEditQ} placeholder="Pergunta..." rows={3}/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Resposta / Verso</label>
              <RichEditor value={editA} onChange={setEditA} placeholder="Resposta..." rows={4}/>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={saveEdit} disabled={savingEdit} className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 hover:bg-gray-700 text-white font-semibold rounded-xl text-sm disabled:opacity-50">
                <Check className="w-4 h-4"/>{savingEdit ? "Salvando..." : "Salvar"}
              </button>
              <button onClick={() => setEditingCard(null)} className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <div className="px-8 py-8 space-y-8">
        <div className="grid xl:grid-cols-2 gap-8">
          {/* Formulário de criação */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="text-lg font-bold mb-5">Novo flashcard</h2>
            <form onSubmit={add} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Disciplina *</label>
                  <select value={subjectId} onChange={e => setSubjectId(e.target.value)} required className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                    <option value="">Selecione</option>
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Tema</label>
                    <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="Ex: CPC 27" className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"/>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Banca</label>
                    <input value={banca} onChange={e => setBanca(e.target.value)} placeholder="Ex: FGV" className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"/>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Pergunta / Frente *</label>
                <RichEditor value={question} onChange={setQuestion} placeholder="Ex: O que é despesa antecipada?" rows={3}/>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Resposta / Verso *</label>
                <RichEditor value={answer} onChange={setAnswer} placeholder="Resposta completa..." rows={5}/>
              </div>
              <div className="flex items-center gap-3">
                <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 hover:bg-gray-700 text-white font-semibold rounded-xl text-sm disabled:opacity-50 transition-colors">
                  <Plus className="w-4 h-4"/>{saving ? "Salvando..." : "Adicionar flashcard"}
                </button>
                {saved && <span className="text-green-600 text-sm font-medium">✓ Card adicionado!</span>}
              </div>
            </form>
          </div>

          {/* Preview */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Preview do card</h2>
              <div className="border border-gray-200 rounded-xl p-5 min-h-24 mb-3">
                {question ? <div className="text-lg font-bold text-gray-900" dangerouslySetInnerHTML={{ __html: question }}/> : <p className="text-gray-400 text-sm">A pergunta aparecerá aqui...</p>}
              </div>
              <div className="border border-dashed border-gray-300 rounded-xl p-5 min-h-24 bg-gray-50">
                {answer ? <div className="text-gray-800" dangerouslySetInnerHTML={{ __html: answer }}/> : <p className="text-gray-400 text-sm">A resposta aparecerá aqui...</p>}
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-700">
              <p className="font-semibold mb-1">💡 Dicas para bons flashcards</p>
              <ul className="space-y-1 text-xs text-blue-600">
                <li>• Uma informação por card — cards simples são revisados mais rápido</li>
                <li>• Formule como pergunta direta — "O que é X?" em vez de só "X"</li>
                <li>• Use negrito para destacar termos-chave</li>
                <li>• Resposta curta e direta — evite parágrafos longos</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Lista de todos os cards */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-gray-900">Todos os cards ({cards.length})</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {cards.map(card => (
              <div key={card.id} className="flex items-start gap-4 px-6 py-4 hover:bg-gray-50 transition-colors">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 mt-0.5 ${card.origin === "ERROR_NOTE" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"}`}>
                  {card.origin === "ERROR_NOTE" ? "Caderno" : "Flashcard"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate" dangerouslySetInnerHTML={{ __html: card.question }}/>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {card.subjectName}{card.topic && ` • ${card.topic}`}{card.banca && ` • ${card.banca}`} · {card.reviewCount} revisões · {card.intervalDays}d intervalo
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => startEdit(card)} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                    <Pencil className="w-4 h-4"/>
                  </button>
                  <button onClick={() => deleteCard(card)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4"/>
                  </button>
                </div>
              </div>
            ))}
            {cards.length === 0 && <div className="text-center py-12 text-gray-400">Nenhum card cadastrado ainda.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
