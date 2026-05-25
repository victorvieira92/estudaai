import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({}, { status: 401 });

  const uid = session.user.id as string;

  // ── Fuso de Brasília ───────────────────────────────────────────────────────
  const todayDS    = todayBR();
  const rangeStart = new Date(todayDS + "T00:00:00-03:00");
  const rangeEnd   = new Date(todayDS + "T23:59:59-03:00");

  // ✅ FIX: Dia atual do ciclo vem via query param ?cycleDay=N
  // O front-end passa o valor do localStorage (CYCLE_KEY)
  const url      = new URL(req.url);
  const cycleDay = parseInt(url.searchParams.get("cycleDay") ?? "0", 10);

  const nowUTC = new Date();
  nowUTC.setHours(0, 0, 0, 0);
  const weekStart = new Date(nowUTC);
  weekStart.setDate(nowUTC.getDate() - nowUTC.getDay());

  const [subjects, reviews, errorNotes, sessionsToday, sessionsWeek, studyBlocks] =
    await Promise.all([
      prisma.subject.findMany({
        where:   { userId: uid },
        include: {
          topics:     { include: { pdfs: true } },
          errorNotes: { where: { resolved: false } },
          flashcards: { where: { resolved: false } },
        },
        orderBy: { lastStudyAt: "asc" },
      }),
      prisma.review.findMany({
        where: {
          pdf:       { topic: { subject: { userId: uid } } },
          completed: false,
          // ✅ FIX: revisões só aparecem a partir de amanhã
          reviewDate: { lt: rangeStart }, // estritamente antes de hoje (já vencidas)
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
      // ✅ FIX: prioriza PDFs já iniciados (lastPageStudied > 0) antes dos intocados
      // Evita pular "Aula 00" (18% progresso) e ir direto para "Aula 01" (0%)
      const notCompleted = allPdfs.filter(p => !p.completed);
      const nextPdf = notCompleted.find(p => p.lastPageStudied > 0) ?? notCompleted[0] ?? null;
      const daysSince = s.lastStudyAt
        ? Math.floor((Date.now() - new Date(s.lastStudyAt).getTime()) / 86400000)
        : 30;
      const hasData  = s.totalQuestions > 0;
      const accuracy = hasData ? (s.correctQuestions / s.totalQuestions) * 100 : null;
      const score    = hasData
        ? s.editalWeight * 10 + s.criticality * 8 + daysSince * 3 + s.errorNotes.length * 12 + (100 - accuracy!) * 0.5
        : s.editalWeight * 10 + s.criticality * 8 + daysSince * 3 + s.errorNotes.length * 12;

      return {
        id:            s.id,
        name:          s.name,
        score:         Math.round(score),
        nextPdf:       nextPdf ? { id: nextPdf.id, title: nextPdf.title } : null,
        pendingErrors: s.errorNotes.length,
        accuracy:      hasData ? Math.round(accuracy!) : null,
        studyHours:    s.studyHours,
      };
    })
    .sort((a, b) => b.score - a.score);

  // ── Dias únicos do ciclo ordenados ────────────────────────────────────────
  const cycleDayKeys = [...new Set(studyBlocks.map(b => b.dayOfWeek))].sort((a, b) => a - b);

  // ✅ FIX: usa cycleDay do query param — Dia 1 = índice 0 = dayOfWeek 0
  // Não usa weekDay (dia da semana) — usa o índice do ciclo
  const currentDayOfWeek = cycleDayKeys[cycleDay] ?? cycleDayKeys[0] ?? 0;
  const todayDbBlocks    = studyBlocks.filter(b => b.dayOfWeek === currentDayOfWeek);

  const todayBlocks = todayDbBlocks.map(block => {
    const fixedSubject  = block.subjectId
      ? scored.find(s => s.id === block.subjectId) ?? null
      : null;
    return {
      start:    block.startTime ?? "—",
      end:      block.endTime   ?? "—",
      label:    block.blockType,
      duration: formatHours(block.hours),
      subject:  fixedSubject,
    };
  });

  // ── Estatísticas de hoje ──────────────────────────────────────────────────
  const todayHours     = sessionsToday.reduce((a, s) => a + s.studyHours, 0);
  const todayQuestions = sessionsToday.reduce((a, s) => a + s.questions, 0);

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

  const weekHours     = sessionsWeek.reduce((a, s) => a + s.studyHours, 0);
  const weekQuestions = sessionsWeek.reduce((a, s) => a + s.questions, 0);
  const targetHours   = studyBlocks.reduce((a, b) => a + b.hours, 0);

  // ── Próxima ação — próximo bloco do Dia atual do ciclo não estudado ───────
  // Conta sessões de hoje por matéria
  const sessionsPerSubjectToday = new Map<string, number>();
  for (const s of sessionsToday) {
    sessionsPerSubjectToday.set(s.subjectId, (sessionsPerSubjectToday.get(s.subjectId) ?? 0) + 1);
  }

  // Conta blocos do dia atual por matéria
  const blocksPerSubjectToday = new Map<string, number>();
  for (const b of todayDbBlocks) {
    if (b.subjectId)
      blocksPerSubjectToday.set(b.subjectId, (blocksPerSubjectToday.get(b.subjectId) ?? 0) + 1);
  }

  // ✅ Próximo bloco = primeira matéria do dia onde sessões < blocos
  let nextSubject: typeof scored[0] | null = null;
  for (const block of todayDbBlocks) {
    if (!block.subjectId) continue;
    const done  = sessionsPerSubjectToday.get(block.subjectId) ?? 0;
    const total = blocksPerSubjectToday.get(block.subjectId) ?? 1;
    if (done < total) {
      nextSubject = scored.find(s => s.id === block.subjectId) ?? null;
      break;
    }
  }

  // Fallback: se todos os blocos do dia foram feitos, recomenda por score
  if (!nextSubject) nextSubject = scored[0] ?? null;

  return NextResponse.json({
    todayBlocks,
    todayHistory,
    reviews:        reviews.slice(0, 10),
    criticalErrors: errorNotes,
    todayStats:     { hours: parseFloat(todayHours.toFixed(1)), questions: todayQuestions },
    weekStats: {
      hours:       parseFloat(weekHours.toFixed(1)),
      questions:   weekQuestions,
      targetHours: parseFloat(targetHours.toFixed(2)),
    },
    nextSubject,
    nextBlockType: (() => {
      for (const block of todayDbBlocks) {
        if (!block.subjectId) continue;
        const done  = sessionsPerSubjectToday.get(block.subjectId) ?? 0;
        const total = blocksPerSubjectToday.get(block.subjectId) ?? 1;
        if (done < total) return block.blockType;
      }
      return null;
    })(),
    weekDay: currentDayOfWeek,
  });
}
