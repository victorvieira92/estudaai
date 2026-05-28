"use client";
import { useEffect, useState, useCallback } from "react";
import { ChevronDown, ChevronUp, Check, Plus, Link as LinkIcon } from "lucide-react";
import { useRouter } from "next/navigation";

const BG = "#1B4040";
const TEAL = "#2DD4BF";

interface Topico {
  nome:        string;
  ordem:       number;
  concluido:   boolean;
  questoes:    number;
  acertos:     number;
  erros:       number;
  ultimoEstudo: string | null;
}

interface Disciplina { nome: string; topicos: Topico[]; }
interface Modulo     { modulo: string; disciplinas: Disciplina[]; }

interface EditalData {
  totalTopicos: number;
  concluidos:   number;
  modulos:      Modulo[];
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function AccuracyBadge({ pct }: { pct: number }) {
  const bg = pct >= 70 ? "#22c55e" : pct >= 50 ? "#f59e0b" : pct > 0 ? "#ef4444" : "#e5e7eb";
  const tc = pct > 0 ? "#fff" : "#9ca3af";
  return (
    <span className="text-[11px] font-bold px-2 py-0.5 rounded min-w-[36px] text-center inline-block"
      style={{ backgroundColor: bg, color: tc }}>
      {pct > 0 ? `${pct}%` : "0"}
    </span>
  );
}

function TopicoRow({
  topico, disciplina, modulo, onUpdate,
}: {
  topico: Topico; disciplina: string; modulo: string;
  onUpdate: (disc: string, top: string, mod: string, data: Partial<Topico>) => void;
}) {
  const [editing, setEditing]   = useState(false);
  const [acertos, setAcertos]   = useState(String(topico.acertos));
  const [erros,   setErros]     = useState(String(topico.erros));
  const router = useRouter();

  const pct = topico.questoes > 0
    ? Math.round((topico.acertos / topico.questoes) * 100)
    : 0;

  const toggleConcluido = () => {
    onUpdate(disciplina, topico.nome, modulo, { concluido: !topico.concluido });
  };

  const saveQuestoes = () => {
    const a = parseInt(acertos) || 0;
    const e = parseInt(erros)   || 0;
    onUpdate(disciplina, topico.nome, modulo, { acertos: a, erros: e, questoes: a + e });
    setEditing(false);
  };

  const goToSessao = () => {
    router.push(`/sessao?topicName=${encodeURIComponent(topico.nome)}`);
  };

  return (
    <div className={`group flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 hover:bg-gray-50 transition-colors ${topico.concluido ? "bg-green-50/40" : ""}`}>
      {/* Checkbox */}
      <button onClick={toggleConcluido}
        className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
          topico.concluido ? "border-teal-500 bg-teal-500" : "border-gray-300 hover:border-teal-400"
        }`}>
        {topico.concluido && <Check size={10} strokeWidth={3} className="text-white" />}
      </button>

      {/* Nome do tópico */}
      <span className={`flex-1 text-sm min-w-0 ${topico.concluido ? "line-through text-gray-400" : "text-gray-800"}`}>
        {topico.nome}
      </span>

      {/* Questões inline edit */}
      {editing ? (
        <div className="flex items-center gap-1.5 shrink-0">
          <input type="number" min="0" value={acertos} onChange={e => setAcertos(e.target.value)}
            className="w-12 border border-teal-300 rounded px-1 py-0.5 text-xs text-center text-green-600 font-bold focus:outline-none"
            placeholder="✓" />
          <span className="text-gray-400 text-xs">/</span>
          <input type="number" min="0" value={erros} onChange={e => setErros(e.target.value)}
            className="w-12 border border-teal-300 rounded px-1 py-0.5 text-xs text-center text-red-500 font-bold focus:outline-none"
            placeholder="✗" />
          <button onClick={saveQuestoes}
            className="px-2 py-0.5 rounded text-xs font-semibold text-white"
            style={{ backgroundColor: BG }}>OK</button>
          <button onClick={() => setEditing(false)} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
        </div>
      ) : (
        <div className="flex items-center gap-3 shrink-0">
          {topico.questoes > 0 ? (
            <>
              <span className="text-sm font-bold text-green-500 w-6 text-center">{topico.acertos}</span>
              <span className="text-sm font-bold text-red-500 w-6 text-center">{topico.erros}</span>
              <span className="text-sm text-gray-500 w-6 text-center">{topico.questoes}</span>
              <AccuracyBadge pct={pct} />
            </>
          ) : (
            <>
              <span className="text-sm text-gray-300 w-6 text-center">0</span>
              <span className="text-sm text-gray-300 w-6 text-center">0</span>
              <span className="text-sm text-gray-300 w-6 text-center">0</span>
              <AccuracyBadge pct={0} />
            </>
          )}
          <span className="text-xs text-gray-400 w-16 text-center">{fmtDate(topico.ultimoEstudo)}</span>
          <button onClick={() => setEditing(true)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-teal-100 text-teal-600"
            title="Registrar questões">
            <Plus size={13} />
          </button>
          <button onClick={goToSessao}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-gray-100 text-gray-500"
            title="Registrar estudo">
            <LinkIcon size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

function DisciplinaSection({
  disc, modulo, onUpdate,
}: {
  disc: Disciplina; modulo: string;
  onUpdate: (disc: string, top: string, mod: string, data: Partial<Topico>) => void;
}) {
  const [open, setOpen] = useState(false);
  const concluidos = disc.topicos.filter(t => t.concluido).length;
  const total      = disc.topicos.length;
  const pct        = Math.round((concluidos / total) * 100);
  const totalAcertos  = disc.topicos.reduce((a, t) => a + t.acertos, 0);
  const totalErros    = disc.topicos.reduce((a, t) => a + t.erros, 0);
  const totalQuestoes = disc.topicos.reduce((a, t) => a + t.questoes, 0);
  const discPct = totalQuestoes > 0 ? Math.round((totalAcertos / totalQuestoes) * 100) : 0;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-3">
      {/* Header da disciplina */}
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors text-left">
        {/* Barra de progresso lateral */}
        <div className="w-1 h-8 rounded-full bg-gray-100 shrink-0 overflow-hidden">
          <div className="w-full rounded-full transition-all duration-500"
            style={{ height: `${pct}%`, backgroundColor: TEAL }} />
        </div>

        {/* Nome */}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 text-sm uppercase tracking-wide">{disc.nome}</p>
          <p className="text-xs text-gray-500 mt-0.5">{concluidos} de {total} tópicos concluídos</p>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 shrink-0">
          {totalQuestoes > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <span className="font-bold text-green-500">{totalAcertos}</span>
              <span className="font-bold text-red-500">{totalErros}</span>
              <AccuracyBadge pct={discPct} />
            </div>
          )}
          {/* Progress badge */}
          <span className="text-xs font-bold px-2.5 py-1 rounded-full text-white"
            style={{ backgroundColor: pct === 100 ? "#22c55e" : pct > 0 ? BG : "#9ca3af" }}>
            {pct}%
          </span>
          {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </button>

      {/* Tópicos */}
      {open && (
        <div>
          {/* Header das colunas */}
          <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 border-t border-b border-gray-100">
            <div className="w-4 shrink-0" />
            <span className="flex-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">Tópicos</span>
            <div className="flex items-center gap-3 shrink-0 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              <span className="w-6 text-center text-green-500">✓</span>
              <span className="w-6 text-center text-red-500">✗</span>
              <span className="w-6 text-center">Total</span>
              <span className="w-9 text-center">%</span>
              <span className="w-16 text-center">Último Est.</span>
              <span className="w-12" />
            </div>
          </div>
          {disc.topicos.map(t => (
            <TopicoRow key={t.nome} topico={t} disciplina={disc.nome} modulo={modulo} onUpdate={onUpdate} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function EditalPage() {
  const [data,    setData]    = useState<EditalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [openMod, setOpenMod] = useState<Record<string, boolean>>({});

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/edital")
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleUpdate = useCallback(async (
    disciplina: string, topico: string, modulo: string, updates: Partial<Topico>
  ) => {
    // Optimistic update
    setData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        concluidos: prev.concluidos + (updates.concluido === true ? 1 : updates.concluido === false ? -1 : 0),
        modulos: prev.modulos.map(m => ({
          ...m,
          disciplinas: m.disciplinas.map(d => ({
            ...d,
            topicos: d.topicos.map(t =>
              d.nome === disciplina && t.nome === topico ? { ...t, ...updates } : t
            ),
          })),
        })),
      };
    });

    await fetch("/api/edital", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ disciplina, topico, modulo, ...updates }),
    });
  }, []);

  const pctGeral = data ? Math.round((data.concluidos / data.totalTopicos) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="text-white px-8"
        style={{ backgroundColor: BG, minHeight: 124, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <h1 className="text-3xl font-bold">Edital Verticalizado</h1>
        <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.6)" }}>
          Auditor-Fiscal da Receita Federal do Brasil — RFB 2022
        </p>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* Barra de progresso geral */}
        {data && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Progresso no Edital</p>
                <p className="text-sm text-gray-600 mt-0.5">{data.concluidos} de {data.totalTopicos} tópicos concluídos</p>
              </div>
              <span className="text-4xl font-bold" style={{ color: BG }}>{pctGeral}%</span>
            </div>
            <div className="w-full h-3 rounded-full bg-gray-100 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pctGeral}%`, backgroundColor: TEAL }} />
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: BG }} />
          </div>
        )}

        {/* Progresso por módulo/área */}
        {data && data.modulos.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4">Progresso por Área</p>
            <div className="space-y-3">
              {data.modulos.map(mod => {
                const allTopicos = mod.disciplinas.flatMap(d => d.topicos);
                const total      = allTopicos.length;
                const concl      = allTopicos.filter(t => t.concluido).length;
                const pct        = total > 0 ? Math.round((concl / total) * 100) : 0;
                const totalQ     = allTopicos.reduce((a, t) => a + t.questoes, 0);
                const totalAc    = allTopicos.reduce((a, t) => a + t.acertos, 0);
                const acc        = totalQ > 0 ? Math.round((totalAc / totalQ) * 100) : null;
                return (
                  <div key={mod.modulo}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-700">{mod.modulo}</span>
                        <span className="text-xs text-gray-400">{concl}/{total}</span>
                        {acc !== null && (
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                            acc >= 70 ? "bg-green-100 text-green-700"
                            : acc >= 50 ? "bg-yellow-100 text-yellow-700"
                            : "bg-red-100 text-red-700"
                          }`}>{acc}%</span>
                        )}
                      </div>
                      <span className="text-xs font-bold" style={{ color: pct === 100 ? "#22c55e" : BG }}>
                        {pct}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, backgroundColor: pct === 100 ? "#22c55e" : TEAL }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Módulos e Disciplinas */}
        {!loading && data?.modulos.map(mod => (
          <div key={mod.modulo}>
            {/* Header do módulo */}
            <button
              onClick={() => setOpenMod(prev => ({ ...prev, [mod.modulo]: !prev[mod.modulo] }))}
              className="w-full flex items-center gap-3 mb-4 group"
            >
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full text-white shrink-0"
                style={{ backgroundColor: BG }}>
                {mod.modulo}
              </span>
              <div className="flex-1 h-px bg-gray-200" />
              {openMod[mod.modulo] === false
                ? <ChevronDown size={14} className="text-gray-400 shrink-0" />
                : <ChevronUp size={14} className="text-gray-400 shrink-0" />}
            </button>

            {openMod[mod.modulo] !== false && (
              <div>
                {mod.disciplinas.map(disc => (
                  <DisciplinaSection
                    key={disc.nome}
                    disc={disc}
                    modulo={mod.modulo}
                    onUpdate={handleUpdate}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
