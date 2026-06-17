import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function toBRDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
}

function fmtH(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return mm > 0 ? `${hh}h${mm.toString().padStart(2, "0")}min` : `${hh}h`;
}

const ERROR_TYPE_LABELS: Record<string, string> = {
  desatencao:         "Desatenção",
  nao_estudei:        "Não estudei",
  nao_lembrei:        "Não lembrei",
  confundi_conceitos: "Confundi conceitos",
  interpretacao:      "Erro de interpretação",
  pegadinha:          "Pegadinha",
  outro:              "Outro",
  decoreba:           "Decoreba",
};

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
  const uid = session.user.id as string;

  const { searchParams } = new URL(req.url);
  const subjectId = searchParams.get("subjectId");
  const period    = parseInt(searchParams.get("period") ?? "30"); // 30 | 90 | 0 (todo)

  if (!subjectId) return NextResponse.json({ message: "subjectId obrigatório." }, { status: 400 });

  // Data de corte em BRT
  const todayDS  = toBRDate(new Date());
  const cutoffDS = period > 0
    ? toBRDate(new Date(Date.now() - period * 24 * 60 * 60 * 1000))
    : "2000-01-01";

  const [subject, sessions, errorNotes] = await Promise.all([
    prisma.subject.findFirst({
      where:   { id: subjectId, userId: uid },
      include: { topics: { include: { pdfs: true } } },
    }),
    prisma.studySession.findMany({
      where:   { userId: uid, subjectId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.errorNote.findMany({
      where:   { userId: uid, subjectId },
    }),
  ]);

  if (!subject) return NextResponse.json({ message: "Matéria não encontrada." }, { status: 404 });

  // ── Filtra pelo período ──────────────────────────────────────────────────
  const filtered = sessions.filter(s => {
    const ds = toBRDate(new Date(s.createdAt));
    return ds >= cutoffDS && ds <= todayDS;
  });

  // ── KPIs globais ─────────────────────────────────────────────────────────
  const totalHours     = filtered.reduce((a, s) => a + s.studyHours, 0);
  const totalQuestions = filtered.reduce((a, s) => a + s.questions, 0);
  const totalCorrect   = filtered.reduce((a, s) => a + s.correct, 0);
  const totalWrong     = filtered.reduce((a, s) => a + s.wrong, 0);
  const accuracy       = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : null;
  const pendingErrors  = errorNotes.filter(e => !e.nextReviewAt || e.nextReviewAt <= new Date()).length;
  const totalErrors    = errorNotes.length;

  // ── Páginas lidas — via JSON notes ──────────────────────────────────────
  type NotesJson = { pdfTitle?: string; topicName?: string; category?: string; comment?: string };
  const parsedNotes = filtered.map(s => {
    let n: NotesJson = {};
    try { n = JSON.parse(s.notes ?? "{}"); } catch {}
    return { session: s, notes: n };
  });

  // ── Por PDF — tempo + páginas ─────────────────────────────────────────────
  const pdfMap: Record<string, { title: string; hours: number; pages: number; questions: number; correct: number; wrong: number; sessions: number }> = {};

  for (const { session: s, notes: n } of parsedNotes) {
    const title = n.pdfTitle?.trim() || "Sem PDF";
    if (!pdfMap[title]) {
      pdfMap[title] = { title, hours: 0, pages: 0, questions: 0, correct: 0, wrong: 0, sessions: 0 };
    }
    pdfMap[title].hours     += s.studyHours;
    pdfMap[title].questions += s.questions;
    pdfMap[title].correct   += s.correct;
    pdfMap[title].wrong     += s.wrong;
    pdfMap[title].sessions  += 1;
    // pages = max(endPage) por PDF: progresso linear (até onde chegou no PDF)
    const end = (n as any).endPage ?? 0;
    if (end > pdfMap[title].pages) pdfMap[title].pages = end;
  }

  const byPdf = Object.values(pdfMap)
    .filter(p => p.title !== "Sem PDF" || p.hours > 0)
    .sort((a, b) => b.hours - a.hours)
    .map(p => ({
      ...p,
      hours:    parseFloat(p.hours.toFixed(2)),
      accuracy: p.questions > 0 ? Math.round((p.correct / p.questions) * 100) : null,
    }));

  // ── Evolução semanal (últimas 8 semanas) ─────────────────────────────────
  const weekMap: Record<string, { label: string; correct: number; wrong: number; hours: number }> = {};
  const today = new Date();
  for (let w = 7; w >= 0; w--) {
    const d = new Date(today);
    d.setDate(today.getDate() - w * 7);
    const ds = toBRDate(d);
    const [year, month, day] = ds.split("-").map(Number);
    const label = `${String(day).padStart(2,"0")}/${String(month).padStart(2,"0")}`;
    weekMap[ds.slice(0, 7) + "-" + String(Math.ceil(day / 7))] = { label, correct: 0, wrong: 0, hours: 0 };
  }

  for (const s of filtered) {
    const ds   = toBRDate(new Date(s.createdAt));
    const d    = new Date(ds + "T12:00:00");
    const week = ds.slice(0, 7) + "-" + String(Math.ceil(d.getDate() / 7));
    if (weekMap[week]) {
      weekMap[week].correct += s.correct;
      weekMap[week].wrong   += s.wrong;
      weekMap[week].hours   += s.studyHours;
    }
  }
  const weeklyEvolution = Object.values(weekMap);

  // ── Distribuição de erros do Caderno ─────────────────────────────────────
  const errorTypeCount: Record<string, number> = {};
  for (const e of errorNotes) {
    const t = e.errorType ?? "outro";
    errorTypeCount[t] = (errorTypeCount[t] ?? 0) + 1;
  }
  const errorDistribution = Object.entries(errorTypeCount)
    .map(([type, count]) => ({ type, label: ERROR_TYPE_LABELS[type] ?? type, count }))
    .sort((a, b) => b.count - a.count);

  // ── Histórico de sessões (mais recentes primeiro) ────────────────────────
  const sessionHistory = [...filtered]
    .reverse()
    .slice(0, 20)
    .map(s => {
      let n: NotesJson = {};
      try { n = JSON.parse(s.notes ?? "{}"); } catch {}
      return {
        id:        s.id,
        date:      toBRDate(new Date(s.createdAt)),
        hours:     s.studyHours,
        questions: s.questions,
        correct:   s.correct,
        wrong:     s.wrong,
        accuracy:  s.questions > 0 ? Math.round((s.correct / s.questions) * 100) : null,
        pdfTitle:  n.pdfTitle  ?? "",
        topicName: n.topicName ?? "",
        category:  n.category  ?? "",
      };
    });

  // ── Tópicos com mais tempo ────────────────────────────────────────────────
  const topicMap: Record<string, { name: string; hours: number; questions: number; correct: number }> = {};
  for (const { session: s, notes: n } of parsedNotes) {
    const t = n.topicName?.trim() || "Sem tópico";
    if (!topicMap[t]) topicMap[t] = { name: t, hours: 0, questions: 0, correct: 0 };
    topicMap[t].hours     += s.studyHours;
    topicMap[t].questions += s.questions;
    topicMap[t].correct   += s.correct;
  }
  const byTopic = Object.values(topicMap)
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 8)
    .map(t => ({
      ...t,
      hours:    parseFloat(t.hours.toFixed(2)),
      accuracy: t.questions > 0 ? Math.round((t.correct / t.questions) * 100) : null,
    }));

  return NextResponse.json({
    subjectName:      subject.name,
    totalHours:       parseFloat(totalHours.toFixed(2)),
    totalQuestions,
    totalCorrect,
    totalWrong,
    accuracy,
    pendingErrors,
    totalErrors,
    totalSessions:    filtered.length,
    byPdf,
    byTopic,
    weeklyEvolution,
    errorDistribution,
    sessionHistory,
  });
}
