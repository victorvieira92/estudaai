"use client";
import { useEffect, useState } from "react";

interface Goal { id?:string; targetHours:number; targetQuestions:number; targetPdfs:number; targetReviews:number; targetFlashcards:number; }
interface Stats { totalHours:number; totalQuestions:number; completedPdfs:number; pendingReviews:number; }

export default function PlanejamentoPage() {
  const [goal, setGoal] = useState<Goal>({targetHours:20,targetQuestions:300,targetPdfs:10,targetReviews:20,targetFlashcards:100});
  const [stats, setStats] = useState<Stats|null>(null);
  const [saving, setSaving] = useState(false); const [saved, setSaved] = useState(false);

  useEffect(()=>{ fetch("/api/statistics").then(r=>r.json()).then(setStats).catch(console.error); },[]);

  const save = async (e:React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    // Salva localmente por enquanto (sem API de metas ainda)
    setTimeout(()=>{ setSaving(false); setSaved(true); setTimeout(()=>setSaved(false),3000); },500);
  };

  const Progress = ({label,current,target}:{label:string;current:number;target:number}) => {
    const pct = target>0?Math.min(100,Math.round((current/target)*100)):0;
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex justify-between items-center mb-2">
          <p className="text-sm font-medium text-gray-700">{label}</p>
          <p className="text-sm font-bold text-gray-900">{current} / {target}</p>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{width:`${pct}%`,background:pct>=100?"#10B981":pct>=70?"#3B82F6":"#111827"}}/>
        </div>
        <p className={`text-xs mt-1 font-medium ${pct>=100?"text-green-600":pct>=70?"text-blue-600":"text-gray-500"}`}>{pct}% da meta</p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gray-950 text-white px-8 py-8">
        <h1 className="text-3xl font-bold">Planejamento</h1>
        <p className="text-gray-400 text-sm mt-1">Defina metas semanais e acompanhe seu progresso</p>
      </div>
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* Metas */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Metas da semana</h2>
          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[["Horas de estudo","targetHours"],["Questões","targetQuestions"],["PDFs","targetPdfs"],["Revisões","targetReviews"],["Flashcards","targetFlashcards"]].map(([l,k])=>(
                <div key={k}>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">{l}</label>
                  <input type="number" min="0" value={(goal as any)[k]} onChange={e=>setGoal(g=>({...g,[k]:+e.target.value}))} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"/>
                </div>
              ))}
            </div>
            <button type="submit" disabled={saving} className="px-5 py-2.5 bg-gray-900 hover:bg-gray-700 text-white font-semibold rounded-xl text-sm disabled:opacity-50">
              {saving?"Salvando...":saved?"✓ Salvo!":"Salvar metas"}
            </button>
          </form>
        </div>

        {/* Progresso */}
        {stats&&(
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Progresso atual</h2>
            <Progress label="Horas de estudo" current={Math.round(stats.totalHours*10)/10} target={goal.targetHours}/>
            <Progress label="Questões resolvidas" current={stats.totalQuestions} target={goal.targetQuestions}/>
            <Progress label="PDFs concluídos" current={stats.completedPdfs} target={goal.targetPdfs}/>
            <Progress label="Revisões feitas" current={Math.max(0,goal.targetReviews-stats.pendingReviews)} target={goal.targetReviews}/>
          </div>
        )}

        {/* Dicas */}
        <div className="bg-gray-950 text-white rounded-2xl p-6 space-y-3">
          <h2 className="font-semibold">💡 Como definir metas realistas</h2>
          {["Comece com metas menores e aumente gradualmente conforme sua rotina permitir.",
            "Priorize horas líquidas sobre quantidade de questões — qualidade antes de volume.",
            "Nunca deixe revisões acumularem. Elas têm prazo!",
            "Metas de flashcards e caderno de erros são tão importantes quanto questões novas."
          ].map((t,i)=><p key={i} className="text-gray-400 text-sm">• {t}</p>)}
        </div>
      </div>
    </div>
  );
}
