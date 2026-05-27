// src/app/(app)/importar/page.tsx
// Página de importação em massa de matérias via Excel
// Protegida: só funciona se o email logado for o OWNER_EMAIL do .env
"use client";
import { useState, useRef } from "react";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";

const BG = "#1B4040";

// Mapeamento de aba do Excel → nome da matéria
// Ajuste conforme suas abas
const SHEET_MAP: Record<string, string> = {
  "AUD":        "Auditoria",
  "CONT GERAL": "Contabilidade Geral",
  "DIR ADM":    "Direito Administrativo",
  "DIR CONST":  "Direito Constitucional",
  "DIR TRIB":   "Direito Tributário",
  "PORT":       "Português",
};

interface SubjectPayload {
  subject: string; topic: string;
  pdfs: { title: string }[];
  editalWeight: number; criticality: number;
}

interface ImportResult {
  ok: boolean; created: number; skipped: number; pdfs: number; message?: string;
}

function parseExcel(file: File): Promise<SubjectPayload[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data  = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb    = XLSX.read(data, { type: "array" });
        const result: SubjectPayload[] = [];

        for (const sheetName of wb.SheetNames) {
          const subjectName = SHEET_MAP[sheetName] ?? sheetName;
          const ws   = wb.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 }) as string[][];

          const pdfs: { title: string }[] = [];
          for (const row of rows) {
            const title = String(row[0] ?? "").trim();
            if (title && title.toLowerCase() !== "aula" && title !== "") {
              pdfs.push({ title });
            }
          }

          if (pdfs.length > 0) {
            result.push({
              subject:      subjectName,
              topic:        subjectName,
              pdfs,
              editalWeight: 5,
              criticality:  5,
            });
          }
        }
        resolve(result);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
    reader.readAsArrayBuffer(file);
  });
}

export default function ImportarPage() {
  const [file,     setFile]     = useState<File | null>(null);
  const [preview,  setPreview]  = useState<SubjectPayload[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState<ImportResult | null>(null);
  const [error,    setError]    = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (f: File) => {
    setFile(f);
    setResult(null);
    setError("");
    try {
      const payload = await parseExcel(f);
      setPreview(payload);
    } catch {
      setError("Não foi possível ler o arquivo. Certifique-se de enviar um .xlsx válido.");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleImport = async () => {
    if (!preview.length) return;
    setLoading(true);
    setError("");
    try {
      const res  = await fetch("/api/import-subjects", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(preview),
      });
      const data: ImportResult = await res.json();
      if (!res.ok) {
        setError(data.message ?? "Erro ao importar.");
      } else {
        setResult(data);
        setPreview([]);
        setFile(null);
      }
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const totalPdfs = preview.reduce((a, s) => a + s.pdfs.length, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="text-white px-8 py-8" style={{ backgroundColor: BG }}>
        <h1 className="text-3xl font-bold">Importar Matérias</h1>
        <p className="text-gray-400 text-sm mt-1">
          Cadastre matérias e aulas em massa via planilha Excel
        </p>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">

        {/* Instruções */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 text-sm text-blue-800">
          <p className="font-semibold mb-2">Como funciona</p>
          <ul className="space-y-1 text-xs leading-relaxed list-disc list-inside text-blue-700">
            <li>Cada aba da planilha vira uma matéria (ex: aba "DIR ADM" → "Direito Administrativo")</li>
            <li>A coluna A de cada aba deve ter os nomes das aulas (ex: "Aula 00", "Aula 01"...)</li>
            <li>Cada aula vira um PDF dentro da matéria</li>
            <li>Matérias e aulas já existentes não são duplicadas</li>
          </ul>
        </div>

        {/* Upload area */}
        {!file && !result && (
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-2xl p-12 flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-colors"
          >
            <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
              <FileSpreadsheet className="w-8 h-8 text-gray-400" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-gray-700">Clique ou arraste o arquivo aqui</p>
              <p className="text-xs text-gray-400 mt-1">Formato aceito: .xlsx</p>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </div>
        )}

        {/* Erro */}
        {error && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            <AlertCircle className="w-5 h-5 shrink-0" />
            {error}
          </div>
        )}

        {/* Preview */}
        {preview.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">Preview da importação</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {preview.length} matérias · {totalPdfs} aulas encontradas em{" "}
                  <span className="font-medium text-gray-700">{file?.name}</span>
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { setFile(null); setPreview([]); }}
                  className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleImport}
                  disabled={loading}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-xl transition-colors disabled:opacity-50"
                  style={{ backgroundColor: BG }}
                >
                  {loading
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Importando...</>
                    : <><Upload className="w-4 h-4" /> Importar agora</>}
                </button>
              </div>
            </div>

            <div className="divide-y divide-gray-50">
              {preview.map((s, i) => (
                <div key={i} className="px-6 py-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-semibold text-gray-900">{s.subject}</p>
                    <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                      {s.pdfs.length} aulas
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {s.pdfs.slice(0, 8).map((p, j) => (
                      <span key={j} className="text-xs bg-gray-50 border border-gray-200 text-gray-600 px-2 py-0.5 rounded-lg">
                        {p.title}
                      </span>
                    ))}
                    {s.pdfs.length > 8 && (
                      <span className="text-xs text-gray-400 px-2 py-0.5">
                        +{s.pdfs.length - 8} mais
                      </span>
                    )}
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
              <p className="font-semibold text-green-800 mb-2">Importação concluída!</p>
              <div className="space-y-1 text-sm text-green-700">
                <p>✅ <strong>{result.created}</strong> matéria(s) criada(s)</p>
                <p>⏭ <strong>{result.skipped}</strong> matéria(s) já existiam (não duplicadas)</p>
                <p>📄 <strong>{result.pdfs}</strong> aula(s) cadastrada(s)</p>
              </div>
              <button
                onClick={() => { setResult(null); setFile(null); setPreview([]); }}
                className="mt-4 text-xs text-green-700 underline hover:no-underline"
              >
                Importar outro arquivo
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
