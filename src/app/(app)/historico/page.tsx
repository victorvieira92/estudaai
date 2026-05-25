"use client";
import { useEffect, useState } from "react";
import { Clock, Pencil, Trash2, MessageSquare, X, Check } from "lucide-react";

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
  category:       string;
  topicName:      string;
  pdfTitle:       string;
  comment:        string;
}

interface DayGroup {
  date:                string;
  totalHours:          number;
  totalHoursFormatted: string;
  sessions:            Session[];
}

const BG = "#1B4040";
const SUBJECT_COLORS = [BG,"#3B82F6","#10B981","#F59E0B","#8B5CF6","#EC4899","#14B8A6","#EF4444"];
const colorCache = new Map<string,string>(); let colorIdx = 0;
function getColor(id: string) {
  if (!colorCache.has(id)) { colorCache.set(id, SUBJECT_COLORS[colorIdx % SUBJECT_COLORS.length]); colorIdx++; }
  return colorCache.get(id)!;
}

function fmtH(h: number) {
  const totalMin = Math.round(h * 60);
  if (totalMin < 60) return `${totalMin}min`;
  const hh = Math.floor(totalMin / 60); const mm = totalMin % 60;
  return mm > 0 ? `${hh}h${mm.toString().padStart(2,"0")}min` : `${hh}h`;
}

function parseDateLabel(ds: string) {
  const d = new Date(ds + "T12:00:00");
  const today = new Date(); today.setHours(0,0,0,0);
  const dDay  = new Date(ds + "T12:00:00"); dDay.setHours(0,0,0,0);
  const diff  = Math.round((today.getTime() - dDay.getTime()) / 86400000);
  const DAYS  = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  const MONTHS= ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];
  return {
    day:       String(d.getDate()).padStart(2,"0"),
    dayOfWeek: DAYS[d.getDay()].toUpperCase(),
    month:     MONTHS[d.getMonth()] + "/" + String(d.getFullYear()).slice(2),
    isToday:   diff === 0,
  };
}

