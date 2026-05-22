"use client";
import { useState, useEffect } from "react";
import { CheckCircle } from "lucide-react";

interface Review { id: string; type: string; reviewDate: string; completed: boolean; pdf: { title: string; topic: { name: string; subject: { name: string } } }; }

export default function RevisoesPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const load = () => fetch("/api/reviews").then(r=>r.json()).then(d=>setReviews(Array.isArray(d)?d:[])).catch(console.error);
  useEffect(()=>{ load(); },[]);

  const complete = async (id: string) => {
    await fetch("/api/reviews",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id})});
    load();
  };

  const today = new Date(); today.setHours(0,0,0,0);
  const pending = reviews.filter(r=>!r.completed);
  const late = pending.filter(r=>new Date(r.reviewDate)<today);
  const dueToday = pending.filter(r=>{ const d=new Date(r.reviewDate); d.setHours(0,0,0,0); return d.getTime()===today.getTime(); });
  const upcoming = pending.filter(r=>new Date(r.reviewDate)>today);

  const Section = ({title,items,color}:{title:string;items:Review[];color:string}) => items.length===0?null:(
    <div>
      <h2 className={`text-sm font-semibold uppercase tracking-wide mb-3 ${color}`}>{title} ({items.length})</h2>
      <div className="space-y-2">
        {items.map(r=>(
          <div key={r.id} className="bg-white rounded-xl border border-gray-200 px-5 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">{r.pdf.title}</p>
              <p className="text-xs text-gray-500">{r.pdf.topic.subject.name} • {r.pdf.topic.name} • Revisão {r.type}</p>
              <p className="text-xs text-gray-400">{new Date(r.reviewDate).toLocaleDateString("pt-BR")}</p>
            </div>
            <button onClick={()=>complete(r.id)} className="flex items-center gap-1.5 px-3 py-2 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-xs font-medium transition-colors">
              <CheckCircle className="w-3.5 h-3.5"/>Revisei
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gray-950 text-white px-8 py-8">
        <h1 className="text-3xl font-bold">Revisões</h1>
        <p className="text-gray-400 text-sm mt-1">Revisões espaçadas: 24h • 7 dias • 30 dias</p>
      </div>
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-4">
        <div className="grid grid-cols-3 gap-4">
          {[["Atrasadas",late.length,"text-red-600"],["Hoje",dueToday.length,"text-blue-600"],["Próximas",upcoming.length,"text-gray-700"]].map(([l,v,c])=>(
            <div key={l as string} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">{l}</p>
              <p className={`text-3xl font-bold ${c}`}>{v}</p>
            </div>
          ))}
        </div>
        <Section title="Atrasadas" items={late} color="text-red-600"/>
        <Section title="Para hoje" items={dueToday} color="text-blue-600"/>
        <Section title="Próximas" items={upcoming} color="text-gray-600"/>
        {pending.length===0&&<div className="text-center py-12 text-gray-400">Nenhuma revisão pendente. Ótimo trabalho! 🎉</div>}
      </div>
    </div>
  );
}
