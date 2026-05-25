"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Clock, RefreshCw, AlertCircle,
  Target, ArrowRight, CheckCircle, Zap, History,
} from "lucide-react";

interface Block {
  start: string;
  end: string;
  label: string;
  duration: string;
  subject: {
    id: string;
    name: string;
    score: number;
    nextPdf: { title: string } | null;
    pendingErrors: number;
    accuracy: number | null;
  } | null;
}

// ✅ NOVO: histórico de sessões do dia
interface SessionHistory {
  id:          string;
  subjectName: string;
  subjectId:   string;
  hours:       number;
  questions:   number;
  correct:     number;
  wrong:       number;
  createdAt:   string;
}

interface Review    { id: string; type: string; pdf: { title: string; topic: { subject: { name: string } } } }
interface ErrorNote { id: string; title: string; wrongCount: number; subject: { name: string } }

interface Data {
  todayBlocks:    Block[];
  todayHistory:   SessionHistory[];  // ✅ NOVO
  reviews:        Review[];
  criticalErrors: ErrorNote[];
  todayStats:     { hours: number; questions: number };
  weekStats:      { hours: number; questions: number; targetHours: number };
  nextSubject:    { id: string; name: string; score: number; nextPdf: { title: string } | null } | null;
  nextBlockType:  string | null;
  weekDay:        number;
}

const DAYS = [
  "Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira",
  "Quinta-feira", "Sexta-feira", "Sábado",
];

function pct(v: number, t: number) {
  if (!t) return 0;
  return Math.min(100, Math.round((v / t) * 100));
}

