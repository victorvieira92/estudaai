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

// Mapa de cores por categoria (igual às badges coloridas da imagem)
function categoryBadge(cat: string) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    "Exercícios":    { bg: "#22c55e", text: "#fff", label: "QUESTÕES" },
    "Revisão":       { bg: "#3b82f6", text: "#fff", label: "REVISÃO" },
    "Leitura de Lei":{ bg: "#f59e0b", text: "#fff", label: "LEITURA DE LEI" },
    "Videoaula":     { bg: "#8b5cf6", text: "#fff", label: "VIDEOAULA" },
    "Teoria":        { bg: "#1B4040", text: "#fff", label: "TEORIA" },
  };
  return map[cat] ?? { bg: "#6b7280", text: "#fff", label: cat.toUpperCase() };
}

// Cores por disciplina (cycling)
const PALETTE = ["#1B4040","#3B82F6","#10B981","#F59E0B","#8B5CF6","#EC4899","#14B8A6","#EF4444"];
const colorCache = new Map<string, string>(); let colorIdx = 0;
function getSubjectColor(id: string) {
  if (!colorCache.has(id)) { colorCache.set(id, PALETTE[colorIdx % PALETTE.length]); colorIdx++; }
  return colorCache.get(id)!;
}

function fmtH(h: number) {
  const totalMin = Math.round(h * 60);
  if (totalMin < 60) return `${totalMin}min`;
  const hh = Math.floor(totalMin / 60); const mm = totalMin % 60;
  return mm > 0 ? `${hh}h${String(mm).padStart(2,"0")}min` : `${hh}h`;
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

// ── Componente de linha de sessão ────────────────────────────────────────────
function SessionRow({
  s, si, total,
  onComment, onEdit, onDelete,
}: {
  s: Session; si: number; total: number;
  onComment: (s: Session) => void;
  onEdit:    (s: Session) => void;
  onDelete:  (id: string) => void;
}) {
  const badge = categoryBadge(s.category);
  const color = getSubjectColor(s.subjectId);

  return (
    <div className={`flex items-center gap-0 ${si < total - 1 ? "border-b border-gray-100" : ""} hover:bg-gray-50 transition-colors`}>
      {/* Barra colorida lateral */}
      <div className="w-1 self-stretch shrink-0" style={{ backgroundColor: color }} />

      <div className="flex flex-1 items-center gap-4 px-5 py-3 min-w-0">
        {/* Info principal */}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 text-sm truncate">{s.subjectName}</p>
          {/* Tópico + PDF */}
          {(s.topicName || s.pdfTitle) && (
            <p className="text-xs text-gray-500 mt-0.5 truncate">
              {[s.topicName, s.pdfTitle].filter(Boolean).join(" · ")}
            </p>
          )}
          {s.comment && (
            <p className="text-xs text-gray-400 mt-0.5 italic truncate">💬 {s.comment}</p>
          )}
        </div>

        {/* Tempo */}
        <span className="text-sm font-mono text-gray-600 shrink-0 tabular-nums">{s.hoursFormatted}</span>

        {/* Questões */}
        {s.questions > 0 && (
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-sm font-bold text-green-500">{s.correct}</span>
            <span className="text-sm font-bold text-red-500">{s.wrong}</span>
          </div>
        )}

        {/* % badge */}
        {s.accuracy !== null && s.questions > 0 && (
          <span className="text-xs font-bold px-2.5 py-1 rounded-full text-white shrink-0"
            style={{
              backgroundColor: s.accuracy >= 70 ? "#22c55e" : s.accuracy >= 50 ? "#f59e0b" : "#ef4444"
            }}>
            {s.accuracy}%
          </span>
        )}

        {/* Categoria badge */}
        {s.category && (
          <span className="text-[10px] font-bold px-3 py-1 rounded-full shrink-0"
            style={{ backgroundColor: badge.bg, color: badge.text }}>
            {badge.label}
          </span>
        )}

        {/* Botões ação */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button onClick={() => onComment(s)} title="Observação"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
            <MessageSquare size={15} />
          </button>
          <button onClick={() => onEdit(s)} title="Editar"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors">
            <Pencil size={15} />
          </button>
          <button onClick={() => onDelete(s.id)} title="Excluir"
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Página principal ─────────────────────────────────────────────────────────
export default function HistoricoPage() {
  const [data,        setData]        = useState<DayGroup[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);

  // Observação (balão)
  const [commentId,   setCommentId]   = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");

  // Edição completa
  const [editSession, setEditSession] = useState<Session | null>(null);

  // Exclusão
  const [deleteId,    setDeleteId]    = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch("/api/historico")
      .then(r => r.json())
      .then(d => setData(Array.isArray(d) ? d : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

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

  const saveEdit = async () => {
    if (!editSession) return;
    setSaving(true);
    await fetch("/api/historico", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        id:       editSession.id,
        comment:  editSession.comment,
        category: editSession.category,
      }),
    });
    setSaving(false); setEditSession(null); load();
  };

  const deleteSession = async () => {
    if (!deleteId) return;
    setSaving(true);
    await fetch(`/api/historico?id=${deleteId}`, { method: "DELETE" });
    setSaving(false); setDeleteId(null); load();
  };

  // KPIs globais
  const totalHours     = data.reduce((a, g) => a + g.totalHours, 0);
  const totalQuestions = data.reduce((a, g) => g.sessions.reduce((b, s) => b + s.questions, a), 0);
  const totalCorrect   = data.reduce((a, g) => g.sessions.reduce((b, s) => b + s.correct, a), 0);
  const totalWrong     = data.reduce((a, g) => g.sessions.reduce((b, s) => b + s.wrong, a), 0);
  const globalAccuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="text-white px-8"
        style={{ backgroundColor: BG, minHeight: 100, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <h1 className="text-3xl font-bold">Histórico</h1>
        <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.6)" }}>Todos os seus registros de estudo</p>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "TEMPO DE ESTUDO",  value: fmtH(totalHours),   color: "text-gray-900" },
            { label: "DESEMPENHO",
              sub:   totalQuestions > 0 ? `${totalCorrect} Acertos · ${totalWrong} Erros` : "sem dados",
              value: globalAccuracy !== null ? `${globalAccuracy}%` : "—",
              color: globalAccuracy !== null ? (globalAccuracy >= 70 ? "text-green-600" : globalAccuracy >= 50 ? "text-yellow-600" : "text-red-600") : "text-gray-400",
            },
            { label: "TOTAL QUESTÕES",  value: totalQuestions, color: "text-purple-600" },
            { label: "DIAS ESTUDADOS",  value: data.length,    color: "text-gray-900" },
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

                  {/* Sessões do dia */}
                  <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                    {group.sessions.map((s, si) => (
                      <div key={s.id}>
                        <SessionRow
                          s={s} si={si} total={group.sessions.length}
                          onComment={sess => { setCommentId(sess.id); setCommentText(sess.comment); }}
                          onEdit={sess => setEditSession({ ...sess })}
                          onDelete={id => setDeleteId(id)}
                        />

                        {/* Painel de observação */}
                        {commentId === s.id && (
                          <div className="px-5 py-3 bg-blue-50 border-t border-blue-100 flex items-center gap-2">
                            <MessageSquare size={14} className="text-blue-400 shrink-0" />
                            <input type="text" value={commentText} onChange={e => setCommentText(e.target.value)}
                              placeholder="Adicionar observação..."
                              autoFocus
                              onKeyDown={e => { if (e.key === "Enter") saveComment(); if (e.key === "Escape") setCommentId(null); }}
                              className="flex-1 bg-transparent text-sm outline-none text-gray-700 placeholder-gray-400"
                            />
                            <button onClick={saveComment} disabled={saving}
                              className="p-1.5 rounded-lg text-white transition-colors"
                              style={{ backgroundColor: BG }}>
                              <Check size={14} />
                            </button>
                            <button onClick={() => setCommentId(null)}
                              className="p-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 text-gray-600 transition-colors">
                              <X size={14} />
                            </button>
                          </div>
                        )}

                        {/* Painel de edição */}
                        {editSession?.id === s.id && (
                          <div className="px-5 py-4 bg-gray-50 border-t border-gray-100 space-y-3">
                            <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Editar lançamento</p>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-xs text-gray-500 mb-1 block">Categoria</label>
                                <select value={editSession.category}
                                  onChange={e => setEditSession({ ...editSession, category: e.target.value })}
                                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none">
                                  {["Teoria","Exercícios","Revisão","Leitura de Lei","Videoaula"].map(c =>
                                    <option key={c} value={c}>{c}</option>
                                  )}
                                </select>
                              </div>
                              <div>
                                <label className="text-xs text-gray-500 mb-1 block">Comentário</label>
                                <input type="text" value={editSession.comment}
                                  onChange={e => setEditSession({ ...editSession, comment: e.target.value })}
                                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none"
                                />
                              </div>
                            </div>
                            <div className="flex gap-2 justify-end">
                              <button onClick={() => setEditSession(null)}
                                className="px-4 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-semibold rounded-lg transition-colors">
                                Cancelar
                              </button>
                              <button onClick={saveEdit} disabled={saving}
                                className="px-4 py-1.5 text-white text-xs font-semibold rounded-lg transition-colors"
                                style={{ backgroundColor: BG }}>
                                {saving ? "Salvando..." : "Salvar"}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Confirmação de exclusão */}
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
