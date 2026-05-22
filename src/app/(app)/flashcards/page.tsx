"use client";
import { useState, useEffect } from "react";
import { Plus, RotateCcw } from "lucide-react";

interface Subject { id: string; name: string; }
interface Flashcard { id: string; question: string; answer: string; difficulty: string; intervalDays: number; reviewCount: number; wrongCount: number; nextReviewAt: string | null; resolved: boolean; subject: { name: string }; }

export default function FlashcardsPage() {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [mode, setMode] = useState<"list"|"review">("list");
  const [current, setCurrent] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [subjectId, setSubjectId] = useState(""); const [question, setQuestion] = useState(""); const [answer, setAnswer] = useState(""); const [topic, setTopic] = useState(""); const [banca, setBanca] = useState(""); const [difficulty, setDifficulty] = useState("Media");
  const [saving, setSaving] = useState(false);

  const load = () => fetch("/api/flashcards").then(r=>r.json()).then(d=>setCards(Array.isArray(d)?d:[])).catch(console.error);
  useEffect(()=>{ load(); fetch("/api/subjects").then(r=>r.json()).then(d=>setSubjects(Array.isArray(d)?d:(d.subjects??[]))).catch(console.error); },[]);

  const toReview = cards.filter(c=>!c.resolved && (!c.nextReviewAt || new Date(c.nextReviewAt)<=new Date()));
  const currentCard = toReview[current];

  const addCard = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    const res = await fetch("/api/flashcards",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question,answer,subjectId,topic,banca,difficulty})});
    if(res.ok){setQuestion("");setAnswer("");setTopic("");setBanca("");load();}
    setSaving(false);
  };

  const answer_ = async (result: string) => {
    if(!currentCard) return;
    await fetch("/api/flashcards",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:currentCard.id,result})});
    if(current+1>=toReview.length){setMode("list");setCurrent(0);}else{setCurrent(c=>c+1);}
    setShowAnswer(false);
    load();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gray-950 text-white px-8 py-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Flashcards</h1>
          <p className="text-gray-400 text-sm mt-1">Revisão com repetição espaçada — método Anki</p>
        </div>
        {toReview.length>0&&mode==="list"&&(
          <button onClick={()=>{setMode("review");setCurrent(0);setShowAnswer(false);}} className="px-5 py-2.5 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-xl text-sm transition-colors">
            Revisar {toReview.length} card(s)
          </button>
        )}
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {mode==="review" && currentCard ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-8">
            <div className="flex justify-between items-center mb-6">
              <span className="text-sm text-gray-500">{current+1} de {toReview.length}</span>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${currentCard.difficulty==="Alta"?"bg-red-100 text-red-700":currentCard.difficulty==="Media"?"bg-yellow-100 text-yellow-700":"bg-green-100 text-green-700"}`}>{currentCard.difficulty}</span>
            </div>
            <div className="h-1 bg-gray-100 rounded-full mb-8"><div className="h-full bg-gray-900 rounded-full" style={{width:`${((current)/toReview.length)*100}%`}}/></div>
            <p className="text-lg font-semibold mb-6 text-center">{currentCard.question}</p>
            {!showAnswer ? (
              <button onClick={()=>setShowAnswer(true)} className="w-full py-3 bg-gray-900 hover:bg-gray-700 text-white font-semibold rounded-xl text-sm transition-colors">Mostrar resposta</button>
            ):(
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <p className="text-sm text-green-800 font-medium mb-1">Resposta</p>
                  <p className="text-sm text-green-900">{currentCard.answer}</p>
                </div>
                <p className="text-sm text-center text-gray-500">Como foi?</p>
                <div className="grid grid-cols-4 gap-2">
                  {[["wrong","Errei","bg-red-600 hover:bg-red-500"],["hard","Difícil","bg-orange-500 hover:bg-orange-400"],["medium","Médio","bg-yellow-500 hover:bg-yellow-400"],["easy","Fácil","bg-green-600 hover:bg-green-500"]].map(([r,l,cls])=>(
                    <button key={r} onClick={()=>answer_(r)} className={`py-2.5 ${cls} text-white font-semibold rounded-xl text-sm transition-colors`}>{l}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ):(
          <>
            <div className="grid grid-cols-3 gap-4">
              {[["Total",cards.length,"text-gray-900"],["Para revisar",toReview.length,"text-blue-600"],["Resolvidos",cards.filter(c=>c.resolved).length,"text-green-600"]].map(([l,v,c])=>(
                <div key={l as string} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                  <p className="text-xs text-gray-500 mb-1">{l}</p>
                  <p className={`text-3xl font-bold ${c}`}>{v}</p>
                </div>
              ))}
            </div>

            {/* Novo card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold mb-4">Novo flashcard</h2>
              <form onSubmit={addCard} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Disciplina *</label>
                    <select value={subjectId} onChange={e=>setSubjectId(e.target.value)} required className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                      <option value="">Selecione</option>
                      {subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Dificuldade</label>
                    <select value={difficulty} onChange={e=>setDifficulty(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                      {["Baixa","Media","Alta"].map(d=><option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Pergunta *</label>
                  <textarea value={question} onChange={e=>setQuestion(e.target.value)} required rows={2} placeholder="Ex: O que é despesa antecipada?" className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"/>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Resposta *</label>
                  <textarea value={answer} onChange={e=>setAnswer(e.target.value)} required rows={3} placeholder="Resposta completa..." className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"/>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {[["Tema",topic,setTopic,"Ex: CPC 27"],["Banca",banca,setBanca,"Ex: FGV"]].map(([l,v,s,p]:any)=>(
                    <div key={l}>
                      <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">{l}</label>
                      <input value={v} onChange={e=>s(e.target.value)} placeholder={p} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"/>
                    </div>
                  ))}
                </div>
                <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 hover:bg-gray-700 text-white font-semibold rounded-xl text-sm transition-colors disabled:opacity-50">
                  <Plus className="w-4 h-4"/>Adicionar flashcard
                </button>
              </form>
            </div>

            {/* Lista de cards */}
            <div className="space-y-2">
              {cards.slice(0,20).map(c=>(
                <div key={c.id} className="bg-white rounded-xl border border-gray-200 px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900 truncate max-w-xs">{c.question}</p>
                    <p className="text-xs text-gray-500">{c.subject.name} • Intervalo: {c.intervalDays}d • Revisões: {c.reviewCount}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.difficulty==="Alta"?"bg-red-100 text-red-700":c.difficulty==="Media"?"bg-yellow-100 text-yellow-700":"bg-green-100 text-green-700"}`}>{c.difficulty}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
