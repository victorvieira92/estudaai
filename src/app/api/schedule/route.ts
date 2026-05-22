import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Blocos de estudo por dia da semana (0=Dom, 1=Seg, ..., 6=Sab)
const STUDY_BLOCKS: Record<number, { start: string; end: string; label: string }[]> = {
  0: [ // Domingo
    { start: "04:15", end: "05:30", label: "Bloco 1" },
    { start: "07:00", end: "12:00", label: "Bloco 2" },
    { start: "09:00", end: "10:00", label: "Bloco 3" },
  ],
  1: [ // Segunda
    { start: "04:15", end: "05:30", label: "Bloco 1" },
    { start: "07:00", end: "08:00", label: "Bloco 2" },
    { start: "12:00", end: "13:00", label: "Bloco 3" },
  ],
  2: [ // Terca
    { start: "04:15", end: "05:30", label: "Bloco 1" },
    { start: "07:00", end: "08:00", label: "Bloco 2" },
    { start: "12:00", end: "13:00", label: "Bloco 3" },
  ],
  3: [ // Quarta
    { start: "04:15", end: "05:30", label: "Bloco 1" },
    { start: "07:00", end: "08:00", label: "Bloco 2" },
    { start: "12:00", end: "13:00", label: "Bloco 3" },
  ],
  4: [ // Quinta
    { start: "04:15", end: "05:30", label: "Bloco 1" },
    { start: "07:00", end: "08:00", label: "Bloco 2" },
    { start: "12:00", end: "13:00", label: "Bloco 3" },
  ],
  5: [ // Sexta
    { start: "04:15", end: "05:30", label: "Bloco 1" },
    { start: "07:00", end: "08:00", label: "Bloco 2" },
    { start: "12:00", end: "13:00", label: "Bloco 3" },
  ],
  6: [ // Sabado
    { start: "04:15", end: "05:30", label: "Bloco 1" },
    { start: "07:00", end: "12:00", label: "Bloco 2" },
  ],
};

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({}, { status: 401 });

  const uid = session.user.id as string;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayEnd = new Date(today);
  todayEnd.setHours(23, 59, 59, 999);
  const weekDay = today.getDay();

  const [subjects, reviews, errorNotes, sessions, weeklyGoal] = await Promise.all([
    prisma.subject.findMany({
      where: { userId: uid },
      include: {
        topics: { include: { pdfs: true } },
        errorNotes: { where: { resolved: false } },
        flashcards: { where: { resolved: false } },
      },
      orderBy: { lastStudyAt: "asc" },
    }),
    prisma.review.findMany({
      where: {
        pdf: { topic: { subject: { userId: uid } } },
        completed: false,
        reviewDate: { lte: todayEnd },
      },
      include: { pdf: { include: { topic: { include: { subject: { select: { name: true } } } } } } },
    }),
    prisma.errorNote.findMany({
      where: { userId: uid, resolved: false },
      include: { subject: { select: { name: true } } },
      orderBy: { wrongCount: "desc" },
      take: 5,
    }),
    prisma.studySession.findMany({
      where: { userId: uid, createdAt: { gte: today, lte: todayEnd } },
    }),
    prisma.weeklyGoal.findFirst({
      where: { userId: uid },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Calcular score de prioridade para cada materia
  const scored = subjects.map(s => {
    const allPdfs = s.topics.flatMap(t => t.pdfs);
    const nextPdf = allPdfs.find(p => !p.completed);
    const daysSince = s.lastStudyAt
      ? Math.floor((Date.now() - new Date(s.lastStudyAt).getTime()) / (1000 * 60 * 60 * 24))
      : 30;
    const accuracy = s.totalQuestions > 0 ? (s.correctQuestions / s.totalQuestions) * 100 : 50;
    const score = (s.editalWeight * 10) + (s.criticality * 8) + (daysSince * 3) + (s.errorNotes.length * 12) + ((100 - accuracy) * 0.5);

    return {
      id: s.id,
      name: s.name,
      score: Math.round(score),
      nextPdf: nextPdf ? { id: nextPdf.id, title: nextPdf.title } : null,
      pendingErrors: s.errorNotes.length,
      pendingFlashcards: s.flashcards.length,
      accuracy: Math.round(accuracy),
      studyHours: s.studyHours,
    };
  }).sort((a, b) => b.score - a.score);

  // Blocos de hoje com materia sugerida
  const todayBlocks = (STUDY_BLOCKS[weekDay] ?? []).map((block, i) => ({
    ...block,
    subject: scored[i % scored.length] ?? null,
    duration: calcDuration(block.start, block.end),
  }));

  // Estatisticas de hoje
  const todayHours = sessions.reduce((a, s) => a + s.studyHours, 0);
  const todayQuestions = sessions.reduce((a, s) => a + s.questions, 0);

  // Progresso da semana
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  const weekSessions = await prisma.studySession.findMany({
    where: { userId: uid, createdAt: { gte: weekStart } },
  });
  const weekHours = weekSessions.reduce((a, s) => a + s.studyHours, 0);
  const weekQuestions = weekSessions.reduce((a, s) => a + s.questions, 0);

  return NextResponse.json({
    todayBlocks,
    reviews: reviews.slice(0, 10),
    criticalErrors: errorNotes,
    todayStats: { hours: parseFloat(todayHours.toFixed(1)), questions: todayQuestions },
    weekStats: {
      hours: parseFloat(weekHours.toFixed(1)),
      questions: weekQuestions,
      targetHours: weeklyGoal?.targetHours ?? 23,
      targetQuestions: weeklyGoal?.targetQuestions ?? 300,
    },
    nextSubject: scored[0] ?? null,
    weekDay,
  });
}

function calcDuration(start: string, end: string): string {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins < 60) return `${mins}min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h${m}min` : `${h}h`;
}
