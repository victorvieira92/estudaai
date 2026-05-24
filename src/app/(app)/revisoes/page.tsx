"use client";
import { useState, useEffect } from "react";
import { CheckCircle, RefreshCw, BookOpen } from "lucide-react";
import Link from "next/link";

interface Review {
  id: string;
  type: string;
  reviewDate: string;
  completed: boolean;
  pdf: { title: string; topic: { name: string; subject: { name: string } } };
}

export default function RevisoesPage() {
  const [reviews,    setReviews]    = useState<Review[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [totalEver,  setTotalEver]  = useState(0); // total incluindo completed

  const load = () =>
    fetch("/api/reviews")
      .then(r => r.json())
      .then(d => {
        const all: Review[] = Array.isArray(d) ? d : [];
        setReviews(all);
        setTotalEver(all.length);
      })
      .catch(console.error)
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const complete = async (id: string) => {
    await fetch("/api/reviews", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ id }),
    });
    load();
  };

  const today   = new Date(); today.setHours(0, 0, 0, 0);
  const pending = reviews.filter(r => !r.completed);
  const late    = pending.filter(r => new Date(r.reviewDate) < today);
  const dueToday = pending.filter(r => {
    const d = new Date(r.reviewDate); d.setHours(0, 0, 0, 0);
    return d.getTime() === today.getTime();
  });
  const upcoming = pending.filter(r => new Date(r.reviewDate) > today);

  const Section = ({
    title, items, color,
  }: { title: string; items: Review[]; color: string }) =>
    items.length === 0 ? null : (
      <div>
        <h2 className={`text-sm font-semibold uppercase tracking-wide mb-3 ${color}`}>
          {title} ({items.length})
        </h2>
        <div className="space-y-2">
          {items.map(r => (
            <div
              key={r.id}
              className="bg-white rounded-xl border border-gray-200 px-5 py-3 flex items-center justify-between"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">{r.pdf.title}</p>
                <p className="text-xs text-gray-500">
                  {r.pdf.topic.subject.name} • {r.pdf.topic.name} • Revisão {r.type}
                </p>
                <p className="text-xs text-gray-400">
                  {new Date(r.reviewDate).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <button
                onClick={() => complete(r.id)}
                className="flex items-center gap-1.5 px-3 py-2 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg text-xs font-medium transition-colors"
              >
                <CheckCircle className="w-3.5 h-3.5" /> Revisei
              </button>
            </div>
          ))}
        </div>
      </div>
    );

  // ── Estado vazio: distingue "nunca teve sessão" de "tudo revisado" ──────────
  const EmptyState = () => {
    // ✅ Nunca teve revisão agendada = ainda não fez nenhuma sessão de estudo
    if (totalEver === 0) {
      return (
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-7 h-7 text-gray-400" />
          </div>
          <p className="text-gray-900 font-semibold text-base mb-1">
            Nenhuma revisão agendada ainda
          </p>
          <p className="text-gray-500 text-sm leading-relaxed max-w-sm mx-auto mb-5">
            As revisões são criadas automaticamente depois da sua primeira sessão de estudo.
            Após salvar uma sessão, revisões serão agendadas para{" "}
            <strong>24h</strong>, <strong>7 dias</strong> e <strong>30 dias</strong>.
          </p>
          <Link
            href="/sessao"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-900 hover:bg-gray-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Iniciar primeira sessão
          </Link>
        </div>
      );
    }

    // ✅ Tinha revisões mas todas foram concluídas
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
        <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-7 h-7 text-green-600" />
        </div>
        <p className="text-gray-900 font-semibold text-base mb-1">
          Tudo em dia! 🎉
        </p>
        <p className="text-gray-500 text-sm leading-relaxed max-w-sm mx-auto">
          Você concluiu todas as revisões pendentes. Continue estudando para que novas
          revisões sejam agendadas automaticamente.
        </p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gray-950 text-white px-8 py-8">
        <h1 className="text-3xl font-bold">Revisões</h1>
        <p className="text-gray-400 text-sm mt-1">Revisões espaçadas: 24h • 7 dias • 30 dias</p>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-4">

        {/* Contadores */}
        <div className="grid grid-cols-3 gap-4">
          {[
            ["Atrasadas", late.length,     "text-red-600"],
            ["Hoje",      dueToday.length, "text-blue-600"],
            ["Próximas",  upcoming.length, "text-gray-700"],
          ].map(([l, v, c]) => (
            <div key={l as string} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">{l}</p>
              <p className={`text-3xl font-bold ${c}`}>{v}</p>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <Section title="Atrasadas"  items={late}     color="text-red-600"  />
            <Section title="Para hoje"  items={dueToday} color="text-blue-600" />
            <Section title="Próximas"   items={upcoming} color="text-gray-600" />
            {pending.length === 0 && <EmptyState />}
          </>
        )}
      </div>
    </div>
  );
}
