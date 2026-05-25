"use client";
import { useEffect, useState } from "react";
import { Clock, Target, CheckCircle, XCircle, ChevronDown, ChevronUp } from "lucide-react";

interface Session {
  id:             string;
  subjectName:    string;
  subjectId:      string;
  hours:          number;
  hoursFormatted: string;
  questions:      number;
  correct:        number;
  wrong:          number;
  accuracy:       number | null;
  createdAt:      string;
}

interface DayGroup {
  date:                string;
  totalHours:          number;
  totalHoursFormatted: string;
  sessions:            Session[];
}

const BG = "#1B4040";

function formatDate(ds: string): { label: string; sub: string } {
  const d    = new Date(ds + "T12:00:00");
  const today = new Date(); today.setHours(0,0,0,0);
  const dDay  = new Date(ds + "T12:00:00"); dDay.setHours(0,0,0,0);
  const diff  = Math.round((today.getTime() - dDay.getTime()) / 86400000);

  const label = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  const DAYS  = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  const sub   = diff === 0 ? "Hoje" : diff === 1 ? "Ontem" : DAYS[d.getDay()];
  return { label, sub };
}

export default function HistoricoPage() {
  const [data,     setData]     = useState<DayGroup[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/historico")
      .then(r => r.json())
      .then(d => {
        setData(Array.isArray(d) ? d : []);
        // Expande os 3 primeiros dias automaticamente
        if (Array.isArray(d) && d.length > 0) {
          setExpanded(new Set(d.slice(0, 3).map((g: DayGroup) => g.date)));
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const toggle = (date: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(date) ? next.delete(date) : next.add(date);
      return next;
    });

  // Totais globais
  const totalHoursAll   = data.reduce((a, g) => a + g.totalHours, 0);
  const totalQuestionsAll = data.reduce((a, g) => g.sessions.reduce((b, s) => b + s.questions, a), 0);
  const totalCorrectAll   = data.reduce((a, g) => g.sessions.reduce((b, s) => b + s.correct, a), 0);
  const globalAccuracy    = totalQuestionsAll > 0
    ? Math.round((totalCorrectAll / totalQuestionsAll) * 100)
    : null;

  function fmtHours(h: number) {
    const hh = Math.floor(h); const mm = Math.round((h - hh) * 60);
    return mm > 0 ? `${hh}h${mm.toString().padStart(2,"0")}min` : `${hh}h`;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div
        className="text-white px-8"
        style={{ backgroundColor: BG, minHeight: "124px", display: "flex", flexDirection: "column", justifyContent: "center" }}
      >
        <h1 className="text-3xl font-bold">Histórico</h1>
        <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.6)" }}>
          Todos os seus registros de estudo
        </p>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">

        {/* KPIs globais */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Tempo total",    value: fmtHours(totalHoursAll),          color: "text-blue-600"  },
            { label: "Desempenho",     value: globalAccuracy !== null ? `${globalAccuracy}%` : "—",
              color: globalAccuracy !== null ? (globalAccuracy >= 70 ? "text-green-600" : globalAccuracy >= 50 ? "text-yellow-600" : "text-red-600") : "text-gray-400" },
            { label: "Total questões", value: totalQuestionsAll,                color: "text-purple-600"},
            { label: "Dias estudados", value: data.length,                      color: "text-gray-900"  },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 mb-1">{label}</p>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Lista de dias */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: BG }} />
          </div>
        ) : data.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <Clock className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Nenhum estudo registrado ainda</p>
            <p className="text-gray-400 text-sm mt-1">Suas sessões aparecerão aqui depois de registrar estudos.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.map(group => {
              const { label, sub } = formatDate(group.date);
              const isOpen = expanded.has(group.date);
              const dayQuestions = group.sessions.reduce((a, s) => a + s.questions, 0);
              const dayCorrect   = group.sessions.reduce((a, s) => a + s.correct, 0);
              const dayAccuracy  = dayQuestions > 0 ? Math.round((dayCorrect / dayQuestions) * 100) : null;

              return (
                <div key={group.date} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  {/* Cabeçalho do dia */}
                  <button
                    onClick={() => toggle(group.date)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-left">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-gray-900">{label}</p>
                          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{sub}</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {group.sessions.length} {group.sessions.length === 1 ? "sessão" : "sessões"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1.5 text-blue-600 font-semibold">
                          <Clock className="w-3.5 h-3.5" />
                          {group.totalHoursFormatted}
                        </span>
                        {dayQuestions > 0 && (
                          <span className="flex items-center gap-1.5 text-gray-600">
                            <Target className="w-3.5 h-3.5" />
                            {dayQuestions} questões
                          </span>
                        )}
                        {dayAccuracy !== null && (
                          <span className={`font-semibold ${dayAccuracy >= 70 ? "text-green-600" : dayAccuracy >= 50 ? "text-yellow-600" : "text-red-600"}`}>
                            {dayAccuracy}%
                          </span>
                        )}
                      </div>
                      {isOpen
                        ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
                        : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                      }
                    </div>
                  </button>

                  {/* Sessões do dia */}
                  {isOpen && (
                    <div className="border-t border-gray-100 divide-y divide-gray-50">
                      {group.sessions.map(s => (
                        <div key={s.id} className="flex items-center justify-between px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: BG }}
                            />
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{s.subjectName}</p>
                              <p className="text-xs text-gray-400">
                                {new Date(s.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-5 text-sm">
                            <span className="flex items-center gap-1 text-blue-600 font-medium">
                              <Clock className="w-3.5 h-3.5" />
                              {s.hoursFormatted}
                            </span>
                            {s.questions > 0 && (<>
                              <span className="flex items-center gap-1 text-green-600">
                                <CheckCircle className="w-3.5 h-3.5" />
                                {s.correct}
                              </span>
                              <span className="flex items-center gap-1 text-red-500">
                                <XCircle className="w-3.5 h-3.5" />
                                {s.wrong}
                              </span>
                              {s.accuracy !== null && (
                                <span className={`font-bold text-xs px-2 py-0.5 rounded-full ${
                                  s.accuracy >= 70 ? "bg-green-100 text-green-700"
                                  : s.accuracy >= 50 ? "bg-yellow-100 text-yellow-700"
                                  : "bg-red-100 text-red-700"
                                }`}>
                                  {s.accuracy}%
                                </span>
                              )}
                            </>)}
                            {s.questions === 0 && (
                              <span className="text-xs text-gray-400">sem questões</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
