"use client";
// v2
import { useEffect, useState } from "react";
import { Clock, Pencil, Trash2, MessageSquare, X, Check, ChevronDown } from "lucide-react";

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

interface Subject { id: string; name: string; topics: Topic[]; }
interface Topic   { id: string; name: string; }

const BG = "#1B4040";
const CATEGORIES = ["Teoria", "Exercícios", "Revisão", "Leitura de Lei", "Videoaula"];

// Badge de categoria — cores da imagem 2
function CategoryBadge({ cat }: { cat: string }) {
  const map: Record<string, { bg: string; label: string }> = {
    "Exercícios":     { bg: "#22c55e", label: "QUESTÕES"       },
    "Revisão":        { bg: "#3b82f6", label: "REVISÃO"        },
    "Leitura de Lei": { bg: "#f59e0b", label: "LEITURA DE LEI" },
    "Videoaula":      { bg: "#8b5cf6", label: "VIDEOAULA"      },
    "Teoria":         { bg: "#1B4040", label: "TEORIA"         },
  };
  const c = map[cat] ?? { bg: "#6b7280", label: cat.toUpperCase() };
  return (
    <span className="text-[11px] font-bold px-3 py-1 rounded text-white shrink-0"
      style={{ backgroundColor: c.bg, minWidth: 90, textAlign: "center", display: "inline-block" }}>
      {c.label}
    </span>
  );
}

// Cores laterais por disciplina
const PALETTE = ["#1B4040","#3B82F6","#10B981","#F59E0B","#8B5CF6","#EC4899","#14B8A6","#EF4444"];
const colorCache = new Map<string, string>(); let colorIdx = 0;
function getColor(id: string) {
  if (!colorCache.has(id)) { colorCache.set(id, PALETTE[colorIdx % PALETTE.length]); colorIdx++; }
  return colorCache.get(id)!;
}

function fmtH(h: number) {
  const totalMin = Math.round(h * 60);
  if (totalMin < 60) return `${totalMin}min`;
  const hh = Math.floor(totalMin / 60); const mm = totalMin % 60;
  return mm > 0 ? `${hh}h${String(mm).padStart(2, "0")}min` : `${hh}h`;
}

// HH:MM:SS → horas decimais
function timeToHours(t: string): number {
  const [h, m, s] = t.split(":").map(Number);
  return (h || 0) + (m || 0) / 60 + (s || 0) / 3600;
}

// horas decimais → HH:MM:SS
function hoursToTime(h: number): string {
  const total = Math.round(h * 3600);
  const hh = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  const ss = total % 60;
  return `${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}:${String(ss).padStart(2,"0")}`;
}

function parseDateLabel(ds: string) {
  const d = new Date(ds + "T12:00:00");
  const today = new Date(); today.setHours(0,0,0,0);
  const dDay  = new Date(ds + "T12:00:00"); dDay.setHours(0,0,0,0);
  const diff  = Math.round((today.getTime() - dDay.getTime()) / 86400000);
  const DAYS   = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  const MONTHS = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];
  return {
    day:       String(d.getDate()).padStart(2,"0"),
    dayOfWeek: DAYS[d.getDay()].toUpperCase(),
    month:     MONTHS[d.getMonth()] + "/" + String(d.getFullYear()).slice(2),
    isToday:   diff === 0,
  };
}

