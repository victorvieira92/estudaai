"use client";
import React, { useEffect, useState } from "react";
import { ChevronRight, X, Trophy } from "lucide-react";

const BG = "#1B4040";
const YOU_COLOR    = "#378ADD";
const OTHERS_COLOR = "#D85A30";

interface SubjectCompare {
  name: string;
  you:    { hours: number; questions: number; correct: number; wrong: number; accuracy: number | null };
  others: { hours: number; questions: number; correct: number; wrong: number; accuracy: number | null };
}
interface CompeticaoData {
  otherUsersCount: number;
  subjects: SubjectCompare[];
}
interface TopicCompare {
  name: string;
  you:    { questions: number; correct: number; hours: number; accuracy: number | null };
  others: { questions: number; correct: number; hours: number; accuracy: number | null };
}
interface TopicData {
  subjectName: string;
  topics: TopicCompare[];
}

// ── Gauge SVG (semicírculo duplo) ─────────────────────────────────────────────
function GaugeArc({ you, others }: { you: number; others: number }) {
  const r1 = 26, r2 = 17;
  const cx = 32, cy = 30;

  function arcPath(radius: number, pctRaw: number) {
    const pct = Math.min(Math.max(pctRaw, 0), 100);
    if (pct <= 0) return "";
    const startAngle = Math.PI;
    const endAngle   = Math.PI - (Math.PI * pct) / 100;
    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy - radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy - radius * Math.sin(endAngle);
    const largeArc = pct > 50 ? 1 : 0;
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius} ${radius} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  }

  return (
    <svg width="64" height="38" viewBox="0 0 64 38">
      <path d={arcPath(r1, 100)} stroke="#e5e7eb" strokeWidth="7" fill="none" strokeLinecap="round" />
      <path d={arcPath(r1, others)} stroke={OTHERS_COLOR} strokeWidth="7" fill="none" strokeLinecap="round" />
      <path d={arcPath(r2, 100)} stroke="#eef2f7" strokeWidth="7" fill="none" strokeLinecap="round" />
      <path d={arcPath(r2, you)} stroke={YOU_COLOR} strokeWidth="7" fill="none" strokeLinecap="round" />
    </svg>
  );
}

// ── Modal de detalhamento por tópico ──────────────────────────────────────────
function TopicModal({ subjectName, onClose }: { subjectName: string; onClose: () => void }) {
  const [data, setData] = useState<TopicData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/competicao/topicos?subjectName=${encodeURIComponent(subjectName)}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [subjectName]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-6 pb-6 px-4"
      style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[88vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-5 rounded-t-2xl" style={{ backgroundColor: BG }}>
          <div>
            <p className="text-xs font-medium uppercase tracking-widest mb-1" style={{ color: "#9FE1CB" }}>Por tópico</p>
            <h2 className="text-xl font-bold text-white">{subjectName}</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-white hover:bg-white/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5">
          <div className="flex items-center gap-4 mb-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: YOU_COLOR }} />Você</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: OTHERS_COLOR }} />Outros usuários</span>
          </div>

          {loading && (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
            </div>
          )}

          {!loading && data && data.topics.length === 0 && (
            <p className="text-center text-gray-400 py-8 text-sm">Nenhum tópico registrado nesta matéria.</p>
          )}

          {!loading && data && data.topics.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              {data.topics.map((t, i) => (
                <div key={t.name} className={`flex items-center gap-4 px-4 py-3 ${i < data.topics.length - 1 ? "border-b border-gray-100" : ""}`}>
                  <div className="shrink-0">
                    <GaugeArc you={t.you.accuracy ?? 0} others={t.others.accuracy ?? 0} />
                  </div>
                  <p className="text-sm font-medium text-gray-800 flex-1 min-w-0 truncate">{t.name}</p>
                  <div className="text-right shrink-0 min-w-[90px]">
                    <p className="text-xs font-semibold" style={{ color: YOU_COLOR }}>
                      {t.you.accuracy !== null ? `${t.you.accuracy}%` : "—"}
                    </p>
                    <p className="text-[10px] text-gray-400">{t.you.questions} questões</p>
                  </div>
                  <div className="text-right shrink-0 min-w-[90px]">
                    <p className="text-xs font-semibold" style={{ color: OTHERS_COLOR }}>
                      {t.others.accuracy !== null ? `${t.others.accuracy}%` : "—"}
                    </p>
                    <p className="text-[10px] text-gray-400">{t.others.questions} questões</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function ComparativoPage() {
  const [data, setData] = useState<CompeticaoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalSubject, setModalSubject] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/competicao").then(r => r.json()).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (!loading && data && data.otherUsersCount === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="text-white px-8" style={{ backgroundColor: BG, minHeight: 124, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <h1 className="text-3xl font-bold">Comparativo</h1>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.6)" }}>Compare seu desempenho com outros usuários</p>
        </div>
        <div className="max-w-3xl mx-auto px-6 py-16 text-center">
          <Trophy className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500">Ainda não há outro usuário cadastrado para comparar.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="text-white px-8" style={{ backgroundColor: BG, minHeight: 124, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <h1 className="text-3xl font-bold">Comparativo</h1>
        <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.6)" }}>Compare seu desempenho com outros usuários</p>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-4">

        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: YOU_COLOR }} />Você</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: OTHERS_COLOR }} />Outros usuários</span>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {loading && Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-5 py-4 border-b border-gray-100 last:border-0">
              <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
            </div>
          ))}

          {!loading && data && data.subjects.length === 0 && (
            <p className="text-center text-gray-400 py-12 text-sm">Nenhuma matéria registrada ainda.</p>
          )}

          {!loading && data && data.subjects.map((s, i) => {
            const youAcc    = s.you.accuracy;
            const othersAcc = s.others.accuracy;
            return (
              <button
                key={s.name}
                onClick={() => setModalSubject(s.name)}
                className={`w-full flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors text-left ${i < data.subjects.length - 1 ? "border-b border-gray-100" : ""}`}>
                <div className="shrink-0">
                  <GaugeArc you={youAcc ?? 0} others={othersAcc ?? 0} />
                </div>
                <p className="text-sm font-semibold text-gray-800 flex-1 min-w-0 truncate">{s.name}</p>
                <span className="text-xs font-semibold shrink-0 min-w-[90px] text-right" style={{ color: YOU_COLOR }}>
                  {youAcc !== null ? `Você ${youAcc}%` : "Você —"}
                </span>
                <span className="text-xs shrink-0 min-w-[100px] text-right" style={{ color: OTHERS_COLOR }}>
                  {othersAcc !== null ? `Outros ${othersAcc}%` : "Outros —"}
                </span>
                <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
              </button>
            );
          })}
        </div>

        <p className="text-xs text-gray-400 text-center">Clique em uma matéria para ver o detalhamento por tópico</p>
      </div>

      {modalSubject && (
        <TopicModal subjectName={modalSubject} onClose={() => setModalSubject(null)} />
      )}
    </div>
  );
}
