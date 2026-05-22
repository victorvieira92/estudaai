"use client";
import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

interface Stats { totalHours: number; totalQuestions: number; accuracy: number; totalWrong: number; completedPdfs: number; totalPdfs: number; pendingErrors: number; resolvedErrors: number; pendingReviews: number; lateReviews: number; subjectStats: {name:string;hours:number;accuracy:number;errors:number}[]; weeklyHours: {day:string;hours:number}[]; criticalErrors: {title:string;subject:string;difficulty:string;reviewCount:number;wrongCount:number}[]; }

export default function EstatisticasPage() {
  const [data, setData] = useState<Stats|null>(null);
  useEffect(()=>{ fetch("/api/statistics").then(r=>r.json()).then(setData).catch(console.error); },[]);

  if(!data) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin"/></div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gray-950 text-white px-8 py-8"><h1 className="text-3xl font-bold">Estatísticas</h1><p className="text-gray-400 text-sm mt-1">Seu desempenho completo</p></div>
      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[["Horas líquidas",`${data.totalHours.toFixed(1)}h`,"text-gray-900"],["Questões",data.totalQuestions,"text-gray-900"],["% Acertos",`${data.accuracy.toFixed(1)}%`,data.accuracy>=70?"text-green-600":data.accuracy>=50?"text-yellow-600":"text-red-600"],["Erros",data.totalWrong,data.totalWrong>0?"text-red-600":"text-gray-900"],["PDFs concluídos",`${data.completedPdfs}/${data.totalPdfs}`,"text-gray-900"],["Erros pendentes",data.pendingErrors,data.pendingErrors>0?"text-red-600":"text-gray-900"],["Revisões pendentes",data.pendingReviews,"text-gray-900"],["Revisões atrasadas",data.lateReviews,data.lateReviews>0?"text-red-600":"text-gray-900"]].map(([l,v,c])=>(
            <div key={l as string} className="bg-white rounded-xl border border-gray-200 px-5 py-4"><p className="text-xs text-gray-500 mb-1">{l}</p><p className={`text-3xl font-bold ${c}`}>{v}</p></div>
          ))}
        </div>

        {data.weeklyHours.length>0&&(
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <p className="text-base font-semibold mb-4">Horas estudadas esta semana</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data.weeklyHours} margin={{top:5,right:10,left:-20,bottom:5}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6"/>
                <XAxis dataKey="day" tick={{fontSize:12}}/>
                <YAxis tick={{fontSize:12}}/>
                <Tooltip formatter={(v:number)=>[`${v.toFixed(1)}h`,"Horas"]}/>
                <Bar dataKey="hours" fill="#111827" radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            {title:"Aproveitamento",data:[{name:"Acertos",value:data.totalQuestions-data.totalWrong},{name:"Erros",value:data.totalWrong}],colors:["#10B981","#EF4444"]},
            {title:"Erros",data:[{name:"Pendentes",value:data.pendingErrors},{name:"Resolvidos",value:data.resolvedErrors}],colors:["#EF4444","#10B981"]},
            {title:"PDFs",data:[{name:"Concluídos",value:data.completedPdfs},{name:"Pendentes",value:data.totalPdfs-data.completedPdfs}],colors:["#111827","#D1D5DB"]},
          ].map(({title,data:d,colors})=>(
            <div key={title} className="bg-white rounded-2xl border border-gray-200 p-6">
              <p className="text-base font-semibold mb-2">{title}</p>
              {d.reduce((a,x)=>a+x.value,0)===0?<div className="h-36 flex items-center justify-center text-gray-400 text-sm">Sem dados</div>:(
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart><Pie data={d} cx="50%" cy="50%" innerRadius={45} outerRadius={65} dataKey="value" paddingAngle={3}>{d.map((_,i)=><Cell key={i} fill={colors[i%colors.length]}/>)}</Pie><Legend iconSize={10}/><Tooltip/></PieChart>
                </ResponsiveContainer>
              )}
            </div>
          ))}
        </div>

        {data.subjectStats.length>0&&(
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <p className="text-base font-semibold mb-4">Horas por disciplina</p>
            <ResponsiveContainer width="100%" height={Math.max(160,data.subjectStats.length*48)}>
              <BarChart data={data.subjectStats} layout="vertical" margin={{top:5,right:50,left:80,bottom:5}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6"/>
                <XAxis type="number" tick={{fontSize:12}}/>
                <YAxis type="category" dataKey="name" tick={{fontSize:12}} width={80}/>
                <Tooltip formatter={(v:number)=>[`${v.toFixed(1)}h`,"Horas"]}/>
                <Bar dataKey="hours" fill="#111827" radius={[0,4,4,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {data.criticalErrors.length>0&&(
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <p className="text-base font-semibold mb-4">Erros mais críticos</p>
            <div className="space-y-2">
              {data.criticalErrors.map((e,i)=>(
                <div key={i} className="flex items-start justify-between gap-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="flex-1 min-w-0"><p className="text-sm font-medium text-gray-900 truncate">{e.title}</p><p className="text-xs text-gray-500">{e.subject}</p></div>
                  <div className="flex items-center gap-3 text-xs shrink-0">
                    <span className={`px-2 py-0.5 rounded-full font-medium ${e.difficulty==="Alta"?"bg-red-100 text-red-700":e.difficulty==="Media"?"bg-yellow-100 text-yellow-700":"bg-green-100 text-green-700"}`}>{e.difficulty}</span>
                    <span className="text-red-600 font-semibold">Errou {e.wrongCount}x</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
