"use client";
import { useState, useEffect, useMemo } from "react";
import { RotateCcw, Pencil, X, Check, Flag, BookMarked } from "lucide-react";

type Origin = "FLASHCARD" | "ERROR_NOTE";

interface Card {
  id: string; origin: Origin; question: string; answer: string;
  topic: string; banca: string; difficulty: string; resolved: boolean;
  reviewCount: number; wrongCount: number; intervalDays: number;
  nextReviewAt: string; subjectId: string; subjectName: string;
  marked?: boolean;
}

interface Subject { id: string; name: string; }

function isDue(c: Card) { return !c.resolved && (!c.nextReviewAt || new Date(c.nextReviewAt) <= new Date()); }

function getNextIntervals(card: Card) {
  const i = card.intervalDays;
  return {
    again:  "1d",
    hard:   i <= 1 ? "2d" : `${Math.round(i * 1.2)}d`,
    good:   `${Math.round(Math.max(i * 1.5, i + 1))}d`,
    easy:   `${Math.round(Math.max(i * 2.5, i + 3))}d`,
  };
}

export default function FlashcardsReviewPage() {
  const [allCards, setAllCards] = useState<Card[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSubject, setFilterSubject] = useState("ALL");
  const [filterOrigin, setFilterOrigin] = useState<"ALL"|"FLASHCARD"|"ERROR_NOTE">("ALL");
  const [reviewIndex, setReviewIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [sessionDone, setSessionDone] = useState(false);

  // Edição inline
  const [editing, setEditing] = useState(false);
  const [editQ, setEditQ] = useState("");
  const [editA, setEditA] = useState("");
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
    const cards: Card[] = [
      ...(Array.isArray(fc) ? fc : []).map((c: any) => ({
        id: c.id, origin: "FLASHCARD" as Origin, question: c.question, answer: c.answer,
        topic: c.topic ?? "", banca: c.banca ?? "", difficulty: c.difficulty ?? "Media",
        resolved: !!c.resolved, reviewCount: c.reviewCount ?? 0, wrongCount: c.wrongCount ?? 0,
        intervalDays: c.intervalDays ?? 1, nextReviewAt: c.nextReviewAt ?? "",
        subjectId: c.subjectId ?? "", subjectName: nameById.get(c.subjectId) ?? c.subject?.name ?? "",
      })),
      ...(Array.isArray(en) ? en : []).map((c: any) => ({
        id: c.id, origin: "ERROR_NOTE" as Origin, question: c.title, answer: c.description,
        topic: c.topic ?? "", banca: c.banca ?? "", difficulty: c.difficulty ?? "Media",
        resolved: !!c.resolved, reviewCount: c.reviewCount ?? 0, wrongCount: c.wrongCount ?? 0,
        intervalDays: c.intervalDays ?? 1, nextReviewAt: c.nextReviewAt ?? "",
        subjectId: c.subjectId ?? "", subjectName: nameById.get(c.subjectId) ?? c.subject?.name ?? "",
      })),
    ];
    setAllCards(cards);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const queue = useMemo(() => {
    return allCards.filter(c => {
      if (!isDue(c)) return false;
      if (filterSubject !== "ALL" && c.subjectName !== filterSubject) return false;
      if (filterOrigin !== "ALL" && c.origin !== filterOrigin) return false;
      return true;
    });
  }, [allCards, filterSubject, filterOrigin]);

  const current = queue[reviewIndex];

  // Contadores estilo Anki
  const newCards = queue.filter(c => c.reviewCount === 0).length;
  const learningCards = queue.filter(c => c.reviewCount > 0 && c.intervalDays <= 1).length;
  const reviewCards = queue.filter(c => c.intervalDays > 1).length;

  const handleReview = async (action: string) => {
    if (!current) return;
    setActing(action);
    await fetch("/api/flashcards/review", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: current.id, origin: current.origin, action }),
    });
    setActing(null); setShowAnswer(false);
    const nextIndex = reviewIndex + 1;
    if (nextIndex >= queue.length) { setSessionDone(true); }
    else { setReviewIndex(nextIndex); }
    await load();
  };

  const saveEdit = async () => {
    if (!current) return;
    setSavingEdit(true);
    if (current.origin === "FLASHCARD") {
      await fetch(`/api/flashcards/${current.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: editQ, answer: editA }) });
    } else {
      await fetch(`/api/error-notes/${current.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: editQ, description: editA }) });
    }
    setSavingEdit(false); setEditing(false); load();
  };

  const openEdit = () => { if (!current) return; setEditQ(current.question); setEditA(current.answer); setEditing(true); };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin"/>
    </div>
  );

  // Tela de parabéns — sessão concluída
  if (sessionDone || queue.length === 0) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-6 px-6">
      <div className="text-6xl">🎉</div>
      <h1 className="text-3xl font-bold text-gray-900">Parabéns!</h1>
      <p className="text-gray-500 text-center max-w-sm">
        {queue.length === 0 ? "Não há cards para revisar agora. Volte mais tarde ou ajuste os filtros." : "Você concluiu todos os cards desta sessão. Continue amanhã para manter o ritmo!"}
      </p>
      <div className="grid grid-cols-3 gap-4 text-center mt-2">
        {[["Novos", newCards, "text-blue-600"], ["Aprendendo", learningCards, "text-red-600"], ["Revisão", reviewCards, "text-green-600"]].map(([l, v, c]) => (
          <div key={l as string} className="bg-white rounded-2xl border border-gray-200 px-6 py-4">
            <p className={`text-2xl font-bold ${c}`}>{v}</p>
            <p className="text-xs text-gray-500 mt-1">{l}</p>
          </div>
        ))}
      </div>
      <button onClick={() => { setSessionDone(false); setReviewIndex(0); load(); }}
        className="px-6 py-3 bg-gray-900 hover:bg-gray-700 text-white font-semibold rounded-xl transition-colors">
        Reiniciar sessão
      </button>
    </div>
  );

  const intervals = current ? getNextIntervals(current) : null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-gray-950 text-white px-8 py-5 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-bold">Flashcards</h1>
          {/* Contadores estilo Anki */}
          <div className="flex items-center gap-4 text-sm font-mono">
            <span className="text-blue-400 font-bold">{newCards}</span>
            <span className="text-red-400 font-bold">{learningCards}</span>
            <span className="text-green-400 font-bold">{reviewCards}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select value={filterOrigin} onChange={e => { setFilterOrigin(e.target.value as any); setReviewIndex(0); setShowAnswer(false); setSessionDone(false); }}
            className="bg-gray-800 text-gray-300 border border-gray-700 rounded-lg px-3 py-1.5 text-xs focus:outline-none">
            <option value="ALL">Todos</option>
            <option value="FLASHCARD">Flashcards</option>
            <option value="ERROR_NOTE">Caderno de Erros</option>
          </select>
          <select value={filterSubject} onChange={e => { setFilterSubject(e.target.value); setReviewIndex(0); setShowAnswer(false); setSessionDone(false); }}
            className="bg-gray-800 text-gray-300 border border-gray-700 rounded-lg px-3 py-1.5 text-xs focus:outline-none">
            <option value="ALL">Todas as disciplinas</option>
            {subjects.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
          </select>
          <a href="/flashcards/novo" className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-medium transition-colors">
            + Novo card
          </a>
        </div>
      </div>

      {/* Card */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        {editing ? (
          <div className="w-full max-w-2xl bg-white rounded-3xl border border-gray-200 shadow-sm p-8 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-gray-900">Editar card</h3>
              <button onClick={() => setEditing(false)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg"><X className="w-4 h-4"/></button>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Pergunta / Frente</label>
              <textarea value={editQ} onChange={e => setEditQ(e.target.value)} rows={3}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Resposta / Verso</label>
              <textarea value={editA} onChange={e => setEditA(e.target.value)} rows={4}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"/>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={saveEdit} disabled={savingEdit}
                className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 hover:bg-gray-700 text-white font-semibold rounded-xl text-sm disabled:opacity-50">
                <Check className="w-4 h-4"/>{savingEdit ? "Salvando..." : "Salvar"}
              </button>
              <button onClick={() => setEditing(false)} className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm">Cancelar</button>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-2xl space-y-4">
            {/* Card principal */}
            <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
              {/* Barra de progresso */}
              <div className="h-1 bg-gray-100">
                <div className="h-full bg-gray-900 transition-all" style={{ width: `${((reviewIndex) / Math.max(queue.length, 1)) * 100}%` }}/>
              </div>

              <div className="p-8">
                {/* Meta do card */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${current.origin === "ERROR_NOTE" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"}`}>
                      {current.origin === "ERROR_NOTE" ? "Caderno de Erros" : "Flashcard"}
                    </span>
                    {current.subjectName && <span className="text-xs text-gray-500">{current.subjectName}</span>}
                    {current.topic && <span className="text-xs text-gray-400">• {current.topic}</span>}
                    {current.banca && <span className="text-xs text-gray-400">• {current.banca}</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={openEdit} title="Editar card"
                      className="p-2 text-gray-300 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                      <Pencil className="w-4 h-4"/>
                    </button>
                  </div>
                </div>

                {/* Pergunta */}
                <div className="min-h-32 flex items-center mb-6">
                  <p className="text-2xl font-bold text-gray-900 leading-relaxed">{current.question}</p>
                </div>

                {/* Separador + resposta */}
                {showAnswer && (
                  <>
                    <hr className="border-gray-200 mb-6"/>
                    <div className="text-gray-700 whitespace-pre-wrap leading-relaxed text-base mb-6">
                      {current.answer || <span className="text-gray-400 italic">Sem resposta cadastrada.</span>}
                    </div>
                  </>
                )}

                {/* Stats */}
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span>Revisões: {current.reviewCount}</span>
                  <span>Erros: {current.wrongCount}</span>
                  <span>Intervalo: {current.intervalDays}d</span>
                  {current.nextReviewAt && <span>Próxima: {new Date(current.nextReviewAt).toLocaleDateString("pt-BR")}</span>}
                </div>
              </div>
            </div>

            {/* Botões */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              {!showAnswer ? (
                <button onClick={() => setShowAnswer(true)}
                  className="w-full py-3.5 bg-gray-900 hover:bg-gray-700 text-white font-bold rounded-xl text-base transition-colors">
                  Mostrar resposta
                </button>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-center text-gray-400 font-medium uppercase tracking-wide">Como foi?</p>
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { action: "again", label: "Errei",  interval: intervals?.again, cls: "bg-red-600 hover:bg-red-500 text-white" },
                      { action: "hard",  label: "Difícil", interval: intervals?.hard,  cls: "bg-orange-500 hover:bg-orange-400 text-white" },
                      { action: "good",  label: "Bom",    interval: intervals?.good,  cls: "bg-green-600 hover:bg-green-500 text-white" },
                      { action: "easy",  label: "Fácil",  interval: intervals?.easy,  cls: "bg-blue-600 hover:bg-blue-500 text-white" },
                    ].map(({ action, label, interval, cls }) => (
                      <button key={action} onClick={() => handleReview(action)} disabled={acting !== null}
                        className={`flex flex-col items-center py-3 rounded-xl font-bold transition-colors disabled:opacity-50 ${cls}`}>
                        <span className="text-xs opacity-80 mb-0.5">{interval}</span>
                        <span className="text-base">{acting === action ? "..." : label}</span>
                      </button>
                    ))}
                  </div>
                  <button onClick={() => { setShowAnswer(false); setReviewIndex(i => Math.max(i-1, 0)); }}
                    className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-700 transition-colors mx-auto">
                    <RotateCcw className="w-3 h-3"/> Desfazer
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