// ── Painel de edição completo ─────────────────────────────────────────────────
function EditPanel({
  session, subjects, onSave, onCancel, saving,
}: {
  session: Session;
  subjects: Subject[];
  onSave: (data: Partial<Session> & { studyTime: string }) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [category,  setCategory]  = useState(session.category);
  const [studyTime, setStudyTime] = useState(hoursToTime(session.hours));
  const [correct,   setCorrect]   = useState(String(session.correct));
  const [wrong,     setWrong]     = useState(String(session.wrong));
  const [topicName, setTopicName] = useState(session.topicName);
  const [pdfTitle,  setPdfTitle]  = useState(session.pdfTitle);
  const [comment,   setComment]   = useState(session.comment);

  // Tópicos da disciplina (já sabemos o subjectId, puxamos da lista)
  const subject = subjects.find(s => s.id === session.subjectId);
  const topics  = subject?.topics ?? [];

  return (
    <div className="px-5 py-4 bg-gray-50 border-t border-gray-100 space-y-3">
      <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">✏️ Editar lançamento</p>

      <div className="grid grid-cols-3 gap-3">
        {/* Categoria */}
        <div>
          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Categoria</label>
          <div className="relative">
            <select value={category} onChange={e => setCategory(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm appearance-none focus:outline-none pr-6">
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Tempo */}
        <div>
          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Tempo (HH:MM:SS)</label>
          <input type="text" value={studyTime} onChange={e => setStudyTime(e.target.value)}
            placeholder="00:00:00"
            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-mono focus:outline-none focus:border-teal-400" />
        </div>

        {/* Tópico — dropdown se tiver tópicos, input livre caso contrário */}
        <div>
          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Tópico</label>
          {topics.length > 0 ? (
            <div className="relative">
              <select value={topicName} onChange={e => setTopicName(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm appearance-none focus:outline-none pr-6">
                <option value="">Selecione...</option>
                {topics.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
              </select>
              <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          ) : (
            <input type="text" value={topicName} onChange={e => setTopicName(e.target.value)}
              placeholder="Nome do tópico"
              className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-teal-400" />
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {/* Acertos */}
        <div>
          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Acertos</label>
          <input type="number" min="0" value={correct} onChange={e => setCorrect(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-teal-400 text-green-600 font-bold" />
        </div>

        {/* Erros */}
        <div>
          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Erros</label>
          <input type="number" min="0" value={wrong} onChange={e => setWrong(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-teal-400 text-red-500 font-bold" />
        </div>

        {/* Material/PDF */}
        <div>
          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Material</label>
          <input type="text" value={pdfTitle} onChange={e => setPdfTitle(e.target.value)}
            placeholder="Ex.: Aula 01"
            className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-teal-400" />
        </div>
      </div>

      {/* Comentário */}
      <div>
        <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider block mb-1">Comentário</label>
        <input type="text" value={comment} onChange={e => setComment(e.target.value)}
          placeholder="Observação sobre a sessão..."
          className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-teal-400" />
      </div>

      <div className="flex gap-2 justify-end pt-1">
        <button onClick={onCancel}
          className="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-semibold rounded-lg transition-colors">
          Cancelar
        </button>
        <button onClick={() => onSave({ category, studyTime, correct: parseInt(correct)||0, wrong: parseInt(wrong)||0, topicName, pdfTitle, comment })}
          disabled={saving}
          className="px-4 py-1.5 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
          style={{ backgroundColor: BG }}>
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function HistoricoPage() {
  const [data,        setData]        = useState<DayGroup[]>([]);
  const [subjects,    setSubjects]    = useState<Subject[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);

  const [commentId,   setCommentId]   = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [editId,      setEditId]      = useState<string | null>(null);
  const [deleteId,    setDeleteId]    = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch("/api/historico")
      .then(r => r.json())
      .then(d => setData(Array.isArray(d) ? d : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // Carrega lista de disciplinas para o painel de edição
    fetch("/api/subjects")
      .then(r => r.json())
      .then(d => {
        const list = Array.isArray(d) ? d : (d as any).subjects ?? [];
        setSubjects(list);
      })
      .catch(console.error);
  }, []);

  const saveComment = async () => {
    if (!commentId) return;
    setSaving(true);
    await fetch("/api/historico", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ id: commentId, comment: commentText }),
    });
    setSaving(false); setCommentId(null); load();
  };

  const saveEdit = async (id: string, data: Partial<Session> & { studyTime: string }) => {
    setSaving(true);
    const hours = timeToHours(data.studyTime);
    await fetch("/api/historico", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        id,
        category:  data.category,
        topicName: data.topicName,
        pdfTitle:  data.pdfTitle,
        comment:   data.comment,
        hours,
        correct:   data.correct,
        wrong:     data.wrong,
      }),
    });
    setSaving(false); setEditId(null); load();
  };

  const deleteSession = async () => {
    if (!deleteId) return;
    setSaving(true);
    await fetch(`/api/historico?id=${deleteId}`, { method: "DELETE" });
    setSaving(false); setDeleteId(null); load();
  };

  // KPIs
  const totalHours     = data.reduce((a, g) => a + g.totalHours, 0);
  const totalQuestions = data.reduce((a, g) => g.sessions.reduce((b, s) => b + s.questions, a), 0);
  const totalCorrect   = data.reduce((a, g) => g.sessions.reduce((b, s) => b + s.correct, a), 0);
  const totalWrong     = data.reduce((a, g) => g.sessions.reduce((b, s) => b + s.wrong, a), 0);
  const globalAccuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : null;

  // Encontra a sessão para o EditPanel
  const allSessions = data.flatMap(g => g.sessions);
  const editSession = allSessions.find(s => s.id === editId) ?? null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="text-white px-8"
        style={{ backgroundColor: BG, minHeight: 124, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <h1 className="text-3xl font-bold">Histórico</h1>
        <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.6)" }}>Todos os seus registros de estudo</p>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "TEMPO DE ESTUDO", value: fmtH(totalHours), color: "text-gray-900" },
            { label: "DESEMPENHO",
              sub:   totalQuestions > 0 ? `${totalCorrect} Acertos · ${totalWrong} Erros` : "sem dados",
              value: globalAccuracy !== null ? `${globalAccuracy}%` : "—",
              color: globalAccuracy !== null ? (globalAccuracy >= 70 ? "text-green-600" : globalAccuracy >= 50 ? "text-yellow-600" : "text-red-600") : "text-gray-400",
            },
            { label: "TOTAL QUESTÕES", value: totalQuestions, color: "text-purple-600" },
            { label: "DIAS ESTUDADOS", value: data.length,    color: "text-gray-900"  },
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
                        {/* ── Linha da sessão ── */}
                        <div className={`flex items-stretch ${si < group.sessions.length - 1 ? "border-b border-gray-100" : ""} hover:bg-gray-50 transition-colors`}>

                          {/* Barra colorida lateral */}
                          <div className="w-1 shrink-0" style={{ backgroundColor: getColor(s.subjectId) }} />

                          <div className="flex flex-1 items-center gap-4 px-5 py-3 min-w-0">

                            {/* Info principal — nome + tópico */}
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-gray-900 text-sm uppercase tracking-wide">{s.subjectName}</p>

                              {/* Tópico (linha truncada igual imagem 2) */}
                              {(s.topicName || s.pdfTitle) && (
                                <p className="text-xs text-gray-500 mt-0.5 truncate">
                                  {[s.topicName, s.pdfTitle].filter(Boolean).join(" · ")}
                                </p>
                              )}

                              {/* Comentário se existir */}
                              {s.comment && (
                                <p className="text-xs text-gray-400 mt-0.5 italic truncate">💬 {s.comment}</p>
                              )}
                            </div>

                            {/* Tempo */}
                            <div className="flex items-center gap-1.5 shrink-0 text-gray-500 text-sm">
                              <Clock size={13} />
                              <span className="font-mono tabular-nums">{s.hoursFormatted}</span>
                            </div>

                            {/* Acertos / Erros */}
                            {s.questions > 0 && (
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-sm font-bold text-green-500">{s.correct}</span>
                                <span className="text-sm font-bold text-red-500">{s.wrong}</span>
                              </div>
                            )}

                            {/* % badge */}
                            {s.accuracy !== null && s.questions > 0 && (
                              <span className="text-xs font-bold px-2.5 py-1 rounded-full text-white shrink-0 tabular-nums"
                                style={{
                                  backgroundColor: s.accuracy >= 70 ? "#22c55e" : s.accuracy >= 50 ? "#f59e0b" : "#ef4444",
                                  minWidth: 40, textAlign: "center"
                                }}>
                                {s.accuracy}%
                              </span>
                            )}

                            {/* Categoria badge */}
                            <CategoryBadge cat={s.category || "Teoria"} />

                            {/* Botões ação */}
                            <div className="flex items-center gap-0.5 shrink-0">
                              <button
                                onClick={() => { setCommentId(s.id); setCommentText(s.comment); setEditId(null); setDeleteId(null); }}
                                title="Observação"
                                className={`p-1.5 rounded-lg transition-colors ${commentId === s.id ? "bg-blue-100 text-blue-600" : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"}`}>
                                <MessageSquare size={15} />
                              </button>
                              <button
                                onClick={() => { setEditId(s.id); setCommentId(null); setDeleteId(null); }}
                                title="Editar"
                                className={`p-1.5 rounded-lg transition-colors ${editId === s.id ? "bg-teal-100 text-teal-700" : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"}`}>
                                <Pencil size={15} />
                              </button>
                              <button
                                onClick={() => { setDeleteId(s.id); setCommentId(null); setEditId(null); }}
                                title="Excluir"
                                className={`p-1.5 rounded-lg transition-colors ${deleteId === s.id ? "bg-red-100 text-red-600" : "text-gray-400 hover:text-red-500 hover:bg-red-50"}`}>
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* ── Painel de observação (balão) ── */}
                        {commentId === s.id && (
                          <div className="px-5 py-3 bg-blue-50 border-t border-blue-100 flex items-center gap-2">
                            <MessageSquare size={14} className="text-blue-400 shrink-0" />
                            <input type="text" value={commentText}
                              onChange={e => setCommentText(e.target.value)}
                              placeholder="Adicionar observação..."
                              autoFocus
                              onKeyDown={e => { if (e.key === "Enter") saveComment(); if (e.key === "Escape") setCommentId(null); }}
                              className="flex-1 bg-transparent text-sm outline-none text-gray-700 placeholder-gray-400"
                            />
                            <button onClick={saveComment} disabled={saving}
                              className="p-1.5 rounded-lg text-white transition-colors disabled:opacity-50"
                              style={{ backgroundColor: BG }}>
                              <Check size={14} />
                            </button>
                            <button onClick={() => setCommentId(null)}
                              className="p-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-600 transition-colors">
                              <X size={14} />
                            </button>
                          </div>
                        )}

                        {/* ── Painel de edição completa (lápis) ── */}
                        {editId === s.id && editSession && (
                          <EditPanel
                            session={editSession}
                            subjects={subjects}
                            saving={saving}
                            onCancel={() => setEditId(null)}
                            onSave={d => saveEdit(s.id, d)}
                          />
                        )}

                        {/* ── Confirmação de exclusão ── */}
                        {deleteId === s.id && (
                          <div className="px-5 py-3 bg-red-50 border-t border-red-100 flex items-center justify-between">
                            <p className="text-sm text-red-700 font-medium">Confirmar exclusão desta sessão?</p>
                            <div className="flex gap-2">
                              <button onClick={deleteSession} disabled={saving}
                                className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors">
                                {saving ? "Excluindo..." : "Excluir"}
                              </button>
                              <button onClick={() => setDeleteId(null)}
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
