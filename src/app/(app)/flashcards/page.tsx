"use client";
import { useState, useEffect, useMemo } from "react";
import { ChevronDown, ChevronRight, Download, RotateCcw, Pencil, X, Check } from "lucide-react";

type Origin = "FLASHCARD" | "ERROR_NOTE";
type Mode = "decks" | "review";

interface Card {
  id: string; origin: Origin; question: string; answer: string;
  topic: string; banca: string; difficulty: string; resolved: boolean;
  reviewCount: number; wrongCount: number; intervalDays: number;
  nextReviewAt: string; subjectId: string; subjectName: string;
}

interface DeckStats {
  key: string;        // "subjectName" ou "subjectName::topic"
  label: string;
  isSubdeck: boolean;
  parentKey?: string;
  newCount: number;
  learnCount: number;
  dueCount: number;
  expanded: boolean;
}

function isDue(c: Card) { return !c.nextReviewAt || new Date(c.nextReviewAt) <= new Date(); }
function isNew(c: Card) { return c.reviewCount === 0; }
function isLearning(c: Card) { return !isNew(c) && c.intervalDays <= 2; }
function isDueOnly(c: Card) { return !isNew(c) && !isLearning(c) && isDue(c); }

function getNextIntervals(card: Card) {
  const i = Math.max(card.intervalDays, 1);
  return {
    again: "1d",
    hard:  `${Math.min(Math.round(i * 1.2), 60)}d`,
    good:  `${Math.min(Math.round(Math.max(i * 2, i + 1)), 60)}d`,
    easy:  `${Math.min(Math.round(Math.max(i * 3.5, i + 4)), 60)}d`,
  };
}

