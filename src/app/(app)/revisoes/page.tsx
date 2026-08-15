"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle, Clock, TrendingUp, BookOpen, RefreshCw, ChevronDown, ChevronUp, Filter } from "lucide-react";

const BG = "#1B4040";

interface ConsolidationItem {
  id: string; type: "errorNote" | "pdfReview";
  title: string; subjectName: string; subjectId: string;
  editalWeight: number; wrongCount: number; reviewCount: number;
  instability: number; daysOverdue: number; intervalDays: number;
  accuracyPct: number | null; score: number; nextIntervalDays: number;
  pdfId?: string; pdfTitle?: string; reviewId?: string; reviewType?: string;
}
interface Summary { total: number; errorNotes: number; pdfReviews: number; critical: number; overdue: number; }

function priorityLabel(score: number): { label: string; color: string; bg: string } {
  if (score >= 30) return { label: "Crítico",  color: "#DC2626", bg: "#FEF2F2" };
  if (score >= 20) return { label: "Alto",     color: "#EA580C", bg: "#FFF7ED" };
  if (score >= 10) return { label: "Médio",    color: "#CA8A04", bg: "#FEFCE8" };
  return               { label: "Normal",    color: "#16A34A", bg: "#F0FDF4" };
}

function ScoreBar({ score, max }: { score: number; max: number }) {
  const pct = Math.min(100, Math.round((score / Math.max(max, 1)) * 100));
  const color = score >= 30 ? "#DC2626" : score >= 20 ? "#EA580C" : score >= 10 ? "#CA8A04" : "#16A34A";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-mono text-gray-400 w-10 text-right">{score}</span>
    </div>
  );
}

