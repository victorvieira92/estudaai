"use client";
import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

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

// Cores por matéria (rotação)
const SUBJECT_COLORS = [BG, "#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#14B8A6", "#EF4444"];
const subjectColorCache = new Map<string, string>();
let colorIdx = 0;
function getSubjectColor(id: string): string {
  if (!subjectColorCache.has(id)) {
    subjectColorCache.set(id, SUBJECT_COLORS[colorIdx % SUBJECT_COLORS.length]);
    colorIdx++;
  }
  return subjectColorCache.get(id)!;
}

function fmtH(h: number) {
  const totalMin = Math.round(h * 60);
  if (totalMin < 60) return `${totalMin}min`;
  const hh = Math.floor(totalMin / 60); const mm = totalMin % 60;
  return mm > 0 ? `${hh}h${mm.toString().padStart(2,"0")}min` : `${hh}h`;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function parseDateLabel(ds: string): { day: string; dayOfWeek: string; month: string; year: string; isToday: boolean } {
  const d = new Date(ds + "T12:00:00");
  const today = new Date(); today.setHours(0,0,0,0);
  const dDay  = new Date(ds + "T12:00:00"); dDay.setHours(0,0,0,0);
  const diff  = Math.round((today.getTime() - dDay.getTime()) / 86400000);
  const DAYS  = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  const MONTHS = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];
  return {
    day:       String(d.getDate()).padStart(2,"0"),
    dayOfWeek: DAYS[d.getDay()].toUpperCase(),
    month:     MONTHS[d.getMonth()] + "/" + String(d.getFullYear()).slice(2),
    year:      String(d.getFullYear()),
    isToday:   diff === 0,
  };
}

export default function HistoricoPage() {
  const [data,    setData]    = useState<DayGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/historico")
      .then(r => r.json())
      .then(d => setData(Array.isArray(d) ? d : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Totais globais
  const totalHours     = data.reduce((a, g) => a + g.totalHours, 0);
  const totalQuestions = data.reduce((a, g) => g.sessions.reduce((b, s) => b + s.questions, a), 0);
  const totalCorrect   = data.reduce((a, g) => g.sessions.reduce((b, s) => b + s.correct, a), 0);
  const totalWrong     = data.reduce((a, g) => g.sessions.reduce((b, s) => b + s.wrong, a), 0);
  const globalAccuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : null;

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

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* KPIs globais — estilo Estudei */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "TEMPO DE ESTUDO",  value: fmtH(totalHours),                         color: "text-gray-900" },
            { label: "DESEMPENHO",
              sub:   totalQuestions > 0 ? `${totalCorrect} Acertos · ${totalWrong} Erros` : "sem dados",
              value: globalAccuracy !== null ? `${globalAccuracy}%` : "—",
              color: globalAccuracy !== null
                ? globalAccuracy >= 70 ? "text-green-600"
                  : globalAccuracy >= 50 ? "text-yellow-600"
                  : "text-red-600"
                : "text-gray-400",
            },
            { label: "TOTAL QUESTÕES",  value: totalQuestions,  color: "text-purple-600" },
            { label: "DIAS ESTUDADOS",  value: data.length,     color: "text-gray-900"  },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{label}</p>
              {sub && <p className="text-xs text-gray-500 mb-1">{sub}</p>}
              <p className={`text-3xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Lista de dias — estilo Estudei */}
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
          <div className="space-y-6">
            {data.map(group => {
              const { day, dayOfWeek, month, isToday } = parseDateLabel(group.date);
              const dayQuestions = group.sessions.reduce((a, s) => a + s.questions, 0);
              const dayCorrect   = group.sessions.reduce((a, s) => a + s.correct, 0);

              return (
                <div key={group.date}>
                  {/* Cabeçalho do dia — estilo Estudei */}
                  <div className="flex items-center gap-4 mb-3">
                    <div className="flex items-baseline gap-2 shrink-0">
                      <span className="text-3xl font-bold text-gray-800">{day}</span>
                      <div className="flex flex-col leading-tight">
                        <span className="text-xs text-gray-400 font-semibold">{dayOfWeek}</span>
                        <span className="text-xs text-gray-400">{month}</span>
                      </div>
                      {isToday && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white ml-1"
                          style={{ backgroundColor: BG }}>HOJE</span>
                      )}
                    </div>
                    {/* Linha separadora */}
                    <div className="flex-1 h-px bg-gray-200" />
                    {/* Total do dia */}
                    <div className="flex items-center gap-1.5 shrink-0 text-sm text-gray-500">
                      <Clock className="w-4 h-4" />
                      <span className="font-semibold">{group.totalHoursFormatted}</span>
                    </div>
                  </div>

                  {/* Sessões do dia */}
                  <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                    {group.sessions.map((s, si) => (
                      <div
                        key={s.id}
                        className={`flex items-center gap-4 px-5 py-4 ${si < group.sessions.length - 1 ? "border-b border-gray-50" : ""} hover:bg-gray-50 transition-colors`}
                      >
                        {/* Barra colorida lateral */}
                        <div className="w-1 h-10 rounded-full shrink-0" style={{ backgroundColor: getSubjectColor(s.subjectId) }} />

                        {/* Nome da matéria */}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-sm">{s.subjectName}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{fmtTime(s.createdAt)}</p>
                        </div>

                        {/* Métricas */}
                        <div className="flex items-center gap-6 text-sm shrink-0">
                          {/* Tempo */}
                          <div className="flex items-center gap-1.5 text-blue-600">
                            <Clock className="w-3.5 h-3.5" />
                            <span className="font-semibold">{s.hoursFormatted}</span>
                          </div>

                          {/* Questões */}
                          {s.questions > 0 ? (
                            <>
                              <span className="text-green-600 font-semibold w-8 text-right">{s.correct}</span>
                              <span className="text-red-500 font-semibold w-8 text-right">{s.wrong}</span>
                              <span className="text-gray-500 w-10 text-right">{s.questions}</span>
                              {s.accuracy !== null && (
                                <span className={`font-bold text-xs px-2 py-1 rounded-lg min-w-[44px] text-center ${
                                  s.accuracy >= 70 ? "bg-green-500 text-white"
                                  : s.accuracy >= 50 ? "bg-yellow-400 text-white"
                                  : "bg-red-500 text-white"
                                }`}>{s.accuracy}</span>
                              )}
                            </>
                          ) : (
                            <span className="text-xs text-gray-300">sem questões</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
