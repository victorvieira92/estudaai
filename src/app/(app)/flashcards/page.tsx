"use client";
import { useState, useEffect, useMemo } from "react";
import { Plus, X, Pencil, Trash2, Check } from "lucide-react";

type Origin = "FLASHCARD" | "ERROR_NOTE";

interface UnifiedCard {
  id: string; origin: Origin; question: string; answer: string;
  topic: string; banca: string; difficulty: string; resolved: boolean;
  reviewCount: number; wrongCount: number; intervalDays: number;
  nextReviewAt: string; subjectId: string; subjectName: string;
}

type FilterStatus = "DUE" | "ALL" | "PENDING" | "RESOLVED";
type FilterOrigin = "ALL" | "FLASHCARD" | "ERROR_NOTE";
type OrderBy = "NEXT_REVIEW" | "MOST_WRONG" | "MOST_REVIEWED" | "DIFFICULTY";

interface Filters {
  search: string; origin: FilterOrigin; subject: string;
  banca: string; difficulty: string; status: FilterStatus; orderBy: OrderBy;
}

interface Subject { id: string; name: string; }

function isDue(c: UnifiedCard) { return !c.nextReviewAt || new Date(c.nextReviewAt) <= new Date(); }
function diffWeight(d: string) { const v = d.toLowerCase(); if (v.includes("alta")||v.includes("hard")) return 3; if (v.includes("média")||v.includes("media")||v.includes("medium")) return 2; return 1; }
function fmtDate(d: string) { if (!d) return "Hoje"; return new Intl.DateTimeFormat("pt-BR").format(new Date(d)); }
function unique(arr: string[]) { return Array.from(new Set(arr.map(v => v.trim()).filter(Boolean))).sort(); }

