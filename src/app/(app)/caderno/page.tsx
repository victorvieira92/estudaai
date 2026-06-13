"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { Plus, CheckCircle, XCircle, Pencil, Trash2, X, Check, ChevronDown, ChevronRight, Search, BarChart2, BookOpen, BookMarked } from "lucide-react";

interface SubjectTopic { id: string; name: string; pdfs: { title: string }[]; }
interface Subject { id: string; name: string; topics?: SubjectTopic[]; }
interface ErrorNote {
  id: string; title: string; description: string; topic: string | null;
  banca: string | null; difficulty: string; errorType: string | null;
  resolved: boolean; reviewCount: number; wrongCount: number;
  pending: boolean; nextReviewAt: string | null; intervalDays: number;
  createdAt: string;
  subject: { name: string }; subjectId: string;
}

const ERROR_TYPES = [
  { value: "desatencao",         label: "Desatenção",            desc: "Leu errado ou marcou sem pensar",         emoji: "😵" },
  { value: "nao_estudei",        label: "Não estudei",           desc: "Conteúdo ainda não visto",                emoji: "📚" },
  { value: "nao_lembrei",        label: "Não lembrei",           desc: "Estudou mas esqueceu na hora",            emoji: "🧠" },
  { value: "confundi_conceitos", label: "Confundi conceitos",    desc: "Misturou dois assuntos parecidos",        emoji: "🔀" },
  { value: "interpretacao",      label: "Erro de interpretação", desc: "Entendeu o enunciado de forma errada",    emoji: "📖" },
  { value: "pegadinha",          label: "Pegadinha",             desc: "Questão com detalhe que induziu ao erro", emoji: "🪤" },
  { value: "outro",              label: "Outro",                 desc: "Motivo diferente dos acima",              emoji: "❓" },
  { value: "decoreba",           label: "Decoreba",              desc: "Regra ou conceito para memorizar",        emoji: "📌" },
];

const COLORS = ["#000000","#dc2626","#16a34a","#2563eb","#9333ea","#ea580c","#0891b2"];

function etLabel(v: string | null) { return v ? ERROR_TYPES.find(e => e.value === v) ?? null : null; }
function fmtDate(d: string) { return new Date(d).toLocaleDateString("pt-BR"); }
function stripHtml(html: string) { return html?.replace(/<[^>]*>/g, "") ?? ""; }