export default function FlashcardsPage() {
  const [allCards, setAllCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>("decks");
  const [expandedDecks, setExpandedDecks] = useState<Set<string>>(new Set());
  const [selectedDeck, setSelectedDeck] = useState<string | null>(null); // null = todos
  const [studyMode, setStudyMode] = useState<"due"|"all">("due");

  // Revisão
  const [reviewIndex, setReviewIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [sessionDone, setSessionDone] = useState(false);
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
    const subList = Array.isArray(su) ? su : su?.subjects ?? [];
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

  // Builds deck tree
  const deckStats = useMemo((): DeckStats[] => {
    const result: DeckStats[] = [];
    const subjects = Array.from(new Set(allCards.map(c => c.subjectName))).sort();

    for (const sub of subjects) {
      const subCards = allCards.filter(c => c.subjectName === sub);
      const subKey = sub;
      result.push({
        key: subKey, label: sub, isSubdeck: false,
        newCount:   subCards.filter(isNew).length,
        learnCount: subCards.filter(isLearning).length,
        dueCount:   subCards.filter(isDueOnly).length,
        expanded: expandedDecks.has(subKey),
      });

      // Subdecks por tópico
      const topics = Array.from(new Set(subCards.filter(c => c.topic).map(c => c.topic))).sort();
      for (const t of topics) {
        const tCards = subCards.filter(c => c.topic === t);
        result.push({
          key: `${sub}::${t}`, label: t, isSubdeck: true, parentKey: subKey,
          newCount:   tCards.filter(isNew).length,
          learnCount: tCards.filter(isLearning).length,
          dueCount:   tCards.filter(isDueOnly).length,
          expanded: false,
        });
      }
    }
    return result;
  }, [allCards, expandedDecks]);

  const queue = useMemo(() => {
    let cards = allCards;
    if (selectedDeck) {
      if (selectedDeck.includes("::")) {
        const [sub, topic] = selectedDeck.split("::");
        cards = allCards.filter(c => c.subjectName === sub && c.topic === topic);
      } else {
        cards = allCards.filter(c => c.subjectName === selectedDeck);
      }
    }
    if (studyMode === "due") cards = cards.filter(isDue);
    return cards;
  }, [allCards, selectedDeck, studyMode]);

  const current = queue[reviewIndex];

  const totals = useMemo(() => ({
    new:      allCards.filter(isNew).length,
    learning: allCards.filter(isLearning).length,
    due:      allCards.filter(isDueOnly).length,
    total:    allCards.length,
  }), [allCards]);

  const startStudy = (deckKey: string | null, mode: "due"|"all" = "due") => {
    setSelectedDeck(deckKey);
    setStudyMode(mode);
    setReviewIndex(0);
    setShowAnswer(false);
    setSessionDone(false);
    setMode("review");
  };

  const handleReview = async (action: string) => {
    if (!current) return;
    setActing(action);
    await fetch("/api/flashcards/review", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: current.id, origin: current.origin, action }),
    });
    setActing(null); setShowAnswer(false);
    if (reviewIndex + 1 >= queue.length) setSessionDone(true);
    else setReviewIndex(i => i + 1);
    await load();
  };

  const openEdit = () => { if (!current) return; setEditQ(current.question); setEditA(current.answer); setEditing(true); };

  const saveEdit = async () => {
    if (!current) return;
    setSavingEdit(true);
    const url = current.origin === "FLASHCARD" ? `/api/flashcards/${current.id}` : `/api/error-notes/${current.id}`;
    const body = current.origin === "FLASHCARD"
      ? { question: editQ, answer: editA }
      : { title: editQ, description: editA };
    await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSavingEdit(false); setEditing(false); load();
  };

  const exportApkg = async () => {
    const res = await fetch("/api/flashcards/export");
    if (!res.ok) { alert("Erro ao exportar."); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "estudaai_flashcards.txt"; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin"/></div>;

  // ── TELA DE REVISÃO ──────────────────────────────────────────────────────
  if (mode === "review") {
    if (sessionDone || queue.length === 0) return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-6 px-6">
        <div className="text-6xl">🎉</div>
        <h1 className="text-3xl font-bold text-gray-900">Parabéns!</h1>
        <p className="text-gray-500 text-center max-w-sm">
          {queue.length === 0
            ? "Nenhum card para revisar com os filtros selecionados."
            : "Você concluiu todos os cards desta sessão!"}
        </p>
        <div className="grid grid-cols-3 gap-4 text-center">
          {[["Novos", totals.new, "text-blue-600"], ["Aprendendo", totals.learning, "text-red-600"], ["Revisão", totals.due, "text-green-600"]].map(([l, v, c]) => (
            <div key={l as string} className="bg-white rounded-2xl border border-gray-200 px-6 py-4">
              <p className={`text-2xl font-bold ${c}`}>{v}</p>
              <p className="text-xs text-gray-500 mt-1">{l}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-3 flex-wrap justify-center">
          <button onClick={() => setMode("decks")} className="px-6 py-3 border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold rounded-xl transition-colors">
            ← Voltar aos baralhos
          </button>
          <button onClick={() => { setSessionDone(false); setReviewIndex(0); load(); }}
            className="px-6 py-3 bg-gray-900 hover:bg-gray-700 text-white font-semibold rounded-xl transition-colors">
            Estudar de novo
          </button>
          {studyMode === "due" && (
            <button onClick={() => { setStudyMode("all"); setSessionDone(false); setReviewIndex(0); }}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-colors">
              Estudar todos os cards
            </button>
          )}
        </div>
      </div>
    );

    const intervals = getNextIntervals(current);
    const newC = queue.filter(isNew).length;
    const learnC = queue.filter(isLearning).length;
    const dueC = queue.filter(isDueOnly).length;

    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="bg-gray-950 text-white px-8 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-6">
            <button onClick={() => setMode("decks")} className="text-gray-400 hover:text-white text-sm transition-colors">← Baralhos</button>
            <span className="text-sm text-gray-400">{selectedDeck ?? "Todos os cards"}</span>
            <div className="flex items-center gap-4 text-sm font-mono font-bold">
              <span className="text-blue-400">{newC}</span>
              <span className="text-red-400">{learnC}</span>
              <span className="text-green-400">{dueC}</span>
            </div>
          </div>
          <div className="text-xs text-gray-500">{reviewIndex + 1} / {queue.length}</div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
          {editing ? (
            <div className="w-full max-w-2xl bg-white rounded-3xl border border-gray-200 shadow-sm p-8 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-900">Editar card</h3>
                <button onClick={() => setEditing(false)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg"><X className="w-4 h-4"/></button>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Frente</label>
                <textarea value={editQ} onChange={e => setEditQ(e.target.value)} rows={3} className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"/>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Verso</label>
                <textarea value={editA} onChange={e => setEditA(e.target.value)} rows={4} className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"/>
              </div>
              <div className="flex gap-2">
                <button onClick={saveEdit} disabled={savingEdit} className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 hover:bg-gray-700 text-white font-semibold rounded-xl text-sm disabled:opacity-50">
                  <Check className="w-4 h-4"/>{savingEdit ? "Salvando..." : "Salvar"}
                </button>
                <button onClick={() => setEditing(false)} className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm">Cancelar</button>
              </div>
            </div>
          ) : (
            <div className="w-full max-w-2xl space-y-4">
              <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="h-1 bg-gray-100">
                  <div className="h-full bg-gray-900 transition-all" style={{ width: `${(reviewIndex / Math.max(queue.length, 1)) * 100}%` }}/>
                </div>
                <div className="p-8">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${current.origin === "ERROR_NOTE" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"}`}>
                        {current.origin === "ERROR_NOTE" ? "Caderno" : "Flashcard"}
                      </span>
                      {current.subjectName && <span className="text-xs text-gray-500">{current.subjectName}</span>}
                      {current.topic && <span className="text-xs text-gray-400">› {current.topic}</span>}
                    </div>
                    <button onClick={openEdit} className="p-2 text-gray-300 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                      <Pencil className="w-4 h-4"/>
                    </button>
                  </div>
                  <div className="min-h-28 flex items-center mb-6">
                    <div className="text-2xl font-bold text-gray-900 leading-relaxed" dangerouslySetInnerHTML={{ __html: current.question }}/>
                  </div>
                  {showAnswer && (
                    <>
                      <hr className="border-gray-200 mb-6"/>
                      <div className="text-gray-700 leading-relaxed mb-6" dangerouslySetInnerHTML={{ __html: current.answer || "<em>Sem resposta.</em>" }}/>
                    </>
                  )}
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span>Revisões: {current.reviewCount}</span>
                    <span>Erros: {current.wrongCount}</span>
                    <span>Intervalo: {current.intervalDays}d</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                {!showAnswer ? (
                  <button onClick={() => setShowAnswer(true)} className="w-full py-3.5 bg-gray-900 hover:bg-gray-700 text-white font-bold rounded-xl text-base transition-colors">
                    Mostrar resposta
                  </button>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-center text-gray-400 font-medium uppercase tracking-wide">Como foi?</p>
                    <div className="grid grid-cols-4 gap-3">
                      {[
                        { action: "again", label: "Errei",  interval: intervals.again, cls: "bg-red-600 hover:bg-red-500 text-white" },
                        { action: "hard",  label: "Difícil", interval: intervals.hard,  cls: "bg-orange-500 hover:bg-orange-400 text-white" },
                        { action: "good",  label: "Bom",    interval: intervals.good,  cls: "bg-green-600 hover:bg-green-500 text-white" },
                        { action: "easy",  label: "Fácil",  interval: intervals.easy,  cls: "bg-blue-600 hover:bg-blue-500 text-white" },
                      ].map(({ action, label, interval, cls }) => (
                        <button key={action} onClick={() => handleReview(action)} disabled={acting !== null}
                          className={`flex flex-col items-center py-3 rounded-xl font-bold transition-colors disabled:opacity-50 ${cls}`}>
                          <span className="text-xs opacity-80 mb-0.5">{interval}</span>
                          <span className="text-base">{acting === action ? "..." : label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── TELA DE BARALHOS ─────────────────────────────────────────────────────
  const visibleDecks = deckStats.filter(d => !d.isSubdeck || expandedDecks.has(d.parentKey!));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gray-950 text-white px-8 py-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Flashcards</h1>
          <p className="text-gray-400 text-sm mt-1">Revisão espaçada — método Anki</p>
        </div>
        <div className="flex gap-3">
          <button onClick={exportApkg} className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm font-medium transition-colors">
            <Download className="w-4 h-4"/> Exportar para Anki
          </button>
          <a href="/flashcards/novo" className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm font-medium transition-colors">
            + Gerenciar cards
          </a>
        </div>
      </div>

      <div className="px-8 py-8 space-y-6">
        {/* Resumo geral */}
        <div className="grid grid-cols-4 gap-4">
          {[
            ["Total de cards", totals.total, "text-gray-900"],
            ["Novos", totals.new, "text-blue-600"],
            ["Aprendendo", totals.learning, "text-red-600"],
            ["Para revisar", totals.due, "text-green-600"],
          ].map(([l, v, c]) => (
            <div key={l as string} className="bg-white rounded-2xl border border-gray-200 p-5 text-center">
              <p className="text-xs text-gray-400 mb-1">{l}</p>
              <p className={`text-3xl font-bold ${c}`}>{v}</p>
            </div>
          ))}
        </div>

        {/* Tabela de baralhos estilo Anki */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[1fr_80px_80px_80px_140px] gap-0 px-6 py-3 border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <span>Baralho</span>
            <span className="text-center text-blue-500">Novo</span>
            <span className="text-center text-red-500">Aprendendo</span>
            <span className="text-center text-green-500">Revisão</span>
            <span></span>
          </div>

          {/* Linha: Todos os cards */}
          <div className="grid grid-cols-[1fr_80px_80px_80px_140px] items-center px-6 py-3.5 border-b border-gray-50 hover:bg-gray-50 transition-colors">
            <button onClick={() => startStudy(null, "due")} className="font-semibold text-gray-900 text-left hover:text-blue-600 transition-colors">
              Todos os baralhos
            </button>
            <span className="text-center text-blue-600 font-bold">{totals.new}</span>
            <span className="text-center text-red-600 font-bold">{totals.learning}</span>
            <span className="text-center text-green-600 font-bold">{totals.due}</span>
            <div className="flex gap-2 justify-end">
              <button onClick={() => startStudy(null, "due")} className="px-3 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded-lg hover:bg-gray-700 transition-colors">
                Estudar
              </button>
            </div>
          </div>

          {/* Decks e subdecks */}
          {visibleDecks.map(deck => {
            const hasSubdecks = deckStats.some(d => d.parentKey === deck.key);
            return (
              <div key={deck.key} className={`grid grid-cols-[1fr_80px_80px_80px_140px] items-center px-6 py-3.5 border-b border-gray-50 hover:bg-gray-50 transition-colors ${deck.isSubdeck ? "bg-gray-50/50" : ""}`}>
                <div className="flex items-center gap-2">
                  {deck.isSubdeck && <span className="w-4 shrink-0"/>}
                  {!deck.isSubdeck && hasSubdecks && (
                    <button onClick={() => setExpandedDecks(s => {
                      const n = new Set(s);
                      n.has(deck.key) ? n.delete(deck.key) : n.add(deck.key);
                      return n;
                    })} className="text-gray-400 hover:text-gray-700 transition-colors shrink-0">
                      {expandedDecks.has(deck.key) ? <ChevronDown className="w-4 h-4"/> : <ChevronRight className="w-4 h-4"/>}
                    </button>
                  )}
                  {!deck.isSubdeck && !hasSubdecks && <span className="w-4 shrink-0"/>}
                  <button onClick={() => startStudy(deck.key, "due")}
                    className={`text-left hover:text-blue-600 transition-colors ${deck.isSubdeck ? "text-sm text-gray-700 pl-2" : "font-semibold text-gray-900"}`}>
                    {deck.isSubdeck ? `› ${deck.label}` : deck.label}
                  </button>
                </div>
                <span className="text-center text-blue-600 font-bold">{deck.newCount}</span>
                <span className="text-center text-red-600 font-bold">{deck.learnCount}</span>
                <span className="text-center text-green-600 font-bold">{deck.dueCount}</span>
                <div className="flex gap-2 justify-end">
                  {(deck.newCount + deck.learnCount + deck.dueCount) > 0 && (
                    <button onClick={() => startStudy(deck.key, "due")} className="px-3 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded-lg hover:bg-gray-700 transition-colors">
                      Estudar
                    </button>
                  )}
                  <button onClick={() => startStudy(deck.key, "all")} className="px-3 py-1.5 border border-gray-300 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-100 transition-colors">
                    Todos
                  </button>
                </div>
              </div>
            );
          })}

          {allCards.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              Nenhum card cadastrado.{" "}
              <a href="/flashcards/novo" className="text-blue-600 hover:underline">Criar meu primeiro card</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