export default function HistoricoPage() {
  const [data,         setData]         = useState<DayGroup[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [editingId,    setEditingId]    = useState<string | null>(null);
  const [editComment,  setEditComment]  = useState("");
  const [deletingId,   setDeletingId]   = useState<string | null>(null);
  const [saving,       setSaving]       = useState(false);

  const load = () => {
    setLoading(true);
    fetch("/api/historico")
      .then(r => r.json())
      .then(d => setData(Array.isArray(d) ? d : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const saveComment = async (id: string) => {
    setSaving(true);
    await fetch("/api/historico", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ id, comment: editComment }),
    });
    setSaving(false);
    setEditingId(null);
    load();
  };

  const deleteSession = async (id: string) => {
    setSaving(true);
    await fetch(`/api/historico?id=${id}`, { method: "DELETE" });
    setSaving(false);
    setDeletingId(null);
    load();
  };

  const totalHours     = data.reduce((a, g) => a + g.totalHours, 0);
  const totalQuestions = data.reduce((a, g) => g.sessions.reduce((b, s) => b + s.questions, a), 0);
  const totalCorrect   = data.reduce((a, g) => g.sessions.reduce((b, s) => b + s.correct, a), 0);
  const totalWrong     = data.reduce((a, g) => g.sessions.reduce((b, s) => b + s.wrong, a), 0);
  const globalAccuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="text-white px-8"
        style={{ backgroundColor: BG, minHeight: "124px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <h1 className="text-3xl font-bold">Histórico</h1>
        <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.6)" }}>Todos os seus registros de estudo</p>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "TEMPO DE ESTUDO",  value: fmtH(totalHours),   color: "text-gray-900" },
            { label: "DESEMPENHO",
              sub: totalQuestions > 0 ? `${totalCorrect} Acertos · ${totalWrong} Erros` : "sem dados",
              value: globalAccuracy !== null ? `${globalAccuracy}%` : "—",
              color: globalAccuracy !== null ? (globalAccuracy >= 70 ? "text-green-600" : globalAccuracy >= 50 ? "text-yellow-600" : "text-red-600") : "text-gray-400",
            },
            { label: "TOTAL QUESTÕES",  value: totalQuestions, color: "text-purple-600" },
            { label: "DIAS ESTUDADOS",  value: data.length,    color: "text-gray-900"  },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{label}</p>
              {sub && <p className="text-xs text-gray-500 mb-1">{sub}</p>}
              <p className={`text-3xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Lista */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: BG }} />
          </div>
        ) : data.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <Clock className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Nenhum estudo registrado ainda</p>
          </div>
        ) : (
          <div className="space-y-6">
            {data.map(group => {
              const { day, dayOfWeek, month, isToday } = parseDateLabel(group.date);
              return (
                <div key={group.date}>
                  {/* Cabeçalho do dia */}
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
                    <div className="flex-1 h-px bg-gray-200" />
                    <div className="flex items-center gap-1.5 shrink-0 text-sm text-gray-500">
                      <Clock className="w-4 h-4" />
                      <span className="font-semibold">{group.totalHoursFormatted}</span>
                    </div>
                  </div>

                  {/* Sessões */}
                  <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                    {group.sessions.map((s, si) => (
                      <div key={s.id}>
                        <div className={`flex items-start gap-4 px-5 py-4 ${si < group.sessions.length - 1 ? "border-b border-gray-50" : ""} hover:bg-gray-50 transition-colors`}>
                          {/* Barra colorida */}
                          <div className="w-1 h-full rounded-full shrink-0 mt-1" style={{ backgroundColor: getColor(s.subjectId), minHeight: "40px" }} />

                          {/* Conteúdo */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-bold text-gray-900">{s.subjectName}</p>
                                {/* ✅ Tópico e PDF em vez do horário */}
                                {(s.topicName || s.pdfTitle) && (
                                  <p className="text-xs text-gray-500 mt-0.5">
                                    {[s.topicName, s.pdfTitle].filter(Boolean).join(" · ")}
                                  </p>
                                )}
                                {s.category && (
                                  <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1 ${
                                    s.category === "Exercícios" ? "bg-green-100 text-green-700"
                                    : s.category === "Revisão"  ? "bg-blue-100 text-blue-700"
                                    : "bg-purple-100 text-purple-700"
                                  }`}>{s.category}</span>
                                )}
                                {s.comment && (
                                  <p className="text-xs text-gray-400 mt-1 italic">💬 {s.comment}</p>
                                )}
                              </div>

                              {/* Métricas + ações */}
                              <div className="flex items-center gap-4 shrink-0">
                                <div className="flex items-center gap-4 text-sm">
                                  <span className="flex items-center gap-1 text-blue-600 font-semibold">
                                    <Clock className="w-3.5 h-3.5" /> {s.hoursFormatted}
                                  </span>
                                  {s.questions > 0 && (<>
                                    <span className="text-green-600 font-semibold">{s.correct}</span>
                                    <span className="text-red-500 font-semibold">{s.wrong}</span>
                                    <span className="text-gray-500">{s.questions}</span>
                                    {s.accuracy !== null && (
                                      <span className={`font-bold text-xs px-2 py-1 rounded-lg min-w-[40px] text-center ${
                                        s.accuracy >= 70 ? "bg-green-500 text-white"
                                        : s.accuracy >= 50 ? "bg-yellow-400 text-white"
                                        : "bg-red-500 text-white"
                                      }`}>{s.accuracy}</span>
                                    )}
                                  </>)}
                                  {s.questions === 0 && <span className="text-xs text-gray-300">sem questões</span>}
                                </div>

                                {/* Botões ação */}
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => { setEditingId(s.id); setEditComment(s.comment); }}
                                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                                    title="Adicionar observação"
                                  >
                                    <MessageSquare className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => setDeletingId(s.id)}
                                    className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                                    title="Excluir sessão"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Editor de observação */}
                            {editingId === s.id && (
                              <div className="mt-3 flex items-center gap-2">
                                <input
                                  type="text"
                                  value={editComment}
                                  onChange={e => setEditComment(e.target.value)}
                                  placeholder="Adicionar observação..."
                                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                                  style={{ '--tw-ring-color': BG } as any}
                                  autoFocus
                                  onKeyDown={e => { if (e.key === "Enter") saveComment(s.id); if (e.key === "Escape") setEditingId(null); }}
                                />
                                <button onClick={() => saveComment(s.id)} disabled={saving}
                                  className="p-2 rounded-lg text-white transition-colors"
                                  style={{ backgroundColor: BG }}>
                                  <Check className="w-4 h-4" />
                                </button>
                                <button onClick={() => setEditingId(null)}
                                  className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors">
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Confirmação de exclusão */}
                        {deletingId === s.id && (
                          <div className="px-5 py-3 bg-red-50 border-t border-red-100 flex items-center justify-between">
                            <p className="text-sm text-red-700 font-medium">Confirmar exclusão desta sessão?</p>
                            <div className="flex gap-2">
                              <button onClick={() => deleteSession(s.id)} disabled={saving}
                                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors">
                                {saving ? "Excluindo..." : "Excluir"}
                              </button>
                              <button onClick={() => setDeletingId(null)}
                                className="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-semibold rounded-lg transition-colors">
                                Cancelar
                              </button>
                            </div>
                          </div>
                        )}
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