function fmtHours(h: number): string {
  const totalMin = Math.round(h * 60);
  if (totalMin < 60) return `${totalMin}min`;
  const hh = Math.floor(totalMin / 60);
  const mm  = totalMin % 60;
  return mm > 0 ? `${hh}h${mm}min` : `${hh}h`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function HojePage() {
  const [data,            setData]            = useState<Data | null>(null);
  const [loading,         setLoading]         = useState(true);
  const [completedBlocks, setCompletedBlocks] = useState<number[]>([]);

  useEffect(() => {
    fetch(`/api/schedule?cycleDay=${localStorage.getItem('estudaai_cycle_day') ?? '0'}`)
      .then(r => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!data) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center text-red-500">
      Erro ao carregar.
    </div>
  );

  const today   = new Date();
  const dateStr = today.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const hoursTarget = data.weekStats.targetHours;
  const hoursProgress = pct(data.weekStats.hours, hoursTarget);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="text-white px-8" style={{ backgroundColor: "#1B4040", minHeight: "124px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <p className="text-gray-400 text-sm">{DAYS[data.weekDay]}, {dateStr}</p>
        <h1 className="text-3xl font-bold mt-1">Painel do Dia</h1>
        <p className="text-gray-400 text-sm mt-1">Seu plano de estudos personalizado para hoje</p>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* KPIs de hoje */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Horas hoje",        value: `${data.todayStats.hours.toFixed(1)}h`, icon: Clock,       color: "text-blue-600"   },
            { label: "Questões hoje",     value: data.todayStats.questions,              icon: Target,      color: "text-purple-600" },
            { label: "Revisões pendentes",value: data.reviews.length,                    icon: RefreshCw,   color: data.reviews.length       > 0 ? "text-red-600"    : "text-green-600" },
            { label: "Erros críticos",    value: data.criticalErrors.length,             icon: AlertCircle, color: data.criticalErrors.length > 0 ? "text-orange-600" : "text-green-600" },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-4 h-4 ${color}`} />
                <p className="text-xs text-gray-500">{label}</p>
              </div>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Progresso semanal — só horas, sem meta de questões */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Progresso da semana</h2>
          {hoursTarget > 0 ? (
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium text-gray-700">Horas</span>
                <span className="text-gray-500">
                  {data.weekStats.hours.toFixed(1)}h / {hoursTarget.toFixed(1)}h
                </span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width:           `${hoursProgress}%`,
                    backgroundColor: hoursProgress >= 100 ? "#10B981"
                                   : hoursProgress >= 60  ? "#3B82F6"
                                   : "#111827",
                  }}
                />
              </div>
              <p className={`text-xs mt-1 font-medium ${hoursProgress >= 100 ? "text-green-600" : "text-gray-500"}`}>
                {hoursProgress}% da meta {hoursProgress >= 100 ? "✓" : ""}
              </p>

              {/* Questões da semana — exibe sempre, sem barra de meta */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                <span className="text-sm font-medium text-gray-700">Questões</span>
                <span className="text-sm font-semibold text-gray-900">
                  {data.weekStats.questions} resolvidas esta semana
                </span>
              </div>
            </div>
          ) : (
            // Sem blocos configurados = sem meta de horas
            <p className="text-sm text-gray-400">
              Configure seu{" "}
              <Link href="/calendario-ciclo" className="text-blue-600 hover:underline">
                calendário semanal
              </Link>{" "}
              para ver o progresso de horas aqui.
            </p>
          )}
        </div>

        {/* Próxima ação recomendada */}
        {data.nextSubject && (
          <div className="text-white rounded-2xl p-6" style={{ backgroundColor: "#1B4040" }}>
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-5 h-5 text-yellow-400" />
              <span className="text-xs text-gray-400 uppercase tracking-widest font-medium">
                Próxima ação recomendada
              </span>
            </div>
            <p className="text-2xl font-bold mb-1">{data.nextSubject.name}</p>
            {data.nextBlockType && (
              <p className="text-sm mb-4" style={{ color: "rgba(255,255,255,0.6)" }}>
                {data.nextBlockType === "exercicios"
                  ? "📝 Exercícios"
                  : data.nextBlockType === "revisao7d"
                  ? "🔄 Revisão 7 dias"
                  : data.nextBlockType === "revisao14_30d"
                  ? "🔄 Revisão 14/30 dias"
                  : "📖 Leitura PDF"}
              </p>
            )}
            <Link
              href={`/sessao?subjectId=${data.nextSubject.id}`}
              className="inline-flex items-center gap-2 bg-white text-gray-900 font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-gray-100 transition-colors"
            >
              Começar agora <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {/* ✅ NOVO: Histórico de sessões do dia */}
        {data.todayHistory && data.todayHistory.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <History className="w-5 h-5 text-gray-400" />
              O que você já estudou hoje
            </h2>
            <div className="space-y-3">
              {data.todayHistory.map((s, i) => {
                const accuracy = s.questions > 0
                  ? Math.round((s.correct / s.questions) * 100)
                  : null;
                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-4 p-4 bg-green-50 border border-green-100 rounded-xl"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-green-600 text-white rounded-lg flex items-center justify-center text-xs font-bold shrink-0">
                        {i + 1}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{s.subjectName}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-xs text-gray-500">
                            ⏱ {fmtHours(s.hours)}
                          </span>
                          {s.questions > 0 && (
                            <span className="text-xs text-gray-500">
                              • {s.questions} questões
                            </span>
                          )}
                          {accuracy !== null && (
                            <span className={`text-xs font-medium ${
                              accuracy >= 70 ? "text-green-600"
                              : accuracy >= 50 ? "text-yellow-600"
                              : "text-red-600"
                            }`}>
                              • {accuracy}% acerto
                            </span>
                          )}
                          <span className="text-xs text-gray-400">
                            • {fmtTime(s.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                    {/* Continuar estudando a mesma disciplina */}
                    <Link
                      href={`/sessao?subjectId=${s.subjectId}`}
                      className="shrink-0 text-xs text-green-700 bg-green-100 hover:bg-green-200 px-3 py-1.5 rounded-lg font-medium transition-colors"
                    >
                      Continuar
                    </Link>
                  </div>
                );
              })}

              {/* Totalizador do dia */}
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-xl border border-gray-100 mt-1">
                <span className="text-sm text-gray-500 font-medium">Total do dia</span>
                <div className="flex items-center gap-4 text-sm font-semibold text-gray-900">
                  <span>⏱ {fmtHours(data.todayStats.hours)}</span>
                  {data.todayStats.questions > 0 && (
                    <span>📝 {data.todayStats.questions} questões</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Blocos de estudo de hoje */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-400" />
            Seus blocos de estudo hoje
          </h2>
          <div className="space-y-3">
            {data.todayBlocks.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">
                Nenhum bloco configurado para hoje.{" "}
                <Link href="/calendario-ciclo" className="text-blue-600 hover:underline">
                  Configurar calendário
                </Link>
              </p>
            )}
            {data.todayBlocks.map((block, i) => {
              const done = completedBlocks.includes(i);
              const now  = new Date();

              const hasTime = block.start !== "—" && block.end !== "—";
              let isNow = false;
              let isPast = false;
              if (hasTime) {
                const [sh, sm] = block.start.split(":").map(Number);
                const [eh, em] = block.end.split(":").map(Number);
                const blockStart = new Date(now); blockStart.setHours(sh, sm, 0);
                const blockEnd   = new Date(now); blockEnd.setHours(eh, em, 0);
                isNow  = now >= blockStart && now <= blockEnd;
                isPast = now > blockEnd;
              }

              return (
                <div
                  key={i}
                  className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                    done    ? "bg-green-50 border-green-200"
                    : isNow ? "bg-blue-50 border-blue-300 shadow-sm"
                    : "border-gray-100 bg-gray-50"
                  }`}
                >
                  <div className="text-center shrink-0 w-20">
                    {hasTime ? (
                      <>
                        <p className="text-xs text-gray-500">{block.start}</p>
                        <p className="text-xs text-gray-400">↓</p>
                        <p className="text-xs text-gray-500">{block.end}</p>
                      </>
                    ) : (
                      <p className="text-xs text-gray-400">{block.duration}</p>
                    )}
                  </div>

                  <div className={`w-1 h-12 rounded-full shrink-0 ${
                    done    ? "bg-green-500"
                    : isNow ? "bg-blue-500"
                    : isPast ? "bg-gray-300"
                    : "bg-gray-200"
                  }`} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      {isNow && (
                        <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full font-medium animate-pulse">
                          ● Agora
                        </span>
                      )}
                      <span className="text-xs text-gray-500">{block.duration}</span>
                    </div>
                    {block.subject ? (
                      <>
                        <p className="font-semibold text-gray-900">{block.subject.name}</p>
                        {block.subject.nextPdf && (
                          <p className="text-xs text-gray-500 truncate">
                            📄 {block.subject.nextPdf.title}
                          </p>
                        )}
                        <div className="flex gap-3 mt-1">
                          {block.subject.pendingErrors > 0 && (
                            <span className="text-xs text-red-600">
                              {block.subject.pendingErrors} erros pendentes
                            </span>
                          )}
                          <span className="text-xs text-gray-400">
                            {block.subject.accuracy !== null
                              ? `${block.subject.accuracy}% acerto`
                              : "sem dados de acerto"}
                          </span>
                        </div>
                      </>
                    ) : (
                      <p className="text-gray-500 text-sm">Sem matérias cadastradas</p>
                    )}
                  </div>

                  {block.subject && !done && (
                    <Link
                      href={`/sessao?subjectId=${block.subject.id}`}
                      className="shrink-0 text-xs bg-gray-900 hover:bg-gray-700 text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
                    >
                      Começar
                    </Link>
                  )}

                  <button
                    onClick={() =>
                      setCompletedBlocks(prev =>
                        done ? prev.filter(x => x !== i) : [...prev, i]
                      )
                    }
                    className={`shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors ${
                      done
                        ? "bg-green-500 border-green-500 text-white"
                        : "border-gray-300 hover:border-green-400"
                    }`}
                  >
                    {done && <CheckCircle className="w-4 h-4" />}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Revisões do dia */}
        {data.reviews.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-blue-500" />
                Revisões para hoje ({data.reviews.length})
              </h2>
              <Link href="/revisoes" className="text-sm text-blue-600 hover:underline">Ver todas</Link>
            </div>
            <div className="space-y-2">
              {data.reviews.slice(0, 5).map(r => (
                <div key={r.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-xl border border-blue-100">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{r.pdf.title}</p>
                    <p className="text-xs text-gray-500">
                      {r.pdf.topic.subject.name} • Revisão {r.type}
                    </p>
                  </div>
                  <Link href="/revisoes"
                    className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-blue-700 transition-colors">
                    Revisar
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Erros críticos */}
        {data.criticalErrors.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-500" />
                Erros críticos para revisar
              </h2>
              <Link href="/caderno" className="text-sm text-red-600 hover:underline">Ver todos</Link>
            </div>
            <div className="space-y-2">
              {data.criticalErrors.map(e => (
                <div key={e.id} className="flex items-center justify-between p-3 bg-red-50 rounded-xl border border-red-100">
                  <div>
                    <p className="text-sm font-medium text-gray-900 truncate max-w-sm">{e.title}</p>
                    <p className="text-xs text-gray-500">{e.subject.name} • Errou {e.wrongCount}x</p>
                  </div>
                  <Link href="/caderno"
                    className="text-xs bg-red-600 text-white px-3 py-1.5 rounded-lg font-medium hover:bg-red-700 transition-colors">
                    Revisar
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dica do dia */}
        <div className="text-white rounded-2xl p-6" style={{ backgroundColor: "#1B4040" }}>
          <p className="text-sm font-semibold text-yellow-400 mb-2">💡 Dica — Davi Lago</p>
          <p className="text-gray-300 text-sm leading-relaxed">
            Seus melhores blocos são de madrugada (04:15) e manhã cedo (07:00) — quando o cérebro ainda está fresco.
            Use esses blocos para conteúdo novo e difícil. Reserve o bloco do almoço (12:00) para revisões e flashcards.
          </p>
        </div>

      </div>
    </div>
  );
}
