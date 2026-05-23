"use client";
import { useState, useEffect, useMemo } from "react";
import { Plus, X } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type Origin = "FLASHCARD" | "ERROR_NOTE";

interface UnifiedCard {
  id: string;
  origin: Origin;
  question: string;
  answer: string;
  topic: string;
  banca: string;
  difficulty: string;
  resolved: boolean;
  reviewCount: number;
  wrongCount: number;
  intervalDays: number;
  nextReviewAt: string;
  subjectId: string;
  subjectName: string;
}

type FilterStatus = "DUE" | "ALL" | "PENDING" | "RESOLVED";
type FilterOrigin = "ALL" | "FLASHCARD" | "ERROR_NOTE";
type OrderBy = "NEXT_REVIEW" | "MOST_WRONG" | "MOST_REVIEWED" | "DIFFICULTY";

interface Filters {
  search: string;
  origin: FilterOrigin;
  subject: string;
  banca: string;
  difficulty: string;
  status: FilterStatus;
  orderBy: OrderBy;
}

interface Subject { id: string; name: string; }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isDue(card: UnifiedCard) {
  if (!card.nextReviewAt) return true;
  return new Date(card.nextReviewAt) <= new Date();
}

function diffWeight(d: string) {
  const v = d.toLowerCase();
  if (v.includes("alta") || v.includes("hard")) return 3;
  if (v.includes("média") || v.includes("media") || v.includes("medium")) return 2;
  return 1;
}

function fmtDate(d: string) {
  if (!d) return "Hoje";
  return new Intl.DateTimeFormat("pt-BR").format(new Date(d));
}

