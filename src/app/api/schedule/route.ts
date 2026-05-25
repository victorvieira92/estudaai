import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({}, { status: 401 });

  const uid = session.user.id as string;
  // ✅ FIX: usa fuso de Brasília (UTC-3) para evitar bug do dia 23/05
  const nowBR = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const todayBRStr = nowBR.toISOString().slice(0, 10); // "YYYY-MM-DD" em BR
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayEnd = new Date(today);
  todayEnd.setHours(23, 59, 59, 999);
  const weekDay = today.getDay();

  const [subjects, reviews, errorNotes, sessions, studyBlocks] = await Promise.all([
    prisma.subject.findMany({
      where: { userId: uid },
      include: {
        topics: { include: { pdfs: true } },
        errorNotes:  { where: { resolved: false } },
        flashcards:  { where: { resolved: false } },
      },
      orderBy: { lastStudyAt: "asc" },
    }),
    prisma.review.findMany({
      where: {
        pdf: { topic: { subject: { userId: uid } } },
        completed:  false,
        reviewDate: { lte: todayEnd },
      },
      include: {
        pdf: {
          include: { topic: { include: { subject: { select: { name: true } } } } },
        },
      },
    }),
    prisma.errorNote.findMany({
      where:   { userId: uid, resolved: false },
      include: { subject: { select: { name: true } } },
      orderBy: { wrongCount: "desc" },
      take:    5,
    }),
    // Sessões de hoje — com subject para exibir no histórico
    // ✅ FIX: busca ampla e filtra por data BR para evitar bug de timezone
    prisma.studySession.findMany({
      where:   { userId: uid, createdAt: { gte: new Date(todayBRStr + "T00:00:00-03:00"), lte: new Date(todayBRStr + "T23:59:59-03:00") } },
      include: { subject: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.studyBlock.findMany({
      where:   { userId: uid },
      include: { subject: { select: { id: true, name: true } } },
      orderBy: [{ dayOfWeek: "asc" }, { hours: "desc" }],
    }),
  ]);

  // ── Score de prioridade por matéria ───────────────────────────────────────
  const scored = subjects
    .map(s => {
      const allPdfs = s.topics.flatMap(t => t.pdfs);
      const nextPdf = allPdfs.find(p => !p.completed);
      const daysSince = s.lastStudyAt
        ? Math.floor(
            (Date.now() - new Date(s.lastStudyAt).getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : 30;

      const hasData  = s.totalQuestions > 0;
      const accuracy = hasData
        ? (s.correctQuestions / s.totalQuestions) * 100
        : null;

      const score = hasData
        ? (s.editalWeight * 10) +
          (s.criticality * 8) +
          (daysSince * 3) +
          (s.errorNotes.length * 12) +
          ((100 - accuracy!) * 0.5)
        : (s.editalWeight * 10) +
          (s.criticality * 8) +
          (daysSince * 3) +
          (s.errorNotes.length * 12);

      return {
        id:                s.id,
        name:              s.name,
        score:             Math.round(score),
        nextPdf:           nextPdf ? { id: nextPdf.id, title: nextPdf.title } : null,
        pendingErrors:     s.errorNotes.length,
        pendingFlashcards: s.flashcards.length,
        accuracy:          hasData ? Math.round(accuracy!) : null,
        studyHours:        s.studyHours,
      };
    })
    .sort((a, b) => b.score - a.score);

  // ── Blocos de hoje ────────────────────────────────────────────────────────
  const todayDbBlocks = studyBlocks.filter(b => b.dayOfWeek === weekDay);
  let subjectQueue = [...scored];

  const todayBlocks = todayDbBlocks.map(block => {
    const fixedSubject = block.subjectId
      ? scored.find(s => s.id === block.subjectId) ?? null
      : null;
    const subjectToShow = fixedSubject ?? subjectQueue.shift() ?? null;

    return {
      start:    block.startTime ?? "—",
      end:      block.endTime   ?? "—",
      label:    block.blockType,
      duration: formatHours(block.hours),
      subject:  subjectToShow,
    };
  });

  // ── Estatísticas de hoje ──────────────────────────────────────────────────
  const todayHours     = sessions.reduce((a, s) => a + s.studyHours, 0);
  const todayQuestions = sessions.reduce((a, s) => a + s.questions,  0);

  // ── Histórico de sessões do dia ───────────────────────────────────────────
  // ✅ NOVO: envia as sessões de hoje formatadas para exibir no painel
  const todayHistory = sessions.map(s => ({
    id:          s.id,
    subjectName: s.subject?.name ?? "Sem disciplina",
    subjectId:   s.subjectId,
    hours:       s.studyHours,
    questions:   s.questions,
    correct:     s.correct,
    wrong:       s.wrong,
    createdAt:   s.createdAt.toISOString(),
  }));

  // ── Progresso da semana ───────────────────────────────────────────────────
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  const weekSessions = await prisma.studySession.findMany({
    where: { userId: uid, createdAt: { gte: weekStart } },
  });
  const weekHours     = weekSessions.reduce((a, s) => a + s.studyHours, 0);
  const weekQuestions = weekSessions.reduce((a, s) => a + s.questions,  0);

  // ✅ FIX: targetHours = soma real dos study-blocks (sem hardcode)
  const targetHours = studyBlocks.reduce((a, b) => a + b.hours, 0);

  // ✅ FIX: targetQuestions removido — usuário não configurou essa meta
  // Não exibir barra de progresso de questões sem meta real definida

  return NextResponse.json({
    todayBlocks,
    todayHistory,   // ✅ NOVO
    reviews:        reviews.slice(0, 10),
    criticalErrors: errorNotes,
    todayStats: {
      hours:     parseFloat(todayHours.toFixed(1)),
      questions: todayQuestions,
    },
    weekStats: {
      hours:        parseFloat(weekHours.toFixed(1)),
      questions:    weekQuestions,
      targetHours:  parseFloat(targetHours.toFixed(2)),
      // ✅ targetQuestions removido — sem meta definida pelo usuário
    },
    // ✅ FIX: próxima ação exclui matérias já estudadas hoje
    // Se estudou Dir. Tributário hoje, recomenda a próxima matéria do ciclo
    nextSubject: (() => {
      const studiedTodayIds = new Set(sessions.map(s => s.subjectId));
      // Primeiro tenta matéria não estudada hoje
      const notStudiedYet = scored.find(s => !studiedTodayIds.has(s.id));
      // Se todas já foram estudadas hoje, retorna a de maior score mesmo assim
      return notStudiedYet ?? scored[0] ?? null;
    })(),
    weekDay,
  });
}

function formatHours(h: number): string {
  const totalMin = Math.round(h * 60);
  if (totalMin < 60) return `${totalMin}min`;
  const hh = Math.floor(totalMin / 60);
  const mm  = totalMin % 60;
  return mm > 0 ? `${hh}h${mm}min` : `${hh}h`;
}