function ReviewCard({ item, maxScore, onDone }: { item: ConsolidationItem; maxScore: number; onDone: (id: string, type: string) => void }) {
  const [expanded,  setExpanded]  = useState(false);
  const [acertos,   setAcertos]   = useState(0);
  const [erros,     setErros]     = useState(0);
  const [saving,    setSaving]    = useState(false);
  const [done,      setDone]      = useState(false);
  const { label, color, bg } = priorityLabel(item.score);

  const handleMark = async () => {
    setSaving(true);
    const res = await fetch("/api/motor-revisao", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: item.id, type: item.type,
        acertos, erros,
        nextIntervalDays: item.nextIntervalDays,
      }),
    });
    if (res.ok) { setDone(true); onDone(item.id, item.type); }
    setSaving(false);
  };

  if (done) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setExpanded(e => !e)}>
        <div className="flex items-start gap-3">
          {/* Prioridade badge */}
          <span className="shrink-0 mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide"
            style={{ backgroundColor: bg, color }}>
            {label}
          </span>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{item.title}</p>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-xs text-gray-500">{item.subjectName}</span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                {item.type === "errorNote" ? "Erro do Caderno" : "Revisão de PDF"}
              </span>
              {item.daysOverdue > 0 && (
                <span className="text-xs font-semibold text-red-600 flex items-center gap-1">
                  <Clock className="w-3 h-3" />{item.daysOverdue}d atrasado
                </span>
              )}
              {item.accuracyPct !== null && (
                <span className="text-xs text-gray-500">{item.accuracyPct}% acerto</span>
              )}
            </div>
            <div className="mt-2">
              <ScoreBar score={item.score} max={maxScore} />
            </div>
          </div>

          <div className="shrink-0 text-gray-400">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-5 py-4 bg-gray-50">
          {/* Fatores do score */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {[
              { label: "Peso no edital", value: `${item.editalWeight}/10`, icon: TrendingUp, color: "text-blue-600" },
              { label: "Erros acumulados", value: item.wrongCount, icon: AlertTriangle, color: "text-red-600" },
              { label: "Instabilidade", value: `${Math.round(item.instability * 100)}%`, icon: RefreshCw, color: "text-orange-600" },
              { label: "Intervalo atual", value: `${item.intervalDays}d`, icon: Clock, color: "text-gray-600" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-white rounded-xl p-3 border border-gray-100">
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className={`w-3.5 h-3.5 ${color}`} />
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</p>
                </div>
                <p className={`text-lg font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Só ErrorNote tem campos de acertos/erros */}
          {item.type === "errorNote" && (
            <div className="flex items-center gap-4 mb-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Acertos nesta revisão</label>
                <div className="flex items-center gap-2">
                  <button onClick={() => setAcertos(a => Math.max(0, a - 1))} className="w-7 h-7 rounded-lg bg-gray-200 text-gray-700 font-bold hover:bg-gray-300">−</button>
                  <span className="w-8 text-center font-bold text-green-600">{acertos}</span>
                  <button onClick={() => setAcertos(a => a + 1)} className="w-7 h-7 rounded-lg bg-gray-200 text-gray-700 font-bold hover:bg-gray-300">+</button>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Erros nesta revisão</label>
                <div className="flex items-center gap-2">
                  <button onClick={() => setErros(e => Math.max(0, e - 1))} className="w-7 h-7 rounded-lg bg-gray-200 text-gray-700 font-bold hover:bg-gray-300">−</button>
                  <span className="w-8 text-center font-bold text-red-600">{erros}</span>
                  <button onClick={() => setErros(e => e + 1)} className="w-7 h-7 rounded-lg bg-gray-200 text-gray-700 font-bold hover:bg-gray-300">+</button>
                </div>
              </div>
              {item.nextIntervalDays > 0 && (
                <div className="ml-auto text-right">
                  <p className="text-[10px] text-gray-400">Próxima revisão em</p>
                  <p className="text-sm font-semibold text-gray-700">{item.nextIntervalDays} dias</p>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button onClick={handleMark} disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors"
              style={{ backgroundColor: BG }}>
              <CheckCircle className="w-4 h-4" />
              {saving ? "Salvando..." : "Marcar como revisado"}
            </button>
            {item.type === "errorNote" && (
              <Link href={`/caderno?id=${item.id}`}
                className="px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-100 transition-colors">
                Ver no Caderno
              </Link>
            )}
            {item.type === "pdfReview" && item.pdfId && (
              <Link href={`/sessao?pdfId=${item.pdfId}`}
                className="px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-100 transition-colors">
                Sessão de Estudo
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function RevisoesPage() {
  const [items,     setItems]     = useState<ConsolidationItem[]>([]);
  const [summary,   setSummary]   = useState<Summary | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState<"all" | "errorNote" | "pdfReview" | "critical" | "overdue">("all");
  const [subFilter, setSubFilter] = useState<string>("all");
  const [subjects,  setSubjects]  = useState<string[]>([]);

  const load = () => {
    setLoading(true);
    fetch("/api/motor-revisao")
      .then(r => r.json())
      .then(d => {
        setItems(d.items ?? []);
        setSummary(d.summary ?? null);
        const subs = [...new Set((d.items ?? []).map((i: ConsolidationItem) => i.subjectName))].sort() as string[];
        setSubjects(subs);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const onDone = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
    setSummary(prev => prev ? { ...prev, total: prev.total - 1 } : prev);
  };

  const filtered = items.filter(i => {
    if (filter === "errorNote" && i.type !== "errorNote") return false;
    if (filter === "pdfReview" && i.type !== "pdfReview") return false;
    if (filter === "critical"  && i.score < 20) return false;
    if (filter === "overdue"   && i.daysOverdue === 0) return false;
    if (subFilter !== "all" && i.subjectName !== subFilter) return false;
    return true;
  });

  const maxScore = Math.max(...items.map(i => i.score), 1);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="text-white px-8" style={{ backgroundColor: BG, minHeight: "124px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <h1 className="text-3xl font-bold">Revisões</h1>
        <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.6)" }}>
          Motor de Consolidação — priorizado por aprovação
        </p>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">

        {/* KPIs */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: "Total",       value: summary.total,      color: "text-gray-900",   bg: "bg-white" },
              { label: "Erros",       value: summary.errorNotes, color: "text-red-600",    bg: "bg-white" },
              { label: "PDFs",        value: summary.pdfReviews, color: "text-blue-600",   bg: "bg-white" },
              { label: "Críticos",    value: summary.critical,   color: "text-orange-600", bg: summary.critical > 0 ? "bg-orange-50" : "bg-white" },
              { label: "Atrasados",   value: summary.overdue,    color: "text-red-700",    bg: summary.overdue > 0 ? "bg-red-50" : "bg-white" },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className={`${bg} rounded-xl border border-gray-200 p-4 text-center`}>
                <p className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">{label}</p>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filtros */}
        <div className="flex flex-wrap gap-2 items-center">
          <Filter className="w-4 h-4 text-gray-400" />
          {([
            { key: "all",       label: "Todos" },
            { key: "critical",  label: "🔴 Críticos" },
            { key: "overdue",   label: "⏰ Atrasados" },
            { key: "errorNote", label: "Caderno de Erros" },
            { key: "pdfReview", label: "Revisão de PDF" },
          ] as const).map(({ key, label }) => (
            <button key={key} onClick={() => setFilter(key)}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors"
              style={filter === key ? { backgroundColor: BG, color: "#fff" } : { backgroundColor: "#f3f4f6", color: "#6b7280" }}>
              {label}
            </button>
          ))}
          {subjects.length > 1 && (
            <select value={subFilter} onChange={e => setSubFilter(e.target.value)}
              className="text-xs border border-gray-200 rounded-xl px-3 py-1.5 bg-white text-gray-700 focus:outline-none ml-2">
              <option value="all">Todas as matérias</option>
              {subjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
        </div>

        {/* Lista */}
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-20 bg-white rounded-2xl border border-gray-200 animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
            <p className="text-gray-700 font-semibold">Nenhuma revisão pendente</p>
            <p className="text-gray-400 text-sm mt-1">
              {filter !== "all" ? "Tente remover o filtro." : "Tudo em dia. Continue estudando!"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(item => (
              <ReviewCard key={item.id} item={item} maxScore={maxScore} onDone={onDone} />
            ))}
          </div>
        )}

        {/* Legenda do score */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" /> Como o Motor de Consolidação prioriza
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-gray-500">
            <div className="flex items-start gap-2">
              <span className="text-blue-600 font-bold mt-0.5">1.</span>
              <span><strong className="text-gray-700">Peso no edital</strong> — conteúdos mais cobrados em concursos sobem na fila</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-red-600 font-bold mt-0.5">2.</span>
              <span><strong className="text-gray-700">Erros acumulados</strong> — cada erro conta +3 pontos no score</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-orange-600 font-bold mt-0.5">3.</span>
              <span><strong className="text-gray-700">Instabilidade</strong> — conteúdo que você continua errando mesmo após revisões</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-yellow-600 font-bold mt-0.5">4.</span>
              <span><strong className="text-gray-700">Urgência</strong> — cada dia de atraso aumenta o score automaticamente</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
