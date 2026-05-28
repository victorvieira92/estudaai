// src/app/perfil/[userId]/page.tsx
// Página pública de compartilhamento de progresso — sem autenticação
"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Flame, Clock, Target, BookOpen, TrendingUp, Share2, CheckCircle } from "lucide-react";

const BG = "#1B4040";

function fmtH(h: number) {
  const hh = Math.floor(h); const mm = Math.round((h - hh) * 60);
  return mm > 0 ? `${hh}h${mm.toString().padStart(2,"0")}min` : `${hh}h`;
}

interface PublicProfile {
  name: string; memberSince: string;
  totalHours: number; totalQuestions: number; accuracy: number | null;
  studiedDays: number; streak: number;
  editalConcluidos: number; editalTotal: number;
  topSubjects: { name: string; hours: number; accuracy: number | null }[];
}

export default function PerfilPublicoPage() {
  const params = useParams();
  const userId = params?.userId as string;
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading]  = useState(true);
  const [copied,  setCopied]   = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!userId) return;
    fetch(`/api/perfil-publico/${userId}`)
      .then(r => {
        if (!r.ok) { setNotFound(true); return null; }
        return r.json();
      })
      .then(d => { if (d) setProfile(d); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [userId]);

  const share = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (notFound || !profile) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-3 text-gray-500">
      <BookOpen className="w-12 h-12 text-gray-300" />
      <p className="text-lg font-semibold">Perfil não encontrado</p>
      <p className="text-sm">Este link pode estar incorreto ou o perfil foi removido.</p>
    </div>
  );

  const editalPct = profile.editalTotal > 0
    ? Math.round((profile.editalConcluidos / profile.editalTotal) * 100)
    : 0;

  const memberYear = new Date(profile.memberSince).getFullYear();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="text-white px-8 py-10" style={{ backgroundColor: BG }}>
        <div className="max-w-2xl mx-auto">
          <div className="flex items-start justify-between">
            <div>
              <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-2xl font-bold mb-4">
                {profile.name.charAt(0).toUpperCase()}
              </div>
              <h1 className="text-2xl font-bold">{profile.name}</h1>
              <p className="text-white/60 text-sm mt-1">Estudando desde {memberYear} · EstudaAí</p>
            </div>
            <button onClick={share}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-medium transition-colors">
              {copied ? <><CheckCircle className="w-4 h-4 text-green-400" /> Copiado!</>
                      : <><Share2 className="w-4 h-4" /> Compartilhar</>}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">

        {/* KPIs principais */}
        <div className="grid grid-cols-2 gap-4">
          {[
            { icon: Clock,      label: "Horas estudadas",   value: fmtH(profile.totalHours),          color: "text-gray-900" },
            { icon: Target,     label: "Questões resolvidas",value: profile.totalQuestions,            color: "text-gray-900" },
            { icon: TrendingUp, label: "Acurácia geral",     value: profile.accuracy !== null ? `${profile.accuracy}%` : "—",
              color: profile.accuracy !== null
                ? profile.accuracy >= 75 ? "text-green-600" : profile.accuracy >= 60 ? "text-yellow-600" : "text-red-600"
                : "text-gray-400" },
            { icon: Flame,      label: "Dias seguidos",     value: `${profile.streak} dias`,          color: "text-orange-500" },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Icon className="w-4 h-4 text-gray-400" />
                <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
              </div>
              <p className={`text-3xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Constância */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-1">
            <Flame className="w-4 h-4 text-orange-500" />
            <p className="text-sm font-semibold text-gray-900">Constância</p>
          </div>
          <p className="text-xs text-gray-400 mb-4">{profile.studiedDays} dias estudados no total</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-orange-400 transition-all"
                style={{ width: `${Math.min(100, (profile.studiedDays / 365) * 100)}%` }} />
            </div>
            <span className="text-xs font-semibold text-orange-500 shrink-0">{profile.studiedDays} dias</span>
          </div>
        </div>

        {/* Progresso no edital */}
        {profile.editalTotal > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-gray-900">Progresso no Edital</p>
              <span className="text-xs font-bold text-gray-500">{profile.editalConcluidos}/{profile.editalTotal} tópicos</span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-2">
              <div className="h-full rounded-full bg-teal-500 transition-all" style={{ width: `${editalPct}%` }} />
            </div>
            <p className="text-xs text-gray-400">{editalPct}% do edital concluído</p>
          </div>
        )}

        {/* Top matérias */}
        {profile.topSubjects.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <p className="text-sm font-semibold text-gray-900 mb-4">Top Matérias</p>
            <div className="space-y-3">
              {profile.topSubjects.map((s, i) => (
                <div key={i} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0"
                      style={{ backgroundColor: BG, color: "#fff" }}>{i + 1}</span>
                    <p className="text-sm text-gray-700 truncate">{s.name}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-gray-500">{fmtH(s.hours)}</span>
                    {s.accuracy !== null && (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        s.accuracy >= 75 ? "bg-green-100 text-green-700"
                        : s.accuracy >= 60 ? "bg-yellow-100 text-yellow-700"
                        : "bg-red-100 text-red-700"
                      }`}>{s.accuracy}%</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rodapé */}
        <div className="text-center py-4">
          <p className="text-xs text-gray-400">
            Gerado pelo{" "}
            <span className="font-semibold" style={{ color: BG }}>EstudaAí</span>
            {" "}— plataforma de controle de estudos para concursos
          </p>
        </div>
      </div>
    </div>
  );
}
