"use client";
import { useEffect, useState } from "react";
import { ScrollText, Upload, CheckSquare, Square, ChevronDown, ChevronRight, Loader2, AlertCircle } from "lucide-react";

const BG = "#1B4040";

interface Topico {
  id: string; nome: string; concluido: boolean;
  questoes: number; acertos: number; erros: number; ultimoEstudo: string | null;
}
interface Disciplina { nome: string; topicos: Topico[]; }
interface Modulo { modulo: string; disciplinas: Disciplina[]; }
interface LastImport { title: string; sourceUrl: string; importedAt: string; totalTopics: number; }

export default function MeuEditalPage() {
  const [modulos,      setModulos]      = useState<Modulo[]>([]);
  const [lastImport,   setLastImport]   = useState<LastImport | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [importing,    setImporting]    = useState(false);
  const [importUrl,    setImportUrl]    = useState("");
  const [importError,  setImportError]  = useState("");
  const [importResult, setImportResult] = useState<any>(null);
  const [expanded,     setExpanded]     = useState<Record<string, boolean>>({});

  const load = () => {
    setLoading(true);
    fetch("/api/edital-import")
      .then(r => r.json())
      .then(d => { setModulos(d.modulos ?? []); setLastImport(d.lastImport ?? null); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const toggleModulo = (nome: string) =>
    setExpanded(prev => ({ ...prev, [nome]: !prev[nome] }));

  const toggleTopico = async (topico: Topico) => {
    const newVal = !topico.concluido;
    // Optimistic update
    setModulos(prev => prev.map(m => ({
      ...m,
      disciplinas: m.disciplinas.map(d => ({
        ...d,
        topicos: d.topicos.map(t => t.id === topico.id ? { ...t, concluido: newVal } : t),
      })),
    })));
    await fetch("/api/edital-import", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ id: topico.id, concluido: newVal }),
    }).catch(console.error);
  };

  const doImport = async () => {
    if (!importUrl.trim()) return;
    setImporting(true); setImportError(""); setImportResult(null);
    const res = await fetch("/api/edital-import", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ url: importUrl }),
    });
    const data = await res.json();
    setImporting(false);
    if (!res.ok) { setImportError(data.error ?? "Erro ao importar."); return; }
    setImportResult(data);
    setImportUrl("");
    load();
  };

  const totalTopicos   = modulos.reduce((a, m) => a + m.disciplinas.reduce((b, d) => b + d.topicos.length, 0), 0);
  const totalConcluidos = modulos.reduce((a, m) => a + m.disciplinas.reduce((b, d) => b + d.topicos.filter(t => t.concluido).length, 0), 0);
  const pct = totalTopicos > 0 ? Math.round((totalConcluidos / totalTopicos) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="text-white px-8 py-8" style={{ backgroundColor: BG }}>
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-1">
            <ScrollText className="w-6 h-6 opacity-70" />
            <h1 className="text-3xl font-bold">Meu Edital</h1>
          </div>
          <p className="text-sm opacity-60">Importe qualquer edital do TEC Concursos e acompanhe seu progresso</p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* Import box */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <p className="text-sm font-semibold text-gray-700 mb-3">Importar do TEC Concursos</p>
          <p className="text-xs text-gray-400 mb-3">
            Cole a URL do guia de estudos do TEC. Ex: <code className="bg-gray-100 px-1 rounded">https://www.tecconcursos.com.br/guias/srfb-2022/auditor-fiscal-da-receita-federal-do-brasil/-/-</code>
          </p>
          <div className="flex gap-2">
            <input
              type="url"
              value={importUrl}
              onChange={e => setImportUrl(e.target.value)}
              onKeyDown={e => e.key === "Enter" && doImport()}
              placeholder="https://www.tecconcursos.com.br/guias/..."
              className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-teal-400"
            />
            <button onClick={doImport} disabled={importing || !importUrl.trim()}
              className="flex items-center gap-2 px-5 py-2.5 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors"
              style={{ backgroundColor: BG }}>
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {importing ? "Importando..." : "Importar"}
            </button>
          </div>

          {importError && (
            <div className="mt-3 flex items-start gap-2 text-red-600 text-sm bg-red-50 rounded-xl p-3">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              {importError}
            </div>
          )}

          {importResult && (
            <div className="mt-3 bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-green-700 font-semibold text-sm mb-1">✓ Importado com sucesso!</p>
              <p className="text-green-600 text-xs">{importResult.title}</p>
              <p className="text-green-600 text-xs">{importResult.totalTopics} tópicos · {importResult.modulos} módulos</p>
            </div>
          )}

          {lastImport && !importResult && (
            <p className="mt-3 text-xs text-gray-400">
              Última importação: <strong>{lastImport.title}</strong> · {lastImport.totalTopics} tópicos · {new Date(lastImport.importedAt).toLocaleDateString("pt-BR")}
            </p>
          )}
        </div>

        {/* Stats */}
        {modulos.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Progresso geral</span>
              <span className="text-sm font-bold text-gray-900">{totalConcluidos}/{totalTopicos} tópicos · {pct}%</span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500 bg-green-500"
                style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
          </div>
        )}

        {/* Empty */}
        {!loading && modulos.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <ScrollText className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Nenhum edital importado ainda</p>
            <p className="text-gray-400 text-sm mt-1">Cole a URL de um guia do TEC Concursos acima para começar</p>
          </div>
        )}

        {/* Modulos */}
        {!loading && modulos.map(modulo => {
          const topTotal = modulo.disciplinas.reduce((a, d) => a + d.topicos.length, 0);
          const topFeito = modulo.disciplinas.reduce((a, d) => a + d.topicos.filter(t => t.concluido).length, 0);
          const mPct = topTotal > 0 ? Math.round((topFeito / topTotal) * 100) : 0;
          const isOpen = expanded[modulo.modulo] !== false; // aberto por padrão

          return (
            <div key={modulo.modulo} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              {/* Header do módulo */}
              <button
                onClick={() => toggleModulo(modulo.modulo)}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors text-left">
                <div className="flex items-center gap-3">
                  {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                  <div>
                    <p className="font-bold text-gray-900 text-sm">{modulo.modulo}</p>
                    <p className="text-xs text-gray-400">{modulo.disciplinas.length} disciplinas · {topTotal} tópicos</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-green-500" style={{ width: `${mPct}%` }} />
                  </div>
                  <span className="text-xs font-bold text-gray-600 w-10 text-right">{mPct}%</span>
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-gray-100">
                  {modulo.disciplinas.map(disc => {
                    const dTotal = disc.topicos.length;
                    const dFeito = disc.topicos.filter(t => t.concluido).length;
                    const dPct   = dTotal > 0 ? Math.round((dFeito / dTotal) * 100) : 0;
                    const dKey   = `${modulo.modulo}::${disc.nome}`;
                    const dOpen  = expanded[dKey] !== false;

                    return (
                      <div key={disc.nome} className="border-b border-gray-50 last:border-0">
                        {/* Header disciplina */}
                        <button
                          onClick={() => toggleModulo(dKey)}
                          className="w-full flex items-center justify-between px-6 py-3 hover:bg-gray-50 transition-colors text-left pl-10">
                          <div className="flex items-center gap-2">
                            {dOpen ? <ChevronDown className="w-3.5 h-3.5 text-gray-300" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-300" />}
                            <span className="text-sm font-semibold text-gray-800">{disc.nome}</span>
                            <span className="text-xs text-gray-400">{dFeito}/{dTotal}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full bg-green-400" style={{ width: `${dPct}%` }} />
                            </div>
                            <span className="text-xs text-gray-400 w-8 text-right">{dPct}%</span>
                          </div>
                        </button>

                        {dOpen && (
                          <div className="pl-16 pr-6 pb-3 space-y-1">
                            {disc.topicos.map(topico => (
                              <button
                                key={topico.id}
                                onClick={() => toggleTopico(topico)}
                                className={`w-full flex items-start gap-3 py-2 px-3 rounded-xl text-left transition-colors group ${
                                  topico.concluido ? "bg-green-50" : "hover:bg-gray-50"
                                }`}>
                                {topico.concluido
                                  ? <CheckSquare className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                                  : <Square className="w-4 h-4 text-gray-300 shrink-0 mt-0.5 group-hover:text-gray-400" />
                                }
                                <span className={`text-xs leading-relaxed ${topico.concluido ? "text-gray-400 line-through" : "text-gray-700"}`}>
                                  {topico.nome}
                                </span>
                                {topico.questoes > 0 && (
                                  <span className="ml-auto text-xs text-gray-400 shrink-0">
                                    {topico.acertos}/{topico.questoes} ({Math.round((topico.acertos/topico.questoes)*100)}%)
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
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
  );
}
