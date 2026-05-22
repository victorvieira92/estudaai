"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock, Target, RefreshCw, Brain, AlertCircle, ArrowRight } from "lucide-react";

interface TodayData { totalHours: number; totalQuestions: number; accuracy: number; pendingReviews: number; lateReviews: number; pendingErrors: number; pendingFlashcards: number; subjectStats: {name:string;hours:number;accuracy:number}[]; }

export default function HojePage() {
  const [data, setData] = useState<TodayData|null>(null);
  useEffect(()=>{ fetch("/api/statistics").then(r=>r.json()).then(setData).catch(console.error); },[]);

  const actions = data ? [
    { label:"Sessão de Estudo", desc:"Inicie o cronômetro e registre seu estudo", href:"/sessao", icon:Clock, color:"bg-green-600", show:true },
    { label:`${data.pendingReviews} Revisões pendentes`, desc:data.lateReviews>0?`${data.lateReviews} atrasadas!`:"Mantenha o ritmo", href:"/revisoes", icon:RefreshCw, color:data.lateReviews>0?"bg-red-600":"bg-blue-600", show:data.pendingReviews>0 },
    { label:`${data.pendingErrors} Erros para revisar`, desc:"Caderno de erros com pendências", href:"/caderno", icon:AlertCircle, color:"bg-orange-600", show:data.pendingErrors>0 },
    { label:"Revisar Flashcards", desc:"Repetição espaçada — método Anki", href:"/flashcards", icon:Brain, color:"bg-purple-600", show:true },
  ].filter(a=>a.show) : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gray-950 text-white px-8 py-8">
        <p className="text-gray-400 text-sm">{new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long"})}</p>
        <h1 className="text-3xl font-bold mt-1">Painel do Dia</h1>
      </div>
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {data&&(
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[["Horas hoje",`${data.totalHours.toFixed(1)}h`,Clock],["Questões",data.totalQuestions,Target],["% Acertos",`${data.accuracy.toFixed(1)}%`,Target],["Revisões pendentes",data.pendingReviews,RefreshCw]].map(([l,v,I]:any)=>(
              <div key={l} className="bg-white rounded-xl border border-gray-200 p-4"><p className="text-xs text-gray-500 mb-1">{l}</p><p className="text-2xl font-bold text-gray-900">{v}</p></div>
            ))}
          </div>
        )}

        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Ações prioritárias</h2>
          {actions.map(a=>(
            <Link key={a.href} href={a.href} className="flex items-center justify-between gap-4 bg-white rounded-2xl border border-gray-200 p-5 hover:border-gray-400 transition-colors group">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 ${a.color} rounded-xl flex items-center justify-center shrink-0`}>
                  <a.icon className="w-5 h-5 text-white"/>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{a.label}</p>
                  <p className="text-sm text-gray-500">{a.desc}</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-gray-700 transition-colors shrink-0"/>
            </Link>
          ))}
        </div>

        <div className="bg-gray-950 text-white rounded-2xl p-6">
          <h2 className="font-semibold mb-3">📖 Dica do dia — Davi Lago</h2>
          <p className="text-gray-300 text-sm leading-relaxed">
            &quot;A quantidade de horas não é o que define a aprovação — é a <strong>qualidade do estudo ativo</strong>. 
            Leia com atenção, resolva questões imediatamente após cada tópico, e anote cada erro no caderno. 
            Revisar o caderno de erros é mais eficiente do que reler o PDF inteiro.&quot;
          </p>
        </div>
      </div>
    </div>
  );
}
