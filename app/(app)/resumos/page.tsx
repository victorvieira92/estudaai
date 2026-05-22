"use client";

import { useEffect, useState, useRef } from "react";
import { FileText, Upload, Download, Trash2, BookOpen, X } from "lucide-react";

interface Subject { id: string; name: string; }
interface Resumo {
  id: string; name: string; url: string; key: string; size: number;
  createdAt: string; updatedAt: string;
  subjectId: string | null;
  subject: { name: string } | null;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function ResumosPage() {
  const [resumos, setResumos] = useState<Resumo[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState("all");
  const [uploading, setUploading] = useState(false);
  const [uploadSubjectId, setUploadSubjectId] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const [r, s] = await Promise.all([
      fetch("/api/resumos").then(r => r.json()).catch(() => []),
      fetch("/api/subjects").then(r => r.json()).catch(() => []),
    ]);
    setResumos(Array.isArray(r) ? r : []);
    setSubjects(Array.isArray(s) ? s : (s.subjects ?? []));
  };

  useEffect(() => { load(); }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    try {
      // 1. Pega URL de upload do Uploadthing
      const presignRes = await fetch("/api/uploadthing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: [{ name: file.name, size: file.size, type: file.type }],
          acl: "public-read",
          contentDisposition: "inline",
        }),
      });

      if (!presignRes.ok) throw new Error("Erro ao obter URL de upload");
      const [{ url, key, fields }] = await presignRes.json();

      // 2. Faz upload direto para o Uploadthing
      const formData = new FormData();
      if (fields) Object.entries(fields).forEach(([k, v]) => formData.append(k, v as string));
      formData.append("file", file);

      const uploadRes = await fetch(url, { method: "POST", body: formData });
      if (!uploadRes.ok && uploadRes.status !== 204) throw new Error("Erro no upload");

      // 3. Salva metadados no banco
      const fileUrl = `https://utfs.io/f/${key}`;
      await fetch("/api/resumos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          url: fileUrl,
          key,
          subjectId: uploadSubjectId || null,
          size: file.size,
        }),
      });

      await load();
    } catch (err) {
      alert("Erro ao fazer upload. Tente novamente.");
      console.error(err);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleDelete = async (resumo: Resumo) => {
    if (!confirm(`Deletar "${resumo.name}"?`)) return;
    setDeleting(resumo.id);
    await fetch("/api/resumos", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: resumo.id, key: resumo.key }),
    });
    setDeleting(null);
    await load();
  };

  const filtered = resumos.filter(r => {
    const matchSubject = selectedSubject === "all" || r.subjectId === selectedSubject;
    const matchSearch = r.name.toLowerCase().includes(search.toLowerCase());
    return matchSubject && matchSearch;
  });

  const getIcon = (name: string) => {
    if (name.endsWith(".pdf")) return "📄";
    if (name.endsWith(".docx") || name.endsWith(".doc")) return "📝";
    return "📎";
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gray-950 text-white px-8 py-8">
        <h1 className="text-3xl font-bold">Resumos</h1>
        <p className="text-gray-400 text-sm mt-1">
          Faça upload dos seus resumos e acesse de qualquer lugar
        </p>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* Upload */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Upload className="w-5 h-5" /> Enviar resumo
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
                Matéria (opcional)
              </label>
              <select
                value={uploadSubjectId}
                onChange={e => setUploadSubjectId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                <option value="">Sem matéria</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">
                Arquivo (.docx, .doc, .pdf, .txt)
              </label>
              <input
                ref={fileRef}
                type="file"
                accept=".docx,.doc,.pdf,.txt"
                onChange={handleUpload}
                disabled={uploading}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-gray-900 file:text-white file:text-sm file:cursor-pointer hover:file:bg-gray-700 disabled:opacity-50"
              />
            </div>
          </div>

          {uploading && (
            <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-blue-700 text-sm">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              Enviando arquivo... aguarde
            </div>
          )}
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Buscar resumo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 flex-1 min-w-48"
          />
          <select
            value={selectedSubject}
            onChange={e => setSelectedSubject(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
          >
            <option value="all">Todas as matérias</option>
            <option value="">Sem matéria</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            ["Total", resumos.length],
            ["Tamanho total", formatSize(resumos.reduce((a, r) => a + r.size, 0))],
            ["Matérias", new Set(resumos.filter(r => r.subjectId).map(r => r.subjectId)).size],
          ].map(([l, v]) => (
            <div key={l as string} className="bg-white rounded-xl border border-gray-200 px-5 py-4">
              <p className="text-xs text-gray-500 mb-1">{l}</p>
              <p className="text-2xl font-bold text-gray-900">{v}</p>
            </div>
          ))}
        </div>

        {/* Lista de resumos */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
              <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">Nenhum resumo encontrado</p>
              <p className="text-gray-400 text-sm mt-1">Faça upload do seu primeiro resumo acima</p>
            </div>
          ) : (
            filtered.map(resumo => (
              <div key={resumo.id} className="bg-white rounded-xl border border-gray-200 px-5 py-4 flex items-center gap-4">
                <span className="text-2xl">{getIcon(resumo.name)}</span>

                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{resumo.name}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    {resumo.subject && (
                      <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                        <BookOpen className="w-3 h-3" />
                        {resumo.subject.name}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">{formatSize(resumo.size)}</span>
                    <span className="text-xs text-gray-400">{formatDate(resumo.updatedAt)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={resumo.url}
                    download={resumo.name}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-2 bg-gray-900 hover:bg-gray-700 text-white rounded-lg text-xs font-medium transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Baixar
                  </a>
                  <button
                    onClick={() => handleDelete(resumo)}
                    disabled={deleting === resumo.id}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