function unique(arr: string[]) {
  return Array.from(new Set(arr.map(v => v.trim()).filter(Boolean))).sort();
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function FlashcardsPage() {
  const [allCards, setAllCards] = useState<UnifiedCard[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({
    search: "", origin: "ALL", subject: "ALL", banca: "ALL",
    difficulty: "ALL", status: "DUE", orderBy: "NEXT_REVIEW",
  });

  // Modo revisão
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
        id: c.id, origin: "FLASHCARD" as Origin,
        question: c.question, answer: c.answer,
        topic: c.topic ?? "", banca: c.banca ?? "",
        difficulty: c.difficulty ?? "Média",
        resolved: !!c.resolved, reviewCount: c.reviewCount ?? 0,
        wrongCount: c.wrongCount ?? 0, intervalDays: c.intervalDays ?? 1,
        nextReviewAt: c.nextReviewAt ?? "", subjectId: c.subjectId ?? "",
        subjectName: nameById.get(c.subjectId) ?? c.subject?.name ?? "",
      })),
      ...(Array.isArray(en) ? en : []).map((c: any) => ({
        id: c.id, origin: "ERROR_NOTE" as Origin,
        question: c.title, answer: c.description,
        topic: c.topic ?? "", banca: c.banca ?? "",
        difficulty: c.difficulty ?? "Média",
        resolved: !!c.resolved, reviewCount: c.reviewCount ?? 0,
        wrongCount: c.wrongCount ?? 0, intervalDays: c.intervalDays ?? 1,
        nextReviewAt: c.nextReviewAt ?? "", subjectId: c.subjectId ?? "",
        subjectName: nameById.get(c.subjectId) ?? c.subject?.name ?? "",
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
    await fetch("/api/flashcards/review", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: current.id, origin: current.origin, action }),
    });
    setActing(null);
    setShowAnswer(false);
    if (reviewIndex + 1 >= filtered.length) setReviewIndex(0);
    else setReviewIndex(i => i + 1);
    await load();
  };

  const addFlashcard = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    const res = await fetch("/api/flashcards", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, answer, subjectId, topic, banca }),
    });
    if (res.ok) { setQuestion(""); setAnswer(""); setTopic(""); setBanca(""); setShowForm(false); load(); }
    setSaving(false);
  };

  const updateFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters(f => ({ ...f, [key]: value }));
    setReviewIndex(0);
    setShowAnswer(false);
  };

  const resetFilters = () => {
    setFilters({ search: "", origin: "ALL", subject: "ALL", banca: "ALL", difficulty: "ALL", status: "DUE", orderBy: "NEXT_REVIEW" });
    setReviewIndex(0); setShowAnswer(false);
  };

  const totalCards = allCards.length;
  const errorCards = allCards.filter(c => c.origin === "ERROR_NOTE").length;
  const ownCards = allCards.filter(c => c.origin === "FLASHCARD").length;
  const pendingCards = allCards.filter(c => !c.resolved).length;
  const bancas = unique(allCards.map(c => c.banca));
  const difficulties = unique(allCards.map(c => c.difficulty));

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin"/>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gray-950 text-white px-8 py-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Flashcards</h1>
          <p className="text-gray-400 text-sm mt-1">Revisão unificada com repetição espaçada</p>
        </div>
        <button onClick={() => setShowForm(f => !f)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-xl transition-colors">
          {showForm ? <X className="w-4 h-4"/> : <Plus className="w-4 h-4"/>}
          {showForm ? "Fechar" : "Novo flashcard"}
        </button>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            ["Total", totalCards, "text-gray-900"],
            ["Caderno de erros", errorCards, "text-amber-600"],
            ["Flashcards próprios", ownCards, "text-blue-600"],
            ["Pendentes", pendingCards, "text-red-600"],
          ].map(([l, v, c]) => (
            <div key={l as string} className="bg-white rounded-2xl border border-gray-200 p-5">
              <p className="text-xs text-gray-500">{l}</p>
              <p className={`text-3xl font-bold mt-2 ${c}`}>{v}</p>
            </div>
          ))}
        </div>

        {/* Formulário novo flashcard */}
        {showForm && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Novo flashcard</h2>
            <form onSubmit={addFlashcard} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Disciplina *</label>
                <select value={subjectId} onChange={e => setSubjectId(e.target.value)} required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                  <option value="">Selecione</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Pergunta *</label>
                <textarea value={question} onChange={e => setQuestion(e.target.value)} required rows={2}
                  placeholder="Ex: O que é despesa antecipada?"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"/>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Resposta *</label>
                <textarea value={answer} onChange={e => setAnswer(e.target.value)} required rows={3}
                  placeholder="Resposta completa..."
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
                <Plus className="w-4 h-4"/>Adicionar flashcard
              </button>
            </form>
          </div>
        )}

        {/* Filtros */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Filtros inteligentes</h2>
              <p className="text-sm text-gray-500">{filtered.length} de {allCards.length} cards encontrados</p>
            </div>
            <button onClick={resetFilters} className="px-4 py-2 border border-gray-300 rounded-xl text-sm hover:bg-gray-50 transition-colors">
              Limpar filtros
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <input value={filters.search} onChange={e => updateFilter("search", e.target.value)}
              placeholder="Buscar por pergunta, tema..."
              className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 col-span-2 md:col-span-1"/>
            <select value={filters.origin} onChange={e => updateFilter("origin", e.target.value as FilterOrigin)}
              className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900">
              <option value="ALL">Todas as origens</option>
              <option value="FLASHCARD">Flashcards próprios</option>
              <option value="ERROR_NOTE">Caderno de Erros</option>
            </select>
            <select value={filters.subject} onChange={e => updateFilter("subject", e.target.value)}
              className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900">
              <option value="ALL">Todas as disciplinas</option>
              {subjects.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
            </select>
            <select value={filters.banca} onChange={e => updateFilter("banca", e.target.value)}
              className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900">
              <option value="ALL">Todas as bancas</option>
              {bancas.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <select value={filters.difficulty} onChange={e => updateFilter("difficulty", e.target.value)}
              className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900">
              <option value="ALL">Todas as dificuldades</option>
              {difficulties.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select value={filters.status} onChange={e => updateFilter("status", e.target.value as FilterStatus)}
              className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900">
              <option value="DUE">Para revisar hoje</option>
              <option value="ALL">Todos os status</option>
              <option value="PENDING">Pendentes</option>
              <option value="RESOLVED">Resolvidos</option>
            </select>
            <select value={filters.orderBy} onChange={e => updateFilter("orderBy", e.target.value as OrderBy)}
              className="border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900">
              <option value="NEXT_REVIEW">Próxima revisão</option>
              <option value="MOST_WRONG">Mais errados</option>
              <option value="MOST_REVIEWED">Mais revisados</option>
              <option value="DIFFICULTY">Maior dificuldade</option>
            </select>
          </div>
        </div>

        {/* Modo revisão */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center text-2xl mx-auto mb-4">🎯</div>
            <h2 className="text-xl font-bold text-gray-900">Nenhum card para revisar</h2>
            <p className="text-gray-500 mt-2">Ajuste os filtros ou volte quando houver cards vencidos.</p>
          </div>
        ) : current ? (
          <div className="space-y-4">
            {/* Card principal */}
            <div className="bg-white border border-gray-200 rounded-3xl p-7 shadow-sm space-y-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <span className={`text-sm px-4 py-2 rounded-full font-semibold w-fit ${current.origin === "ERROR_NOTE" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"}`}>
                  {current.origin === "ERROR_NOTE" ? "Caderno de Erros" : "Flashcard próprio"}
                </span>
                <span className="text-sm text-gray-500 font-medium">Card {reviewIndex + 1} de {filtered.length}</span>
              </div>

              {/* Barra de progresso */}
              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-gray-900 transition-all" style={{ width: `${((reviewIndex + 1) / filtered.length) * 100}%` }}/>
              </div>

              <div className="space-y-4">
                <p className="text-sm text-gray-500">
                  {current.subjectName || "Sem disciplina"}
                  {current.topic ? ` • ${current.topic}` : ""}
                  {current.banca ? ` • ${current.banca}` : ""}
                </p>
                <div className="min-h-32 flex items-center">
                  <h2 className="text-2xl font-bold text-gray-900 leading-relaxed">{current.question}</h2>
                </div>
              </div>

              {showAnswer && (
                <div className="border border-gray-200 bg-gray-50 rounded-2xl p-6">
                  <p className="text-gray-800 whitespace-pre-wrap leading-relaxed text-base">{current.answer || "Sem resposta cadastrada."}</p>
                </div>
              )}

              {/* Stats do card */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                {[
                  ["Dificuldade", current.difficulty],
                  ["Intervalo", `${current.intervalDays}d`],
                  ["Próxima revisão", fmtDate(current.nextReviewAt)],
                  ["Revisões", current.reviewCount],
                  ["Erros", current.wrongCount],
                ].map(([l, v]) => (
                  <div key={l as string} className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                    <p className="text-gray-500 text-xs">{l}</p>
                    <p className="font-bold text-gray-900 mt-1">{v}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Ações */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex flex-wrap gap-3">
                <button onClick={() => setShowAnswer(v => !v)}
                  className="px-5 py-3 rounded-xl bg-gray-900 text-white hover:bg-gray-700 font-semibold transition-colors">
                  {showAnswer ? "Ocultar resposta" : "Mostrar resposta"}
                </button>
                {[
                  ["wrong",    "Errei",   "bg-red-100 text-red-700 hover:bg-red-200"],
                  ["hard",     "Difícil", "bg-orange-100 text-orange-700 hover:bg-orange-200"],
                  ["medium",   "Médio",   "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"],
                  ["easy",     "Fácil",   "bg-green-100 text-green-700 hover:bg-green-200"],
                  ["resolved", "Resolver","bg-blue-100 text-blue-700 hover:bg-blue-200"],
                ].map(([action, label, cls]) => (
                  <button key={action} onClick={() => handleReview(action)} disabled={acting !== null}
                    className={`px-5 py-3 rounded-xl font-semibold transition-colors disabled:opacity-50 ${cls}`}>
                    {acting === action ? "..." : label}
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setReviewIndex(i => Math.max(i - 1, 0)); setShowAnswer(false); }} disabled={reviewIndex === 0}
                  className="px-5 py-3 rounded-xl border border-gray-300 disabled:opacity-50 hover:bg-gray-50 font-medium transition-colors">
                  Anterior
                </button>
                <button onClick={() => { setReviewIndex(i => Math.min(i + 1, filtered.length - 1)); setShowAnswer(false); }} disabled={reviewIndex === filtered.length - 1}
                  className="px-5 py-3 rounded-xl border border-gray-300 disabled:opacity-50 hover:bg-gray-50 font-medium transition-colors">
                  Próximo
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
