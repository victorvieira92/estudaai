"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Clock, RefreshCw, AlertCircle,
  Target, ArrowRight, CheckCircle, Zap, History,
} from "lucide-react";

interface Block {
  start: string;
  end: string;
  label: string;
  duration: string;
  subject: {
    id: string;
    name: string;
    score: number;
    nextPdf: { title: string } | null;
    pendingErrors: number;
    accuracy: number | null;
  } | null;
}

// ✅ NOVO: histórico de sessões do dia
interface SessionHistory {
  id:          string;
  subjectName: string;
  subjectId:   string;
  hours:       number;
  questions:   number;
  correct:     number;
  wrong:       number;
  createdAt:   string;
}

interface Review    { id: string; type: string; pdf: { title: string; topic: { subject: { name: string } } } }
interface ErrorNote { id: string; title: string; wrongCount: number; subject: { name: string } }

interface Data {
  todayBlocks:    Block[];
  todayHistory:   SessionHistory[];  // ✅ NOVO
  reviews:        Review[];
  criticalErrors: ErrorNote[];
  todayStats:     { hours: number; questions: number };
  weekStats:      { hours: number; questions: number; targetHours: number };
  nextSubject:    { id: string; name: string; score: number; nextPdf: { title: string } | null } | null;
  nextBlockType:  string | null;
  weekDay:        number;
}

const DAYS = [
  "Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira",
  "Quinta-feira", "Sexta-feira", "Sábado",
];

function pct(v: number, t: number) {
  if (!t) return 0;
  return Math.min(100, Math.round((v / t) * 100));
}

function fmtHours(h: number): string {
  const totalMin = Math.round(h * 60);
  if (totalMin < 60) return `${totalMin}min`;
  const hh = Math.floor(totalMin / 60);
  const mm  = totalMin % 60;
  return mm > 0 ? `${hh}h${mm}min` : `${hh}h`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function HojePage() {
  const [data,            setData]            = useState<Data | null>(null);
  const [loading,         setLoading]         = useState(true);
  const [completedBlocks, setCompletedBlocks] = useState<number[]>([]);

  useEffect(() => {
    fetch(`/api/schedule?cycleDay=${localStorage.getItem('estudaai_cycle_day') ?? '0'}`)
      .then(r => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!data) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center text-red-500">
      Erro ao carregar.
    </div>
  );

  const today   = new Date();
  const dateStr = today.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const hoursTarget = data.weekStats.targetHours;
  const hoursProgress = pct(data.weekStats.hours, hoursTarget);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="text-white px-8" style={{ backgroundColor: "#1B4040", minHeight: "124px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <p className="text-gray-400 text-sm">{DAYS[data.weekDay]}, {dateStr}</p>
        <h1 className="text-3xl font-bold mt-1">Painel do Dia</h1>
        <p className="text-gray-400 text-sm mt-1">Seu plano de estudos personalizado para hoje</p>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* KPIs de hoje */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Horas hoje",        value: `${data.todayStats.hours.toFixed(1)}h`, icon: Clock,       color: "text-blue-600"   },
            { label: "Questões hoje",     value: data.todayStats.questions,              icon: Target,      color: "text-purple-600" },
            { label: "Revisões pendentes",value: data.reviews.length,                    icon: RefreshCw,   color: data.reviews.length       > 0 ? "text-red-600"    : "text-green-600" },
            { label: "Erros críticos",    value: data.criticalErrors.length,             icon: AlertCircle, color: data.criticalErrors.length > 0 ? "text-orange-600" : "text-green-600" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-4 h-4 ${color}`} />
                <p className="text-xs text-gray-500">{label}</p>
              </div>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Progresso semanal — só horas, sem meta de questões */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Progresso da semana</h2>
          {hoursTarget > 0 ? (
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium text-gray-700">Horas</span>
                <span className="text-gray-500">
                  {data.weekStats.hours.toFixed(1)}h / {hoursTarget.toFixed(1)}h
                </span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width:           `${hoursProgress}%`,
                    backgroundColor: hoursProgress >= 100 ? "#10B981"
                                   : hoursProgress >= 60  ? "#3B82F6"
                                   : "#111827",
                  }}
                />
              </div>
              <p className={`text-xs mt-1 font-medium ${hoursProgress >= 100 ? "text-green-600" : "text-gray-500"}`}>
                {hoursProgress}% da meta {hoursProgress >= 100 ? "✓" : ""}
              </p>

              {/* Questões da semana — exibe sempre, sem barra de meta */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                <span className="text-sm font-medium text-gray-700">Questões</span>
                <span className="text-sm font-semibold text-gray-900">
                  {data.weekStats.questions} resolvidas esta semana
                </span>
              </div>
            </div>
          ) : (
            // Sem blocos configurados = sem meta de horas
            <p className="text-sm text-gray-400">
              Configure seu{" "}
              <Link href="/calendario-ciclo" className="text-blue-600 hover:underline">
                calendário semanal
              </Link>{" "}
              para ver o progresso de horas aqui.
            </p>
          )}
        </div>

        {/* Próxima ação recomendada */}
        {data.nextSubject && (
          <div className="text-white rounded-2xl p-6" style={{ backgroundColor: "#1B4040" }}>
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-5 h-5 text-yellow-400" />
              <span className="text-xs text-gray-400 uppercase tracking-widest font-medium">
                Próxima ação recomendada
              </span>
            </div>
            <p className="text-2xl font-bold mb-1">{data.nextSubject.name}</p>
