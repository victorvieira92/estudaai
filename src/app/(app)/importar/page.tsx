// src/app/(app)/importar/page.tsx
// O arquivo Excel é enviado ao servidor para processamento — sem dependência de xlsx no frontend
"use client";
import { useState, useRef } from "react";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2, Info } from "lucide-react";

const BG = "#1B4040";

interface PdfInput     { title: string; }
interface TopicInput   { topic: string; pdfs: PdfInput[]; }
interface SubjectInput { subject: string; topics: TopicInput[]; editalWeight: number; criticality: number; }
interface PreviewResult { ok: boolean; subjects: SubjectInput[]; error?: string; }
interface ImportResult  { ok: boolean; subjects: number; topics: number; pdfs: number; skipped: number; message?: string; }

export default function ImportarPage() {
  const [file,    setFile]    = useState<File | null>(null);
  const [preview, setPreview] = useState<SubjectInput[]>([]);
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState<ImportResult | null>(null);
  const [error,   setError]   = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Envia o arquivo ao servidor para fazer o parse do Excel
  const handleFile = async (f: File) => {
    setFile(f); setResult(null); setError(""); setPreview([]);
    setLoading(true);
    try {
      const form = new FormData();
      form.append("file", f);
      const res  = await fetch("/api/import-subjects/parse", { method: "POST", body: form });
      const data: PreviewResult = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Não foi possível ler o arquivo.");
        setFile(null);
      } else {
        setPreview(data.subjects);
      }
    } catch {
      setError("Erro ao processar o arquivo. Tente novamente.");
      setFile(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleImport = async () => {
    if (!preview.length) return;
    setLoading(true); setError("");
    try {
      const res  = await fetch("/api/import-subjects", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preview),
      });
      const data: ImportResult = await res.json();
      if (!res.ok) { setError(data.message ?? "Erro ao importar."); }
      else { setResult(data); setPreview([]); setFile(null); }
    } catch { setError("Erro de conexão. Tente novamente."); }
    finally { setLoading(false); }
  };

  const totalTopics = preview.reduce((a, s) => a + s.topics.length, 0);
  const totalPdfs   = preview.reduce((a, s) => s.topics.reduce((b, t) => b + t.pdfs.length, 0) + a, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="text-white px-8 py-8" style={{ backgroundColor: BG }}>
        <h1 className="text-3xl font-bold">Importar Matérias</h1>
        <p className="text-gray-400 text-sm mt-1">Cadastre matérias, tópicos e aulas em massa via planilha Excel</p>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">

        {/* Instruções */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Info className="w-4 h-4 text-blue-600" />
            <p className="text-sm font-semibold text-blue-800">Formato esperado da planilha</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-blue-700">
            <div>
              <p className="font-semibold mb-1">Estrutura:</p>
              <ul className="space-y-1 list-disc list-inside leading-relaxed">
                <li>Cada <strong>aba</strong> = 1 matéria</li>
                <li><strong>Coluna A</strong> = Tópico</li>
                <li><strong>Coluna B</strong> = Aula / PDF</li>
                <li>Se col A vazia, reutiliza o último tópico</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold mb-1">Exemplo:</p>
              <div className="bg-white rounded-lg border border-blue-200 overflow-hidden text-[11px]">
                <div className="grid grid-cols-2 bg-blue-100 font-bold px-2 py-1">
                  <span>A — Tópico</span><span>B — Aula</span>
                </div>
                {[
                  ["Teoria Geral","Aula 00"],
                  ["Teoria Geral","Aula 01"],
                  ["Princípios","Aula 02"],
                  ["Princípios","Aula 03"],
                ].map(([a,b],i) => (
                  <div key={i} className={`grid grid-cols-2 px-2 py-0.5 ${i%2===0?"bg-white":"bg-blue-50"}`}>
                    <span className="truncate">{a}</span><span>{b}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <p className="text-xs text-blue-600 mt-3">
            💡 Planilhas com apenas coluna A também são aceitas — o tópico será o nome da aba.
          </p>
        </div>

        {/* Upload */}
        {!file && !result && (
          <div
            onDrop={handleDrop} onDragOver={e => e.preventDefault()}
            onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-2xl p-12 flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-gray-400 hover:bg-white transition-colors"
          >
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
              {loading
                ? <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
                : <FileSpreadsheet className="w-8 h-8 text-gray-400" />}
            </div>
            <div className="text-center">
              <p className="font-semibold text-gray-700">
                {loading ? "Processando planilha..." : "Clique ou arraste o arquivo aqui"}
              </p>
              <p className="text-xs text-gray-400 mt-1">Formato aceito: .xlsx</p>
            </div>
            <input ref={inputRef} type="file" accept=".xlsx" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </div>
        )}

        {/* Erro */}
        {error && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            <AlertCircle className="w-5 h-5 shrink-0" />{error}
            <button onClick={() => setError("")} className="ml-auto text-red-400 hover:text-red-600 text-xs underline">
              Tentar novamente
            </button>
          </div>
        )}

        {/* Preview */}
        {preview.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
              <div>
                <p className="font-semibold text-gray-900">Preview da importação</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  <strong className="text-gray-700">{preview.length}</strong> matérias ·{" "}
                  <strong className="text-gray-700">{totalTopics}</strong> tópicos ·{" "}
                  <strong className="text-gray-700">{totalPdfs}</strong> aulas em{" "}
                  <span className="text-gray-600 font-medium">{file?.name}</span>
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setFile(null); setPreview([]); }}
                  className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl transition-colors">
                  Cancelar
                </button>
                <button onClick={handleImport} disabled={loading}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-xl transition-colors disabled:opacity-50"
                  style={{ backgroundColor: BG }}>
                  {loading
                    ? <><Loader2 className="w-4 h-4 animate-spin" />Importando...</>
                    : <><Upload className="w-4 h-4" />Importar agora</>}
                </button>
              </div>
            </div>

            <div className="divide-y divide-gray-50 max-h-[480px] overflow-y-auto">
              {preview.map((s, i) => (
                <div key={i} className="px-6 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-bold text-gray-900">{s.subject}</p>
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                      {s.topics.reduce((a,t) => a + t.pdfs.length, 0)} aulas
                    </span>
                  </div>
                  <div className="space-y-2">
                    {s.topics.map((t, j) => (
                      <div key={j}>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{t.topic}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {t.pdfs.slice(0, 6).map((p, k) => (
                            <span key={k} className="text-xs bg-gray-50 border border-gray-200 text-gray-600 px-2 py-0.5 rounded-lg">
                              {p.title}
                            </span>
                          ))}
                          {t.pdfs.length > 6 && (
                            <span className="text-xs text-gray-400 px-1 py-0.5">+{t.pdfs.length - 6} mais</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Resultado */}
        {result && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6 flex items-start gap-4">
            <CheckCircle className="w-6 h-6 text-green-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-green-800 mb-3">Importação concluída!</p>
              <div className="space-y-1 text-sm text-green-700">
                <p>✅ <strong>{result.subjects}</strong> matéria(s) criada(s)</p>
                <p>📂 <strong>{result.topics}</strong> tópico(s) criado(s)</p>
                <p>📄 <strong>{result.pdfs}</strong> aula(s) cadastrada(s)</p>
                {result.skipped > 0 && (
                  <p className="text-green-600">⏭ <strong>{result.skipped}</strong> matéria(s) já existiam</p>
                )}
              </div>
              <button onClick={() => setResult(null)}
                className="mt-4 text-xs text-green-700 underline hover:no-underline">
                Importar outro arquivo
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
