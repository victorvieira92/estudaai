import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ✅ Converte qualquer Date para string "YYYY-MM-DD" no fuso de Brasília (UTC-3)
function toBRDate(date: Date): string {
  const br = new Date(date.getTime() - 3 * 60 * 60 * 1000);
  return br.toISOString().slice(0, 10);
}

function todayBR(): string {
  return toBRDate(new Date());
}

function formatHours(h: number): string {
  const totalMin = Math.round(h * 60);
  if (totalMin < 60) return `${totalMin}min`;
  const hh = Math.floor(totalMin / 60);
  const mm  = totalMin % 60;
  return mm > 0 ? `${hh}h${mm}min` : `${hh}h`;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({}, { status: 401 });

  const uid = session.user.id as string;

  // Data de hoje em Brasília
  const todayDS = todayBR(); // "2026-05-25"

  // Range UTC para a query — pega ±1 dia para cobrir qualquer fuso
  const rangeStart = new Date(todayDS + "T00:00:00-03:00"); // meia-noite BR
  const rangeEnd   = new Date(todayDS + "T23:59:59-03:00"); // fim do dia BR
  const weekDay    = new Date().getDay();

  // Início da semana atual em UTC (domingo)
  const nowUTC = new Date();
  nowUTC.setHours(0, 0, 0, 0);
  const weekStart = new Date(nowUTC);
  weekStart.setDate(nowUTC.getDate() - nowUTC.getDay());

  const [subjects, reviews, errorNotes, sessionsToday, sessionsWeek, studyBlocks] =
    await Promise.all([
      prisma.subject.findMany({
        where: { userId: uid },
        include: {
          topics:     { include: { pdfs: true } },
          errorNotes: { where: { resolved: false } },
          flashcards: { where: { resolved: false } },
        },
        orderBy: { lastStudyAt: "asc" },
      }),
      prisma.review.findMany({
        where: {
          pdf:        { topic: { subject: { userId: uid } } },
          completed:  false,
          reviewDate: { lte: rangeEnd },
        },
        include: {
          pdf: { include: { topic: { include: { subject: { select: { name: true } } } } } },
        },
      }),
      prisma.errorNote.findMany({
        where:   { userId: uid, resolved: false },
        include: { subject: { select: { name: true } } },
        orderBy: { wrongCount: "desc" },
        take:    5,
      }),
      // ✅ FIX DEFINITIVO: usa range BR explícito com offset -03:00
      // Isso garante que sessões das 04h de Brasília não caiam no dia errado
      prisma.studySession.findMany({
        where:   { userId: uid, createdAt: { gte: rangeStart, lte: rangeEnd } },
        include: { subject: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.studySession.findMany({
        where: { userId: uid, createdAt: { gte: weekStart } },
      }),
      prisma.studyBlock.findMany({
        where:   { userId: uid },
        include: { subject: { select: { id: true, name: true } } },
        orderBy: [{ dayOfWeek: "asc" }, { hours: "desc" }],
      }),
    ]);

  // ── Score de prioridade ───────────────────────────────────────────────────
  const scored = subjects
    .map(s => {
      const allPdfs   = s.topics.flatMap(t => t.pdfs);
      const nextPdf   = allPdfs.find(p => !p.completed);
      const daysSince = s.lastStudyAt
        ? Math.floor((Date.now() - new Date(s.lastStudyAt).getTime()) / 86400000)
        : 30;

      const hasData  = s.totalQuestions > 0;
      const accuracy = hasData
        ? (s.correctQuestions / s.totalQuestions) * 100
        : null;

      const score = hasData
        ? s.editalWeight * 10 + s.criticality * 8 + daysSince * 3 +
          s.errorNotes.length * 12 + (100 - accuracy!) * 0.5
        : s.editalWeight * 10 + s.criticality * 8 + daysSince * 3 +
          s.errorNotes.length * 12;

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
  let subjectQueue    = [...scored];

  const todayBlocks = todayDbBlocks.map(block => {
    const fixedSubject  = block.subjectId
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
  const todayHours     = sessionsToday.reduce((a, s) => a + s.studyHours, 0);
  const todayQuestions = sessionsToday.reduce((a, s) => a + s.questions,  0);

  // ── Histórico do dia ─────────────────────────────────────────────────────
  const todayHistory = sessionsToday.map(s => ({
    id:          s.id,
    subjectName: s.subject?.name ?? "Sem disciplina",
    subjectId:   s.subjectId,
    hours:       s.studyHours,
    questions:   s.questions,
    correct:     s.correct,
    wrong:       s.wrong,
    createdAt:   s.createdAt.toISOString(),
  }));

  // ── Progresso semanal ─────────────────────────────────────────────────────
  const weekHours     = sessionsWeek.reduce((a, s) => a + s.studyHours, 0);
  const weekQuestions = sessionsWeek.reduce((a, s) => a + s.questions,  0);
  const targetHours   = studyBlocks.reduce((a, b) => a + b.hours, 0);

  // ── Próxima ação — exclui matérias já estudadas hoje ─────────────────────
  // ✅ Se estudou Dir. Tributário hoje, recomenda a próxima do ciclo
  const studiedTodayIds = new Set(sessionsToday.map(s => s.subjectId));
  const nextSubject = scored.find(s => !studiedTodayIds.has(s.id)) ?? scored[0] ?? null;

  return NextResponse.json({
    todayBlocks,
    todayHistory,
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
    },
    nextSubject,
    weekDay,
  });
}