function RichEditor({ value, onChange, placeholder, minRows = 3 }: { value: string; onChange: (v: string) => void; placeholder?: string; minRows?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  const paintFormat = useRef<{ color: string; bold: boolean; italic: boolean; underline: boolean; fontSize: string } | null>(null);
  const [painting, setPainting] = useState(false);

  useEffect(() => {
    if (ref.current && !initialized.current) {
      ref.current.innerHTML = value;
      initialized.current = true;
    }
  }, []);

  useEffect(() => {
    if (ref.current && value === "" && initialized.current) {
      ref.current.innerHTML = "";
    }
  }, [value]);

  const exec = (cmd: string, val?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, val);
    if (ref.current) onChange(ref.current.innerHTML);
  };

  const insertList = (type: "ul" | "ol") => {
    if (!ref.current) return;
    ref.current.focus();

    // Tenta execCommand primeiro
    const cmd = type === "ul" ? "insertUnorderedList" : "insertOrderedList";
    const worked = document.execCommand(cmd, false);

    if (!worked) {
      // Fallback: insere HTML diretamente na posição do cursor
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        const list = document.createElement(type);
        const li = document.createElement("li");
        li.innerHTML = "<br>";
        list.appendChild(li);
        range.insertNode(list);
        // Move cursor para dentro do li
        const newRange = document.createRange();
        newRange.setStart(li, 0);
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);
      }
    }

    if (ref.current) onChange(ref.current.innerHTML);
  };

  const handlePaintClick = () => {
    if (!painting) {
      // Captura formatação da seleção atual
      const color = document.queryCommandValue("foreColor");
      const bold = document.queryCommandState("bold");
      const italic = document.queryCommandState("italic");
      const underline = document.queryCommandState("underline");
      const fontSize = document.queryCommandValue("fontSize");
      paintFormat.current = { color, bold, italic, underline, fontSize };
      setPainting(true);
    } else {
      setPainting(false);
      paintFormat.current = null;
    }
  };

  const handleMouseUp = () => {
    if (painting && paintFormat.current) {
      const sel = window.getSelection();
      if (sel && sel.toString().length > 0) {
        const fmt = paintFormat.current;
        if (fmt.bold)      document.execCommand("bold", false);
        if (fmt.italic)    document.execCommand("italic", false);
        if (fmt.underline) document.execCommand("underline", false);
        if (fmt.color)     document.execCommand("foreColor", false, fmt.color);
        if (fmt.fontSize)  document.execCommand("fontSize", false, fmt.fontSize);
        if (ref.current) onChange(ref.current.innerHTML);
        setPainting(false);
        paintFormat.current = null;
      }
    }
  };

  return (
    <div className="border border-gray-300 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-gray-900">
      <div className="flex items-center gap-1 px-3 py-2 border-b border-gray-200 bg-gray-50 flex-wrap">
        <button type="button" onMouseDown={e=>{e.preventDefault();exec("bold")}} className="w-7 h-7 flex items-center justify-center font-bold text-sm hover:bg-gray-200 rounded">B</button>
        <button type="button" onMouseDown={e=>{e.preventDefault();exec("italic")}} className="w-7 h-7 flex items-center justify-center italic text-sm hover:bg-gray-200 rounded">I</button>
        <button type="button" onMouseDown={e=>{e.preventDefault();exec("underline")}} className="w-7 h-7 flex items-center justify-center underline text-sm hover:bg-gray-200 rounded">U</button>
        {/* Pincel de formatação */}
        <button
          type="button"
          onMouseDown={e => { e.preventDefault(); handlePaintClick(); }}
          title="Copiar formatação (Format Painter)"
          className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${painting ? "bg-blue-100 text-blue-700 ring-2 ring-blue-400" : "hover:bg-gray-200 text-gray-600"}`}>
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path d="M13.5 2a1.5 1.5 0 0 1 1.415 2H15a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2h-1.5v1.25a.75.75 0 0 1-.75.75h-.5v5.25a.75.75 0 0 1-1.5 0V11h-.5a.75.75 0 0 1-.75-.75V9H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h.085A1.5 1.5 0 0 1 7.5 2h6Z"/>
          </svg>
        </button>
        <div className="w-px h-5 bg-gray-300 mx-1"/>
        {COLORS.map(c=>(
          <button key={c} type="button" onMouseDown={e=>{e.preventDefault();exec("foreColor",c)}} className="w-5 h-5 rounded-full border-2 border-white shadow-sm hover:scale-110 transition-transform" style={{backgroundColor:c}}/>
        ))}
        <div className="w-px h-5 bg-gray-300 mx-1"/>
        <select defaultValue="" onChange={e=>{exec("fontSize",e.target.value)}} className="text-xs border border-gray-200 rounded px-1 py-0.5 bg-white focus:outline-none">
          <option value="" disabled>Tam.</option>
          {[["1","10px"],["2","12px"],["3","14px"],["4","16px"],["5","18px"],["6","22px"],["7","26px"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}
        </select>
        <div className="w-px h-5 bg-gray-300 mx-1"/>
        {/* Sobrescrito / Subscrito */}
        <button type="button" onMouseDown={e=>{e.preventDefault();exec("superscript")}} title="Sobrescrito" className="w-7 h-7 flex items-center justify-center text-xs hover:bg-gray-200 rounded font-bold">X<sup>2</sup></button>
        <button type="button" onMouseDown={e=>{e.preventDefault();exec("subscript")}} title="Subscrito" className="w-7 h-7 flex items-center justify-center text-xs hover:bg-gray-200 rounded font-bold">X<sub>2</sub></button>
        <div className="w-px h-5 bg-gray-300 mx-1"/>
        {/* Listas */}
        <button type="button" onMouseDown={e=>{e.preventDefault();insertList("ul");}} title="Lista com marcadores"
          className="w-7 h-7 flex items-center justify-center hover:bg-gray-200 rounded text-gray-600">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M4 5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm0 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm0 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM7 4a1 1 0 0 0 0 2h9a1 1 0 1 0 0-2H7Zm0 6a1 1 0 1 0 0 2h9a1 1 0 1 0 0-2H7Zm0 6a1 1 0 1 0 0 2h9a1 1 0 1 0 0-2H7Z" clipRule="evenodd"/></svg>
        </button>
        <button type="button" onMouseDown={e=>{e.preventDefault();insertList("ol");}} title="Lista numerada"
          className="w-7 h-7 flex items-center justify-center hover:bg-gray-200 rounded text-gray-600">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M4 3a1 1 0 0 1 1 1v3H4V4H3V3h1Zm0 8a1 1 0 0 1 1 1v.586l.293-.293a1 1 0 1 1 1.414 1.414l-2 2a1 1 0 0 1-1.414 0l-2-2a1 1 0 1 1 1.414-1.414L3 13.586V12a1 1 0 0 1 1-1ZM7 5a1 1 0 0 0 0 2h9a1 1 0 1 0 0-2H7Zm0 6a1 1 0 1 0 0 2h9a1 1 0 1 0 0-2H7Zm0 5a1 1 0 1 0 0 2h9a1 1 0 1 0 0-2H7Z" clipRule="evenodd"/></svg>
        </button>
        <div className="w-px h-5 bg-gray-300 mx-1"/>
        <button type="button" onMouseDown={e=>{e.preventDefault();exec("removeFormat")}} title="Limpar formatação" className="px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-200 rounded">✕</button>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={()=>{ if(ref.current) onChange(ref.current.innerHTML); }}
        onMouseUp={handleMouseUp}
        className={`px-4 py-3 text-sm text-gray-900 focus:outline-none ${painting ? "cursor-crosshair" : ""}`}
        style={{minHeight:`${minRows*28}px`}}
      />
      <style>{`
        [contenteditable]:empty:before{content:attr(data-placeholder);color:#9ca3af;pointer-events:none;}
        [contenteditable] ul{list-style-type:disc;padding-left:1.5rem;margin:0.25rem 0;}
        [contenteditable] ol{list-style-type:decimal;padding-left:1.5rem;margin:0.25rem 0;}
        [contenteditable] li{margin:0.1rem 0;}
        .note-content ul{list-style-type:disc;padding-left:1.5rem;margin:0.25rem 0;}
        .note-content ol{list-style-type:decimal;padding-left:1.5rem;margin:0.25rem 0;}
        .note-content li{margin:0.1rem 0;}
      `}</style>
    </div>
  );
}

type Tab = "cadernos" | "registrar" | "evolucao" | "pesquisa";

// ── Componente de Evolução ────────────────────────────────────────────────────
function EvolucaoTab({ notes, metrics }: { notes: ErrorNote[]; metrics: any }) {
  const [expandedSub, setExpandedSub] = useState<string | null>(null);

  // Gráfico de barras simples sem dependências externas
  const SubjectChart = ({ subNotes }: { subNotes: ErrorNote[] }) => {
    const data = ERROR_TYPES.map(et => ({
      label: et.label, emoji: et.emoji,
      count: subNotes.filter(n => n.errorType === et.value).length,
    }));
    const max = Math.max(...data.map(d => d.count), 1);
    return (
      <div className="mt-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Erros por tipo</p>
        <div className="flex items-end gap-2 h-32">
          {data.map(d => (
            <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-xs font-bold text-gray-700">{d.count > 0 ? d.count : ""}</span>
              <div className="w-full bg-gray-100 rounded-t-lg overflow-hidden flex items-end" style={{ height: "80px" }}>
                <div className="w-full rounded-t-lg transition-all"
                  style={{ height: `${Math.round((d.count / max) * 100)}%`, backgroundColor: d.count > 0 ? (d.count === Math.max(...data.map(x => x.count)) ? "#dc2626" : "#6b7280") : "#e5e7eb" }}/>
              </div>
              <span className="text-lg" title={d.label}>{d.emoji}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {data.filter(d => d.count > 0).sort((a,b) => b.count - a.count).map(d => (
            <span key={d.label} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
              {d.emoji} {d.label}: {d.count}
            </span>
          ))}
          {data.every(d => d.count === 0) && <span className="text-xs text-gray-400">Nenhum tipo de erro classificado.</span>}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* KPIs globais */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Total de erros",    value: notes.length,           color: "text-gray-900" },
          { label: "Pendentes",         value: metrics.pending,        color: "text-red-600" },
          { label: "Resolvidos",        value: metrics.resolved,       color: "text-green-600" },
          { label: "Total de revisões", value: metrics.totalReviews,   color: "text-blue-600" },
          { label: "Taxa de acerto",    value: `${metrics.taxaAcerto}%`, color: metrics.taxaAcerto >= 70 ? "text-green-600" : metrics.taxaAcerto >= 50 ? "text-yellow-600" : "text-red-600" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-200 p-5 text-center">
            <p className="text-xs text-gray-400 mb-2">{label}</p>
            <p className={`text-3xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Gráfico global de tipos de erro */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="font-bold text-gray-900 mb-1">Distribuição global por tipo de erro</h2>
        <p className="text-xs text-gray-400 mb-4">Seu maior padrão de erro em todas as disciplinas</p>
        <div className="flex items-end gap-3 h-40">
          {ERROR_TYPES.map(et => {
            const count = notes.filter(n => n.errorType === et.value).length;
            const pct = notes.length > 0 ? Math.round((count / notes.length) * 100) : 0;
            const max = Math.max(...ERROR_TYPES.map(e => notes.filter(n => n.errorType === e.value).length), 1);
            const isTop = count === max && count > 0;
            return (
              <div key={et.value} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs font-bold text-gray-700">{count > 0 ? count : ""}</span>
                <div className="w-full bg-gray-100 rounded-t-xl overflow-hidden flex items-end" style={{ height: "96px" }}>
                  <div className="w-full rounded-t-xl transition-all"
                    style={{ height: `${Math.round((count / max) * 100)}%`, backgroundColor: isTop ? "#dc2626" : count > 0 ? "#6b7280" : "#f3f4f6" }}/>
                </div>
                <span className="text-xl" title={et.label}>{et.emoji}</span>
                <span className="text-xs text-gray-400 text-center leading-tight hidden md:block" style={{ fontSize: "10px" }}>{et.label}</span>
                {pct > 0 && <span className="text-xs font-semibold text-gray-600">{pct}%</span>}
              </div>
            );
          })}
        </div>
        {notes.length === 0 && <p className="text-center text-gray-400 text-sm mt-4">Nenhum erro registrado ainda.</p>}
      </div>

      {/* Pastinhas por disciplina */}
      <div>
        <h2 className="font-bold text-gray-900 mb-3">Análise por disciplina</h2>
        <div className="space-y-3">
          {metrics.bySubject.length === 0 && (
            <div className="text-center py-8 text-gray-400">Nenhum dado ainda.</div>
          )}
          {metrics.bySubject.map((s: any) => {
            const subNotes = notes.filter(n => n.subject.name === s.name);
            const isOpen = expandedSub === s.name;
            const progresso = s.total > 0 ? Math.round((s.resolved / s.total) * 100) : 0;
            const topError = ERROR_TYPES.reduce((best, et) => {
              const c = subNotes.filter(n => n.errorType === et.value).length;
              return c > best.count ? { label: et.label, emoji: et.emoji, count: c } : best;
            }, { label: "", emoji: "", count: 0 });
            const pendingCritical = subNotes.filter(n => n.pending && n.difficulty === "Alta").length;

            return (
              <div key={s.name} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                {/* Header da pastinha */}
                <button onClick={() => setExpandedSub(isOpen ? null : s.name)}
                  className="w-full px-6 py-5 flex items-center gap-4 hover:bg-gray-50 transition-colors text-left">
                  {isOpen ? <ChevronDown className="w-5 h-5 text-gray-400 shrink-0"/> : <ChevronRight className="w-5 h-5 text-gray-400 shrink-0"/>}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900">{s.name}</p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-xs text-gray-500">{s.total} erros</span>
                      {pendingCritical > 0 && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">{pendingCritical} crítico{pendingCritical > 1 ? "s" : ""}</span>}
                      {topError.count > 0 && <span className="text-xs text-gray-500">Principal erro: {topError.emoji} {topError.label}</span>}
                    </div>
                  </div>
                  {/* Mini métricas */}
                  <div className="hidden md:flex items-center gap-6 shrink-0">
                    <div className="text-center">
                      <p className="text-xs text-gray-400">Pendentes</p>
                      <p className="font-bold text-red-600">{s.pending}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-400">Resolvidos</p>
                      <p className="font-bold text-green-600">{s.resolved}</p>
                    </div>
                    <div className="w-28">
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Progresso</span><span>{progresso}%</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${progresso}%`, backgroundColor: progresso >= 70 ? "#16a34a" : progresso >= 40 ? "#ca8a04" : "#dc2626" }}/>
                      </div>
                    </div>
                  </div>
                </button>

                {/* Conteúdo expandido */}
                {isOpen && (
                  <div className="border-t border-gray-100 px-6 pb-6">
                    <div className="grid md:grid-cols-2 gap-6 mt-4">
                      {/* Gráfico de tipos */}
                      <div>
                        <SubjectChart subNotes={subNotes}/>
                      </div>
                      {/* Métricas detalhadas */}
                      <div className="space-y-3">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Detalhes</p>
                        <div className="grid grid-cols-2 gap-3">
                          {[
                            { label: "Total de erros",  value: s.total,    color: "text-gray-900" },
                            { label: "Pendentes",       value: s.pending,  color: "text-red-600" },
                            { label: "Resolvidos",      value: s.resolved, color: "text-green-600" },
                            { label: "Críticos",        value: pendingCritical, color: "text-orange-600" },
                          ].map(({ label, value, color }) => (
                            <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
                              <p className="text-xs text-gray-400">{label}</p>
                              <p className={`text-2xl font-bold ${color} mt-1`}>{value}</p>
                            </div>
                          ))}
                        </div>
                        {/* Dificuldades */}
                        <div className="space-y-2">
                          {[["Alta","bg-red-500"],["Media","bg-yellow-400"],["Baixa","bg-green-500"]].map(([d, color]) => {
                            const c = subNotes.filter(n => n.difficulty === d).length;
                            const p = s.total > 0 ? Math.round((c / s.total) * 100) : 0;
                            return (
                              <div key={d}>
                                <div className="flex justify-between text-xs text-gray-500 mb-1"><span>Dificuldade {d}</span><span>{c} ({p}%)</span></div>
                                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${color}`} style={{ width: `${p}%` }}/>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {/* Tópicos com mais erros */}
                        {(() => {
                          const byTopic: Record<string, number> = {};
                          subNotes.forEach(n => { const t = n.topic || "Sem tópico"; byTopic[t] = (byTopic[t] || 0) + 1; });
                          const sorted = Object.entries(byTopic).sort((a, b) => b[1] - a[1]).slice(0, 4);
                          if (!sorted.length) return null;
                          return (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Tópicos com mais erros</p>
                              <div className="space-y-1.5">
                                {sorted.map(([t, c]) => (
                                  <div key={t} className="flex items-center justify-between">
                                    <span className="text-xs text-gray-700 truncate max-w-[160px]">{t}</span>
                                    <span className="text-xs font-bold text-gray-900 shrink-0 ml-2">{c}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function CadernoPage() {
  const [tab, setTab] = useState<Tab>("cadernos");
  const [notes, setNotes] = useState<ErrorNote[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [filter, setFilter] = useState<"pending"|"all"|"resolved"|"decoreba">("pending");
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const reveal = (id: string) => setRevealedIds(prev => new Set([...prev, id]));
  const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set());
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  // Form
  const [subjectId, setSubjectId] = useState("");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [topic, setTopic] = useState("");
  const [topicFocused, setTopicFocused] = useState(false);
  const [banca, setBanca] = useState("");
  const [difficulty, setDifficulty] = useState("Media");
  const [errorType, setErrorType] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Edição
  const [editingNote, setEditingNote] = useState<ErrorNote|null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editTopic, setEditTopic] = useState("");
  const [editBanca, setEditBanca] = useState("");
  const [editDifficulty, setEditDifficulty] = useState("Media");
  const [editErrorType, setEditErrorType] = useState("");
  const [editSubjectId, setEditSubjectId] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const load = () => fetch("/api/error-notes").then(r=>r.json()).then(d=>setNotes(Array.isArray(d)?d:[])).catch(console.error);
  useEffect(()=>{
    load();
    fetch("/api/subjects").then(r=>r.json()).then(d=>setSubjects(Array.isArray(d)?d:(d.subjects??[]))).catch(console.error);
  },[]);

  const filtered = useMemo(()=>notes.filter(n=>{
    if (filter === "decoreba") return n.errorType === "decoreba";
    if (filter === "pending")  return n.pending && n.errorType !== "decoreba";
    if (filter === "resolved") return !n.pending && n.errorType !== "decoreba";
    return true;
  }),[notes,filter]);

  const grouped = useMemo(()=>{
    const out: Record<string,{name:string;topics:Record<string,ErrorNote[]>;noTopic:ErrorNote[]}> = {};
    for (const n of filtered) {
      if (!out[n.subject.name]) out[n.subject.name]={name:n.subject.name,topics:{},noTopic:[]};
      if (n.topic) { if (!out[n.subject.name].topics[n.topic]) out[n.subject.name].topics[n.topic]=[]; out[n.subject.name].topics[n.topic].push(n); }
      else out[n.subject.name].noTopic.push(n);
    }
    return out;
  },[filtered]);

  const searchResults = useMemo(()=>{
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return notes.filter(n=>stripHtml(n.title).toLowerCase().includes(q)||stripHtml(n.description).toLowerCase().includes(q)||(n.topic??"").toLowerCase().includes(q)||(n.banca??"").toLowerCase().includes(q)||n.subject.name.toLowerCase().includes(q));
  },[notes,searchQuery]);

  // Métricas
  const metrics = useMemo(()=>{
    const total = notes.length;
    const resolved = notes.filter(n=>!n.pending).length;
    const pending = notes.filter(n=>n.pending).length;
    const critical = notes.filter(n=>n.pending&&n.difficulty==="Alta").length;
    const totalReviews = notes.reduce((a,n)=>a+n.reviewCount,0);
    const totalWrong = notes.reduce((a,n)=>a+n.wrongCount,0);
    const taxaAcerto = totalReviews>0 ? Math.round(((totalReviews-totalWrong)/totalReviews)*100) : 0;
    const bySubject = Object.entries(grouped).map(([name,data])=>{
      const all = [...data.noTopic,...Object.values(data.topics).flat()];
      const r = all.filter(n=>!n.pending).length;
      return { name, total:all.length, resolved:r, pending:all.length-r, taxaAcerto: all.reduce((a,n)=>a+n.reviewCount,0)>0?Math.round(((all.reduce((a,n)=>a+n.reviewCount,0)-all.reduce((a,n)=>a+n.wrongCount,0))/all.reduce((a,n)=>a+n.reviewCount,0))*100):0 };
    });
    return { total, resolved, pending, critical, totalReviews, taxaAcerto, bySubject };
  },[notes,grouped]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    if (!stripHtml(title).trim()) { setSaving(false); return; }
    const res = await fetch("/api/error-notes",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({title,description:desc,subjectId,topic,banca,difficulty,errorType:errorType||null})});
    if (res.ok) { setTitle(""); setDesc(""); setTopic(""); setBanca(""); setErrorType(""); setSaved(true); setTimeout(()=>setSaved(false),2500); load(); }
    setSaving(false);
  };

  const action = async (id:string,act:string)=>{
    await fetch("/api/error-notes",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,action:act})});
    load();
  };

  const deleteNote = async (id:string)=>{
    if(!confirm("Excluir este erro?"))return;
    await fetch(`/api/error-notes/${id}`,{method:"DELETE"}); load();
  };

  const startEdit = (n:ErrorNote)=>{
    setEditingNote(n); setEditTitle(n.title); setEditDesc(n.description);
    setEditTopic(n.topic??""); setEditBanca(n.banca??"");
    setEditDifficulty(n.difficulty); setEditErrorType(n.errorType??""); setEditSubjectId(n.subjectId);
  };

  const saveEdit = async()=>{
    if(!editingNote)return; setSavingEdit(true);
    await fetch(`/api/error-notes/${editingNote.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({title:editTitle,description:editDesc,topic:editTopic,banca:editBanca,difficulty:editDifficulty,errorType:editErrorType||null,subjectId:editSubjectId})});
    setEditingNote(null); setSavingEdit(false); load();
  };

  const NoteCard = ({n}:{n:ErrorNote})=>{
    const et = etLabel(n.errorType);
    const isDecoreta = n.errorType === "decoreba";
    const isRevealed = revealedIds.has(n.id) || isDecoreta;
    return (
      <div className={`bg-white rounded-2xl border overflow-hidden ${!n.pending?"border-green-200 opacity-70":"border-gray-200"}`}>
        {/* Pergunta — sempre visível */}
        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${n.difficulty==="Alta"?"bg-red-100 text-red-700":n.difficulty==="Media"?"bg-yellow-100 text-yellow-700":"bg-green-100 text-green-700"}`}>{n.difficulty}</span>
                {et&&<span className="text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-700">{et.emoji} {et.label}</span>}
                {n.banca&&<span className="text-xs text-gray-400">• {n.banca}</span>}
                <span className="text-xs text-gray-400">{fmtDate(n.createdAt)}</span>
              </div>
              <div className="font-semibold text-gray-900 leading-snug note-content" dangerouslySetInnerHTML={{__html:n.title}}/>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <button onClick={()=>startEdit(n)} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"><Pencil className="w-4 h-4"/></button>
              <button onClick={()=>deleteNote(n.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4"/></button>
            </div>
          </div>

          {/* Botão revelar — só aparece se ainda não revelou e tem pendente */}
          {n.pending && !isRevealed && !isDecoreta && (
            <button
              onClick={() => reveal(n.id)}
              className="mt-4 w-full py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-teal-300 hover:text-teal-600 hover:bg-teal-50 transition-all font-medium">
              👁 Ver resposta
            </button>
          )}
        </div>

        {/* Resposta — revelada ao clicar */}
        {(isRevealed || !n.pending) && (
          <div className={`border-t px-5 py-4 ${n.pending ? "bg-gray-50 border-gray-100" : "bg-green-50 border-green-100"}`}>
            {n.description && (
              <div className="text-sm text-gray-700 leading-relaxed mb-3 note-content" dangerouslySetInnerHTML={{__html:n.description}}/>
            )}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-gray-400">
                Acertos: {n.reviewCount - n.wrongCount} · Erros: {n.wrongCount}x
                {!n.pending && n.nextReviewAt && (
                  <span className="ml-2 text-teal-600 font-medium">
                    · volta em {new Date(n.nextReviewAt).toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"})}
                    {n.intervalDays >= 90 ? " (dominado 🎯)" : n.intervalDays >= 30 ? " (+30d)" : n.intervalDays >= 7 ? " (+7d)" : " (+1d)"}
                  </span>
                )}
              </p>
              {n.pending && (
                <div className="flex gap-1.5">
                  {!isDecoreta && <>
                  <button onClick={()=>action(n.id,"wrong")} className="flex items-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg text-xs font-medium transition-colors"><XCircle className="w-4 h-4"/> Errei</button>
                  <button onClick={()=>action(n.id,"correct")} className="flex items-center gap-1.5 px-3 py-2 bg-green-50 hover:bg-green-100 text-green-600 border border-green-200 rounded-lg text-xs font-medium transition-colors"><CheckCircle className="w-4 h-4"/> Acertei</button>
                </>}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const TABS = [
    { key:"cadernos",  label:"Meus Cadernos",  icon:BookMarked },
    { key:"registrar", label:"Registrar Erro",  icon:Plus },
    { key:"evolucao",  label:"Evolução",        icon:BarChart2 },
    { key:"pesquisa",  label:"Pesquisar",       icon:Search },
  ] as const;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="text-white px-8" style={{ backgroundColor: "#1B4040", minHeight: "124px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <h1 className="text-3xl font-bold">Caderno de Erros</h1>
        <p className="text-gray-400 text-sm mt-1">Transforme seus erros em evolução</p>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-8">
        <div className="flex gap-0">
          {TABS.map(({key,label,icon:Icon})=>(
            <button key={key} onClick={()=>setTab(key as Tab)}
              className={`flex items-center gap-2 px-5 py-4 text-sm font-medium border-b-2 transition-colors ${tab===key?"border-gray-900 text-gray-900":"border-transparent text-gray-500 hover:text-gray-700"}`}>
              <Icon className="w-4 h-4"/>{label}
            </button>
          ))}
        </div>
      </div>

      {/* Modal edição */}
      {editingNote&&(
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Editar erro</h2>
              <button onClick={()=>setEditingNote(null)} className="p-2 text-gray-400 hover:text-gray-700 rounded-lg"><X className="w-5 h-5"/></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Disciplina</label>
                <select value={editSubjectId} onChange={e=>setEditSubjectId(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                  {subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Tópico / Conteúdo</label>
                <input value={editTopic} onChange={e=>setEditTopic(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"/>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Dificuldade</label>
                <select value={editDifficulty} onChange={e=>setEditDifficulty(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                  {["Baixa","Media","Alta"].map(d=><option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Motivo</label>
                <select value={editErrorType} onChange={e=>setEditErrorType(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                  <option value="">Selecione</option>
                  {ERROR_TYPES.map(t=><option key={t.value} value={t.value}>{t.emoji} {t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Banca</label>
                <input value={editBanca} onChange={e=>setEditBanca(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"/>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Questão / Título</label>
              <RichEditor key={`edit-title-${editingNote?.id}`} value={editTitle} onChange={setEditTitle} minRows={2}/>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Explicação</label>
              <RichEditor key={`edit-desc-${editingNote?.id}`} value={editDesc} onChange={setEditDesc} minRows={4}/>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={saveEdit} disabled={savingEdit} className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 hover:bg-gray-700 text-white font-semibold rounded-xl text-sm disabled:opacity-50">
                <Check className="w-4 h-4"/>{savingEdit?"Salvando...":"Salvar"}
              </button>
              <button onClick={()=>setEditingNote(null)} className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-sm">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <div className="px-8 py-8">

        {/* ── ABA: MEUS CADERNOS ─────────────────────────────────────────────── */}
        {tab==="cadernos"&&(
          <div className="space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-4 gap-4">
              {[["Total",notes.length,"text-gray-900"],["Pendentes",metrics.pending,"text-red-600"],["Resolvidos",metrics.resolved,"text-green-600"],["Críticos",metrics.critical,"text-orange-600"],["Decorebas",notes.filter(n=>n.errorType==="decoreba").length,"text-purple-600"]].map(([l,v,c])=>(
                <div key={l as string} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                  <p className="text-xs text-gray-500 mb-1">{l}</p>
                  <p className={`text-3xl font-bold ${c}`}>{v}</p>
                </div>
              ))}
            </div>

            {/* Filtro status */}
            <div className="flex gap-2">
              {(["pending","all","resolved"] as const).map(f=>(
                <button key={f} onClick={()=>setFilter(f)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${filter===f?"bg-gray-900 text-white":"bg-white border border-gray-200 text-gray-600 hover:border-gray-400"}`}>
                  {f==="pending"?"Pendentes":f==="all"?"Todos":"Resolvidos"}
                </button>
              ))}
              <button onClick={()=>setFilter("decoreba")}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${filter==="decoreba"?"bg-purple-700 text-white":"bg-purple-100 border border-purple-200 text-purple-700 hover:bg-purple-200"}`}>
                📌 Decoreba
              </button>
            </div>

            {/* Pastas agrupadas */}
            <div className="space-y-3">
              {Object.keys(grouped).length===0&&(
                <div className="text-center py-16 text-gray-400">
                  <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30"/>
                  <p>Nenhum erro {filter==="pending"?"pendente":filter==="resolved"?"resolvido":"registrado"}.</p>
                  <button onClick={()=>setTab("registrar")} className="mt-3 text-blue-600 text-sm hover:underline">Registrar primeiro erro →</button>
                </div>
              )}
              {Object.entries(grouped).map(([subName,subData])=>{
                const isExp = expandedSubs.has(subName);
                const total = subData.noTopic.length + Object.values(subData.topics).reduce((a,arr)=>a+arr.length,0);
                return (
                  <div key={subName} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                    <button onClick={()=>setExpandedSubs(p=>{const n=new Set(p);n.has(subName)?n.delete(subName):n.add(subName);return n;})}
                      className="w-full flex items-center gap-3 px-6 py-4 hover:bg-gray-50 transition-colors text-left">
                      {isExp?<ChevronDown className="w-5 h-5 text-gray-400 shrink-0"/>:<ChevronRight className="w-5 h-5 text-gray-400 shrink-0"/>}
                      <div className="flex-1">
                        <p className="font-bold text-gray-900">{subName}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{total} erro{total!==1?"s":""}{Object.keys(subData.topics).length>0&&` · ${Object.keys(subData.topics).length} tópico${Object.keys(subData.topics).length!==1?"s":""}`}</p>
                      </div>
                    </button>
                    {isExp&&(
                      <div className="border-t border-gray-100">
                        {subData.noTopic.length>0&&(
                          <div className="px-6 py-4 space-y-3 bg-gray-50/40">
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Sem tópico</p>
                            {subData.noTopic.map(n=><NoteCard key={n.id} n={n}/>)}
                          </div>
                        )}
                        {Object.entries(subData.topics).map(([tName,tNotes])=>{
                          const tk=`${subName}::${tName}`;
                          const tExp=expandedTopics.has(tk);
                          return (
                            <div key={tName} className="border-t border-gray-100">
                              <button onClick={()=>setExpandedTopics(p=>{const n=new Set(p);n.has(tk)?n.delete(tk):n.add(tk);return n;})}
                                className="w-full flex items-center gap-3 px-8 py-3.5 hover:bg-gray-50 transition-colors text-left">
                                {tExp?<ChevronDown className="w-4 h-4 text-gray-400 shrink-0"/>:<ChevronRight className="w-4 h-4 text-gray-400 shrink-0"/>}
                                <div className="flex-1">
                                  <p className="text-sm font-semibold text-gray-700">› {tName}</p>
                                  <p className="text-xs text-gray-400">{tNotes.length} erro{tNotes.length!==1?"s":""}</p>
                                </div>
                              </button>
                              {tExp&&<div className="px-8 pb-4 space-y-3 bg-gray-50/20">{tNotes.map(n=><NoteCard key={n.id} n={n}/>)}</div>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── ABA: REGISTRAR ─────────────────────────────────────────────────── */}
        {tab==="registrar"&&(
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2 bg-white rounded-2xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold mb-5">Registrar novo erro</h2>
              <form onSubmit={add} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Disciplina *</label>
                    <select value={subjectId} onChange={e=>setSubjectId(e.target.value)} required className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                      <option value="">Selecione</option>
                      {subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Tópico / Conteúdo</label>
                    <div className="relative">
                      <input
                        value={topic}
                        onChange={e => setTopic(e.target.value)}
                        onFocus={() => setTopicFocused(true)}
                        onBlur={() => setTimeout(() => setTopicFocused(false), 150)}
                        placeholder="Ex: Conceito de Tributo"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                        autoComplete="off"
                      />
                      {topicFocused && subjectId && (() => {
                        const currentSubject = subjects.find(s => s.id === subjectId);
                        const q = topic.toLowerCase();

                        // 1. Tópicos cadastrados em Matérias (fonte principal — só nomes de tópicos, sem PDFs)
                        const fromMaterias: string[] = [];
                        (currentSubject?.topics ?? []).forEach(t => {
                          if (!q || t.name.toLowerCase().includes(q)) fromMaterias.push(t.name);
                        });

                        // 2. Tópicos de erros já registrados (complemento)
                        const fromNotes = notes
                          .filter(n => n.subject.name === (subjects.find(s => s.id === subjectId)?.name ?? "") && n.topic && n.topic.toLowerCase().includes(q))
                          .map(n => n.topic!);

                        const suggestions = [...new Set([...fromMaterias, ...fromNotes])].slice(0, 30);
                        if (!suggestions.length) return null;
                        return (
                          <ul className="absolute z-20 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                            {suggestions.map(s => (
                              <li key={s}
                                onMouseDown={() => { setTopic(s); setTopicFocused(false); }}
                                className="px-3 py-2 text-sm text-gray-700 hover:bg-teal-50 hover:text-teal-700 cursor-pointer truncate">
                                {s}
                              </li>
                            ))}
                          </ul>
                        );
                      })()}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Dificuldade</label>
                    <select value={difficulty} onChange={e=>setDifficulty(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                      {["Baixa","Media","Alta"].map(d=><option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Motivo</label>
                    <select value={errorType} onChange={e=>setErrorType(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900">
                      <option value="">Selecione</option>
                      {ERROR_TYPES.map(t=><option key={t.value} value={t.value}>{t.emoji} {t.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Banca</label>
                    <input value={banca} onChange={e=>setBanca(e.target.value)} placeholder="Ex: FGV" className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"/>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Questão / Título *</label>
                  <RichEditor value={title} onChange={setTitle} placeholder="Digite a questão ou o título do erro..." minRows={2}/>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Por que errei / Explicação *</label>
                  <RichEditor value={desc} onChange={setDesc} placeholder="Explique o conceito correto, o que confundiu, como lembrar..." minRows={5}/>
                </div>
                <div className="flex items-center gap-4">
                  <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 hover:bg-gray-700 text-white font-semibold rounded-xl text-sm disabled:opacity-50 transition-colors">
                    <Plus className="w-4 h-4"/>{saving?"Salvando...":"Registrar erro"}
                  </button>
                  {saved&&<span className="text-green-600 text-sm font-medium">✓ Erro registrado!</span>}
                </div>
              </form>
            </div>
            <div className="col-span-1 bg-white rounded-2xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-1">Tipos de erro</h2>
              <p className="text-xs text-gray-400 mb-3">Clique para selecionar.</p>
              <div className="space-y-2">
                {ERROR_TYPES.map(t=>(
                  <button key={t.value} type="button" onClick={()=>setErrorType(t.value)}
                    className={`w-full flex items-start gap-2 p-2.5 rounded-xl text-left transition-colors border ${errorType===t.value?"border-gray-900 bg-gray-50":"border-gray-100 bg-gray-50 hover:border-gray-300"}`}>
                    <span className="text-base shrink-0">{t.emoji}</span>
                    <div>
                      <p className="text-xs font-semibold text-gray-800">{t.label}</p>
                      <p className="text-xs text-gray-400 leading-tight">{t.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── ABA: EVOLUÇÃO ──────────────────────────────────────────────────── */}
        {tab==="evolucao"&&<EvolucaoTab notes={notes} metrics={metrics}/>}

        {/* ── ABA: PESQUISA ──────────────────────────────────────────────────── */}
        {tab==="pesquisa"&&(
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 p-6">
              <label className="block text-sm font-semibold text-gray-700 mb-3">Buscar por palavra-chave</label>
              <div className="relative">
                <Search className="absolute left-4 top-3.5 w-4 h-4 text-gray-400"/>
                <input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="Ex: tributo, pegadinha, FGV, imposto..."
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"/>
              </div>
              {searchQuery&&<p className="text-xs text-gray-500 mt-2">{searchResults.length} resultado{searchResults.length!==1?"s":""} encontrado{searchResults.length!==1?"s":""}</p>}
            </div>
            <div className="space-y-3">
              {searchQuery&&searchResults.length===0&&(
                <div className="text-center py-12 text-gray-400">Nenhum resultado para "{searchQuery}".</div>
              )}
              {searchResults.map(n=><NoteCard key={n.id} n={n}/>)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
