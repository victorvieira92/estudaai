"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Zap, Clock, BookOpen, AlertCircle, ArrowRight } from "lucide-react";

interface SubjectScore {
  id: string;
  name: string;
  score: number;
  editalWeight: number;
  criticality: number;
  recurrence: number;
  studyHours: number;
  pendingReviews: number;
  pendingErrors: number;
  accuracy: number | null; // null = sem dados
  lastStudyAt: string | null;
  nextAction: string;
}

export default function CicloPage() {
  const [queue, setQueue] = useState<SubjectScore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/subjects")
      .then((r) => r.json())
      .then(async (subjects: any[]) => {
        const list = Array.isArray(subjects)
          ? subjects
          : (subjects as any).subjects ?? [];

        const [reviews, errors] = await Promise.all([
          fetch("/api/reviews").then((r) => r.json()).catch(() => []),
          fetch("/api/error-notes").then((r) => r.json()).catch(() => []),
        ]);

        const scored = list
          .map((s: any) => {
            const pendingRevs = (Array.isArray(reviews) ? reviews : []).filter(
              (r: any) => !r.completed && r.pdf?.topic?.subject?.id === s.id
            ).length;
            const pendingErrs = (Array.isArray(errors) ? errors : []).filter(
              (e: any) => !e.resolved && e.subjectId === s.id
            ).length;

            const daysSince = s.lastStudyAt
              ? Math.floor(
                  (Date.now() - new Date(s.lastStudyAt).getTime()) /
                    (1000 * 60 * 60 * 24)
                )
              : 30;

            // ✅ FIX: accuracy é null quando não há questões registradas
            // Nunca usar 50 como default — isso distorcia o score
            const hasData = s.totalQuestions > 0;
            const accuracy: number | null = hasData
              ? (s.correctQuestions / s.totalQuestions) * 100
              : null;

            // ✅ FIX: score composto sem o componente de acerto quando não há dados
            // Sem dados: Peso edital (43%) + Criticidade (36%) + Pendências (21%)
            // Com dados: Peso edital (30%) + Criticidade (25%) + Dificuldade real (30%) + Pendências (15%)
            let score: number;
            if (!hasData) {
              score =
                s.editalWeight * 10 * 0.43 +
                s.criticality * 8 * 0.36 +
                (pendingRevs * 15 + pendingErrs * 12) * 0.21 +
                daysSince * 2;
            } else {
              const accuracyPct = accuracy!;
              score =
                s.editalWeight * 10 +
                s.criticality * 8 +
                s.recurrence * 5 +
                pendingRevs * 15 +
                pendingErrs * 12 +
                daysSince * 2 +
                (100 - accuracyPct) * 0.5;
            }

            const allPdfs = s.topics?.flatMap((t: any) => t.pdfs ?? []) ?? [];
            const nextPdf = allPdfs.find((p: any) => !p.completed);
            const nextAction = nextPdf
              ? `Estudar: ${nextPdf.title}`
              : pendingRevs > 0
              ? "Fazer revisões pendentes"
              : pendingErrs > 0
              ? "Revisar caderno de erros"
              : "Cadastrar novos PDFs";

            return {
              id: s.id,
              name: s.name,
              score: Math.round(score),
              editalWeight: s.editalWeight,
              criticality: s.criticality,
              recurrence: s.recurrence,
              studyHours: s.studyHours,
              pendingReviews: pendingRevs,
              pendingErrors: pendingErrs,
              accuracy: hasData ? Math.round(accuracy!) : null,
              lastStudyAt: s.lastStudyAt,
              nextAction,
            };
          })
          .sort(
            (a: SubjectScore, b: SubjectScore) => b.score - a.score
          );

        setQueue(scored);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gray-950 text-white px-8 py-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Ciclo Inteligente</h1>
          <p className="text-gray-400 text-sm mt-1">
            Fila automática — o sistema ordena pelo que precisa mais atenção agora
          </p>
        </div>
        {queue[0] && (
          <Link
            href="/sessao"
            className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-xl text-sm transition-colors"
          >
            <Zap className="w-4 h-4" />
            Estudar {queue[0].name}
          </Link>
        )}
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-4">
        {queue.map((s, i) => (
          <div
            key={s.id}
            className={`bg-white rounded-2xl border p-6 ${
              i === 0 ? "border-gray-900 shadow-md" : "border-gray-200"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold ${
                    i === 0
                      ? "bg-gray-900 text-white"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {i + 1}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-gray-900 text-lg">{s.name}</p>
                    {(s.pendingReviews > 0 || s.pendingErrors > 0) && (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                        Pendências
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {s.lastStudyAt
                      ? `Último estudo: ${new Date(s.lastStudyAt).toLocaleDateString("pt-BR")}`
                      : "Ainda não estudado"}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-2xl font-bold text-gray-900">{s.score}</p>
                <p className="text-xs text-gray-400">score</p>
              </div>
            </div>

            <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mt-4">
              {[
                ["Peso edital", `${s.editalWeight}/10`],
                ["Criticidade", `${s.criticality}/10`],
                ["Horas", `${s.studyHours.toFixed(1)}h`],
                // ✅ FIX: exibe "—" quando não há dados, nunca "50%"
                ["% Acerto", s.accuracy !== null ? `${s.accuracy}%` : "—"],
                ["Revisões", s.pendingReviews],
                ["Erros", s.pendingErrors],
              ].map(([l, v]) => (
                <div
                  key={l as string}
                  className="bg-gray-50 rounded-lg p-2 text-center"
                >
                  <p className="text-xs text-gray-400">{l}</p>
                  <p className="text-sm font-semibold text-gray-900">{v}</p>
                </div>
              ))}
            </div>

            <div
              className={`mt-4 flex items-center justify-between p-3 rounded-xl ${
                i === 0 ? "bg-gray-950 text-white" : "bg-gray-50"
              }`}
            >
              <div>
                <p
                  className={`text-xs font-semibold uppercase tracking-wide ${
                    i === 0 ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  Próxima ação
                </p>
                <p
                  className={`text-sm font-medium mt-0.5 ${
                    i === 0 ? "text-white" : "text-gray-900"
                  }`}
                >
                  {s.nextAction}
                </p>
              </div>
              <Link
                href="/sessao"
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  i === 0
                    ? "bg-white text-gray-900 hover:bg-gray-100"
                    : "bg-gray-900 text-white hover:bg-gray-700"
                }`}
              >
                Começar <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        ))}
        {queue.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            Cadastre matérias para ativar o Ciclo Inteligente.
          </div>
        )}
      </div>
    </div>
  );
}