export default function FlashcardsPage() {
  const [allCards, setAllCards] = useState<UnifiedCard[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({ search: "", origin: "ALL", subject: "ALL", banca: "ALL", difficulty: "ALL", status: "DUE", orderBy: "NEXT_REVIEW" });
  const [reviewIndex, setReviewIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  // Novo flashcard
  const [showForm, setShowForm] = useState(false);
  const [subjectId, setSubjectId] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [topic, setTopic] = useState("");
  const [banca, setBanca] = useState("");
  const [saving, setSaving] = useState(false);

  // Edição de flashcard
  const [editingCard, setEditingCard] = useState<UnifiedCard | null>(null);
  const [editQuestion, setEditQuestion] = useState("");
  const [editAnswer, setEditAnswer] = useState("");
  const [editTopic, setEditTopic] = useState("");
  const [editBanca, setEditBanca] = useState("");
  const [editSubjectId, setEditSubjectId] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Lista gerenciamento
  const [showManage, setShowManage] = useState(false);

  const load = async () => {
    const [fc, en, su] = await Promise.all([
      fetch("/api/flashcards").then(r => r.json()).catch(() => []),
      fetch("/api/error-notes").then(r => r.json()).catch(() => []),
      fetch("/api/subjects").then(r => r.json()).catch(() => []),
    ]);
    const subList: Subject[] = Array.isArray(su) ? su : su?.subjects ?? [];
    setSubjects(subList);
    const nameById = new Map(subList.map(s => [s.id, s.name]));
    const cards: UnifiedCard[] = [
      ...(Array.isArray(fc) ? fc : []).map((c: any) => ({
        id: c.id, origin: "FLASHCARD" as Origin, question: c.question, answer: c.answer,
        topic: c.topic ?? "", banca: c.banca ?? "", difficulty: c.difficulty ?? "Média",
        resolved: !!c.resolved, reviewCount: c.reviewCount ?? 0, wrongCount: c.wrongCount ?? 0,
        intervalDays: c.intervalDays ?? 1, nextReviewAt: c.nextReviewAt ?? "",
        subjectId: c.subjectId ?? "", subjectName: nameById.get(c.subjectId) ?? c.subject?.name ?? "",
      })),
      ...(Array.isArray(en) ? en : []).map((c: any) => ({
        id: c.id, origin: "ERROR_NOTE" as Origin, question: c.title, answer: c.description,
        topic: c.topic ?? "", banca: c.banca ?? "", difficulty: c.difficulty ?? "Média",
        resolved: !!c.resolved, reviewCount: c.reviewCount ?? 0, wrongCount: c.wrongCount ?? 0,
        intervalDays: c.intervalDays ?? 1, nextReviewAt: c.nextReviewAt ?? "",
        subjectId: c.subjectId ?? "", subjectName: nameById.get(c.subjectId) ?? c.subject?.name ?? "",
      })),
    ];
    setAllCards(cards);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const s = filters.search.trim().toLowerCase();
    let result = allCards.filter(c => {
      if (s && !c.question.toLowerCase().includes(s) && !c.answer.toLowerCase().includes(s) && !c.topic.toLowerCase().includes(s)) return false;
      if (filters.origin !== "ALL" && c.origin !== filters.origin) return false;
      if (filters.subject !== "ALL" && c.subjectName !== filters.subject) return false;
      if (filters.banca !== "ALL" && c.banca !== filters.banca) return false;
      if (filters.difficulty !== "ALL" && c.difficulty !== filters.difficulty) return false;
      if (filters.status === "DUE" && (c.resolved || !isDue(c))) return false;
      if (filters.status === "PENDING" && c.resolved) return false;
      if (filters.status === "RESOLVED" && !c.resolved) return false;
      return true;
    });
    if (filters.orderBy === "MOST_WRONG") result.sort((a, b) => b.wrongCount - a.wrongCount);
    else if (filters.orderBy === "MOST_REVIEWED") result.sort((a, b) => b.reviewCount - a.reviewCount);
    else if (filters.orderBy === "DIFFICULTY") result.sort((a, b) => diffWeight(b.difficulty) - diffWeight(a.difficulty));
    else result.sort((a, b) => (a.nextReviewAt ? new Date(a.nextReviewAt).getTime() : 0) - (b.nextReviewAt ? new Date(b.nextReviewAt).getTime() : 0));
    return result;
  }, [allCards, filters]);

  const current = filtered[reviewIndex];

  const handleReview = async (action: string) => {
    if (!current) return;
    setActing(action);
    await fetch("/api/flashcards/review", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: current.id, origin: current.origin, action }) });
    setActing(null); setShowAnswer(false);
    if (reviewIndex + 1 >= filtered.length) setReviewIndex(0); else setReviewIndex(i => i + 1);
    await load();
  };

  const addFlashcard = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    const res = await fetch("/api/flashcards", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, answer, subjectId, topic, banca }) });
    if (res.ok) { setQuestion(""); setAnswer(""); setTopic(""); setBanca(""); setShowForm(false); load(); }
    setSaving(false);
  };

  const deleteCard = async (card: UnifiedCard) => {
    if (!confirm("Excluir este card?")) return;
    const url = card.origin === "FLASHCARD" ? `/api/flashcards/${card.id}` : `/api/error-notes/${card.id}`;
    await fetch(url, { method: "DELETE" });
    load();
  };

  const startEdit = (card: UnifiedCard) => {
    setEditingCard(card);
    setEditQuestion(card.question);
    setEditAnswer(card.answer);
    setEditTopic(card.topic);
    setEditBanca(card.banca);
    setEditSubjectId(card.subjectId);
  };

  const saveEdit = async () => {
    if (!editingCard) return;
    setSavingEdit(true);
    if (editingCard.origin === "FLASHCARD") {
      await fetch(`/api/flashcards/${editingCard.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: editQuestion, answer: editAnswer, topic: editTopic, banca: editBanca, subjectId: editSubjectId }) });
    } else {
      await fetch(`/api/error-notes/${editingCard.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: editQuestion, description: editAnswer, topic: editTopic, banca: editBanca, subjectId: editSubjectId }) });
    }
    setEditingCard(null); setSavingEdit(false); load();
  };

  const updateFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => { setFilters(f => ({ ...f, [key]: value })); setReviewIndex(0); setShowAnswer(false); };
  const resetFilters = () => { setFilters({ search: "", origin: "ALL", subject: "ALL", banca: "ALL", difficulty: "ALL", status: "DUE", orderBy: "NEXT_REVIEW" }); setReviewIndex(0); setShowAnswer(false); };

  const totalCards = allCards.length;
  const errorCards = allCards.filter(c => c.origin === "ERROR_NOTE").length;
  const ownCards = allCards.filter(c => c.origin === "FLASHCARD").length;
  const pendingCards = allCards.filter(c => !c.resolved).length;
  const bancas = unique(allCards.map(c => c.banca));
  const difficulties = unique(allCards.map(c => c.difficulty));

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin"/></div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gray-950 text-white px-8 py-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Flashcards</h1>
          <p className="text-gray-400 text-sm mt-1">Revisão unificada com repetição espaçada</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowManage(m => !m)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${showManage ? "bg-white text-gray-900" : "bg-gray-800 hover:bg-gray-700 text-white"}`}>
            {showManage ? <X className="w-4 h-4"/> : <Pencil className="w-4 h-4"/>}
            {showManage ? "Fechar" : "Gerenciar cards"}
          </button>
          <button onClick={() => { setShowForm(f => !f); setShowManage(false); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${showForm ? "bg-white text-gray-900" : "bg-gray-800 hover:bg-gray-700 text-white"}`}>
            {showForm ? <X className="w-4 h-4"/> : <Plus className="w-4 h-4"/>}
            {showForm ? "Fechar" : "Novo flashcard"}
          </button>
        </div>
      </div>

      <div className="px-8 py-8 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[["Total", totalCards, "text-gray-900"], ["Caderno de erros", errorCards, "text-amber-600"], ["Flashcards próprios", ownCards, "text-blue-600"], ["Pendentes", pendingCards, "text-red-600"]].map(([l, v, c]) => (
            <div key={l as string} className="bg-white rounded-2xl border border-gray-200 p-5">
              <p className="text-xs text-gray-500">{l}</p>
              <p className={`text-3xl font-bold mt-2 ${c}`}>{v}</p>
            </div>
          ))}
        </div>

        {/* Formulário novo flashcard */}
        {showForm && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 max-w-3xl">
            <h2 className="text-lg font-semibold mb-4">Novo flashcard</h2>
            <form onSubmit={addFlashcard} className="space-y-4">
              <div><label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Disciplina *</label>
                <select value={subjectId} onChange={e => setSubjectId(e.target.value)} required className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                  <option value="">Selecione</option>{subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Pergunta *</label>
                <textarea value={question} onChange={e => setQuestion(e.target.value)} required rows={2} placeholder="Ex: O que é despesa antecipada?" className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"/>
              </div>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Resposta *</label>
                <textarea value={answer} onChange={e => setAnswer(e.target.value)} required rows={3} placeholder="Resposta completa..." className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"/>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[["Tema", topic, setTopic, "Ex: CPC 27"], ["Banca", banca, setBanca, "Ex: FGV"]].map(([l, v, s, p]: any) => (
                  <div key={l}><label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">{l}</label>
                    <input value={v} onChange={e => s(e.target.value)} placeholder={p} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"/>
                  </div>
                ))}
              </div>
              <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 hover:bg-gray-700 text-white font-semibold rounded-xl text-sm disabled:opacity-50">
                <Plus className="w-4 h-4"/>Adicionar flashcard
              </button>
            </form>
          </div>
        )}

        {/* Modal de edição */}
        {editingCard && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-lg space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">Editar {editingCard.origin === "FLASHCARD" ? "flashcard" : "erro do caderno"}</h2>
                <button onClick={() => setEditingCard(null)} className="p-2 text-gray-400 hover:text-gray-700 rounded-lg"><X className="w-5 h-5"/></button>
              </div>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Disciplina</label>
                <select value={editSubjectId} onChange={e => setEditSubjectId(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">{editingCard.origin === "FLASHCARD" ? "Pergunta" : "Questão / Título"}</label>
                <textarea value={editQuestion} onChange={e => setEditQuestion(e.target.value)} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"/>
              </div>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">{editingCard.origin === "FLASHCARD" ? "Resposta" : "Explicação"}</label>
                <textarea value={editAnswer} onChange={e => setEditAnswer(e.target.value)} rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Tema</label>
                  <input value={editTopic} onChange={e => setEditTopic(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"/>
                </div>
                <div><label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Banca</label>
                  <input value={editBanca} onChange={e => setEditBanca(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"/>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={saveEdit} disabled={savingEdit} className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 hover:bg-gray-700 text-white font-semibold rounded-xl text-sm disabled:opacity-50">
                  <Check className="w-4 h-4"/>{savingEdit ? "Salvando..." : "Salvar"}
                </button>
                <button onClick={() => setEditingCard(null)} className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm">Cancelar</button>
              </div>
            </div>
          </div>
        )}

        {/* Gerenciar cards */}
        {showManage && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">Todos os cards ({allCards.length})</h2>
              <p className="text-xs text-gray-500 mt-0.5">Edite ou exclua flashcards e erros do caderno</p>
            </div>
            <div className="divide-y divide-gray-50">
              {allCards.map(card => (
                <div key={card.id} className="flex items-start gap-4 px-6 py-4 hover:bg-gray-50">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 mt-0.5 ${card.origin === "ERROR_NOTE" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"}`}>
                    {card.origin === "ERROR_NOTE" ? "Caderno" : "Flashcard"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{card.question}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{card.subjectName}{card.topic && ` • ${card.topic}`}{card.banca && ` • ${card.banca}`}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Revisões: {card.reviewCount} · Erros: {card.wrongCount} · Intervalo: {card.intervalDays}d</p>
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
              {allCards.length === 0 && <div className="text-center py-8 text-gray-400">Nenhum card cadastrado ainda.</div>}
            </div>
          </div>
        )}

        {/* Filtros */}
        {!showManage && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Filtros inteligentes</h2>
                <p className="text-sm text-gray-500">{filtered.length} de {allCards.length} cards encontrados</p>
              </div>
              <button onClick={resetFilters} className="px-4 py-2 border border-gray-300 rounded-xl text-sm hover:bg-gray-50 transition-colors">Limpar filtros</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
              <input value={filters.search} onChange={e => updateFilter("search", e.target.value)} placeholder="Buscar..." className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 col-span-2 md:col-span-1"/>
              <select value={filters.origin} onChange={e => updateFilter("origin", e.target.value as FilterOrigin)} className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900">
                <option value="ALL">Todas as origens</option>
                <option value="FLASHCARD">Flashcards</option>
                <option value="ERROR_NOTE">Caderno de Erros</option>
              </select>
              <select value={filters.subject} onChange={e => updateFilter("subject", e.target.value)} className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900">
                <option value="ALL">Todas as disciplinas</option>
                {subjects.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
              <select value={filters.banca} onChange={e => updateFilter("banca", e.target.value)} className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900">
                <option value="ALL">Todas as bancas</option>
                {bancas.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
              <select value={filters.difficulty} onChange={e => updateFilter("difficulty", e.target.value)} className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900">
                <option value="ALL">Todas as dificuldades</option>
                {unique(allCards.map(c => c.difficulty)).map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <select value={filters.status} onChange={e => updateFilter("status", e.target.value as FilterStatus)} className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900">
                <option value="DUE">Para revisar hoje</option>
                <option value="ALL">Todos</option>
                <option value="PENDING">Pendentes</option>
                <option value="RESOLVED">Resolvidos</option>
              </select>
              <select value={filters.orderBy} onChange={e => updateFilter("orderBy", e.target.value as OrderBy)} className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900">
                <option value="NEXT_REVIEW">Próxima revisão</option>
                <option value="MOST_WRONG">Mais errados</option>
                <option value="MOST_REVIEWED">Mais revisados</option>
                <option value="DIFFICULTY">Maior dificuldade</option>
              </select>
            </div>
          </div>
        )}

        {/* Modo revisão */}
        {!showManage && (filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center text-2xl mx-auto mb-4">🎯</div>
            <h2 className="text-xl font-bold text-gray-900">Nenhum card para revisar</h2>
            <p className="text-gray-500 mt-2">Ajuste os filtros ou volte quando houver cards vencidos.</p>
          </div>
        ) : current ? (
          <div className="grid xl:grid-cols-3 gap-6">
            {/* Card principal — 2/3 */}
            <div className="xl:col-span-2 space-y-4">
              <div className="bg-white border border-gray-200 rounded-3xl p-7 shadow-sm space-y-6">
                <div className="flex items-center justify-between">
                  <span className={`text-sm px-4 py-2 rounded-full font-semibold ${current.origin === "ERROR_NOTE" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"}`}>
                    {current.origin === "ERROR_NOTE" ? "Caderno de Erros" : "Flashcard próprio"}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-500">Card {reviewIndex + 1} de {filtered.length}</span>
                    <button onClick={() => startEdit(current)} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors" title="Editar card">
                      <Pencil className="w-4 h-4"/>
                    </button>
                    <button onClick={() => deleteCard(current)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Excluir card">
                      <Trash2 className="w-4 h-4"/>
                    </button>
                  </div>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gray-900 transition-all" style={{ width: `${((reviewIndex + 1) / filtered.length) * 100}%` }}/>
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-3">{current.subjectName}{current.topic ? ` • ${current.topic}` : ""}{current.banca ? ` • ${current.banca}` : ""}</p>
                  <div className="min-h-28 flex items-center">
                    <h2 className="text-2xl font-bold text-gray-900 leading-relaxed">{current.question}</h2>
                  </div>
                </div>
                {showAnswer && (
                  <div className="border border-gray-200 bg-gray-50 rounded-2xl p-6">
                    <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">{current.answer || "Sem resposta cadastrada."}</p>
                  </div>
                )}
                <div className="grid grid-cols-5 gap-3 text-sm">
                  {[["Dificuldade", current.difficulty], ["Intervalo", `${current.intervalDays}d`], ["Próx. revisão", fmtDate(current.nextReviewAt)], ["Revisões", current.reviewCount], ["Erros", current.wrongCount]].map(([l, v]) => (
                    <div key={l as string} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                      <p className="text-gray-400 text-xs">{l}</p>
                      <p className="font-bold text-gray-900 mt-1">{v}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex flex-wrap gap-3">
                  <button onClick={() => setShowAnswer(v => !v)} className="px-5 py-3 rounded-xl bg-gray-900 text-white hover:bg-gray-700 font-semibold transition-colors">
                    {showAnswer ? "Ocultar resposta" : "Mostrar resposta"}
                  </button>
                  {[["wrong","Errei","bg-red-100 text-red-700 hover:bg-red-200"],["hard","Difícil","bg-orange-100 text-orange-700 hover:bg-orange-200"],["medium","Médio","bg-yellow-100 text-yellow-700 hover:bg-yellow-200"],["easy","Fácil","bg-green-100 text-green-700 hover:bg-green-200"],["resolved","Resolver","bg-blue-100 text-blue-700 hover:bg-blue-200"]].map(([action, label, cls]) => (
                    <button key={action} onClick={() => handleReview(action)} disabled={acting !== null} className={`px-5 py-3 rounded-xl font-semibold transition-colors disabled:opacity-50 ${cls}`}>
                      {acting === action ? "..." : label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => { setReviewIndex(i => Math.max(i-1, 0)); setShowAnswer(false); }} disabled={reviewIndex === 0} className="px-5 py-3 rounded-xl border border-gray-300 disabled:opacity-50 hover:bg-gray-50 font-medium transition-colors">Anterior</button>
                  <button onClick={() => { setReviewIndex(i => Math.min(i+1, filtered.length-1)); setShowAnswer(false); }} disabled={reviewIndex === filtered.length-1} className="px-5 py-3 rounded-xl border border-gray-300 disabled:opacity-50 hover:bg-gray-50 font-medium transition-colors">Próximo</button>
                </div>
              </div>
            </div>
            {/* Fila lateral — 1/3 */}
            <div className="xl:col-span-1">
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden sticky top-6">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-bold text-gray-900">Fila de revisão ({filtered.length})</p>
                </div>
                <div className="divide-y divide-gray-50 max-h-[60vh] overflow-y-auto">
                  {filtered.map((card, idx) => (
                    <button key={card.id} onClick={() => { setReviewIndex(idx); setShowAnswer(false); }}
                      className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors ${idx === reviewIndex ? "bg-gray-50 border-l-2 border-gray-900" : ""}`}>
                      <span className="text-xs text-gray-400 shrink-0 mt-0.5">{idx + 1}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-gray-900 truncate">{card.question}</p>
                        <p className="text-xs text-gray-400">{card.subjectName}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null)}
      </div>
    </div>
  );
}
