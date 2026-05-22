"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Clock, BookOpen, Target, RefreshCw, Brain, AlertCircle } from "lucide-react";

interface Stats { totalHours: number; totalQuestions: number; accuracy: number; completedPdfs: number; totalPdfs: number; pendingErrors: number; pendingReviews: number; lateReviews: number; subjectStats: { name: string; hours: number; accuracy: number }[]; }

export default function DashboardPage() {
  const { data: session } = useSession();
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/statistics").then((r) => r.json()).then(setStats).catch(console.error);
  }, []);

  const kpis = stats ? [
    { label: "Horas líquidas", value: `${stats.totalHours.toFixed(1)}h`, icon: Clock, color: "text-blue-600" },
    { label: "Questões", value: stats.totalQuestions, icon: Target, color: "text-purple-600" },
    { label: "% Acertos", value: `${stats.accuracy.toFixed(1)}%`, icon: BookOpen, color: stats.accuracy >= 70 ? "text-green-600" : "text-red-600" },
    { label: "PDFs concluídos", value: `${stats.completedPdfs}/${stats.totalPdfs}`, icon: BookOpen, color: "text-gray-700" },
    { label: "Revisões pendentes", value: stats.pendingReviews, icon: RefreshCw, color: stats.lateReviews > 0 ? "text-red-600" : "text-gray-700" },
    { label: "Erros pendentes", value: stats.pendingErrors, icon: AlertCircle, color: stats.pendingErrors > 0 ? "text-red-600" : "text-gray-700" },
  ] : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gray-950 text-white px-8 py-8">
        <p className="text-gray-400 text-sm">Bem-vindo de volta,</p>
        <h1 className="text-3xl font-bold mt-1">{session?.user?.name ?? "Concurseiro"} 👋</h1>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {stats ? kpis.map((k) => (
            <div key={k.label} className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">{k.label}</p>
              <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
            </div>
          )) : Array.from({length:6}).map((_,i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
              <div className="h-3 bg-gray-100 rounded mb-2 w-3/4" />
              <div className="h-7 bg-gray-100 rounded w-1/2" />
            </div>
          ))}
        </div>

        {/* Progresso por disciplina */}
        {stats?.subjectStats && stats.subjectStats.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4">Progresso por disciplina</h2>
            <div className="space-y-4">
              {stats.subjectStats.map((s) => (
                <div key={s.name}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{s.name}</span>
                    <span className="text-gray-500">{s.hours.toFixed(1)}h • {s.accuracy.toFixed(0)}% acerto</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-gray-900 rounded-full transition-all" style={{ width: `${Math.min(100, s.accuracy)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dicas do método Davi Lago */}
        <div className="bg-gray-950 text-white rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-4">💡 Método de estudo — Davi Lago</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { title: "Leitura ativa", desc: "Leia o PDF com atenção, anote dúvidas e marque os pontos principais. Não apenas passe os olhos." },
              { title: "Questões imediatas", desc: "Após cada tópico, resolva questões. O erro agora é aprendizado. Registre tudo no Caderno de Erros." },
              { title: "Revisão espaçada", desc: "Revise em 24h, 7 dias e 30 dias. O sistema já agenda automaticamente para você." },
            ].map((tip) => (
              <div key={tip.title} className="bg-gray-800 rounded-xl p-4">
                <p className="font-semibold text-sm mb-1">{tip.title}</p>
                <p className="text-gray-400 text-xs leading-relaxed">{tip.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
