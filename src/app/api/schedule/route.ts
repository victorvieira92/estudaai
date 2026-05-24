import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({}, { status: 401 });

  const uid = session.user.id as string;
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
      where:    { userId: uid, resolved: false },
      include:  { subject: { select: { name: true } } },
      orderBy:  { wrongCount: "desc" },
      take:     5,
    }),
    prisma.studySession.findMany({
      where: { userId: uid, createdAt: { gte: today, lte: todayEnd } },
    }),
    // ✅ FIX: lê os blocos configurados pelo usuário no Calendário
    // Substitui o STUDY_BLOCKS hardcoded que ignorava a configuração real
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

      // ✅ FIX: accuracy null quando sem dados — nunca usar 50 como default
      const hasData = s.totalQuestions > 0;
      const accuracy = hasData
        ? (s.correctQuestions / s.totalQuestions) * 100
        : null;

      // Score sem dados: não inclui componente de acerto
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
        id:               s.id,
        name:             s.name,
        score:            Math.round(score),
        nextPdf:          nextPdf ? { id: nextPdf.id, title: nextPdf.title } : null,
        pendingErrors:    s.errorNotes.length,
        pendingFlashcards: s.flashcards.length,
        // ✅ FIX: accuracy null = sem dados, nunca "50%"
        accuracy:         hasData ? Math.round(accuracy!) : null,
        studyHours:       s.studyHours,
      };
    })
    .sort((a, b) => b.score - a.score);

  // ── Blocos de hoje ────────────────────────────────────────────────────────
  // ✅ FIX: usa os study-blocks do banco (configurados pelo usuário no Calendário)
  // e não mais o STUDY_BLOCKS hardcoded
  const todayDbBlocks = studyBlocks.filter(b => b.dayOfWeek === weekDay);

  // Mapeia cada bloco para o formato esperado pelo front-end
  // Se o bloco tem matéria fixa → usa ela
  // Se não tem → sugere pela fila de prioridade
  let subjectQueue = [...scored]; // cópia para rotacionar

  const todayBlocks = todayDbBlocks.map(block => {
    // Matéria vinculada ao bloco (configurada no Calendário)
    const fixedSubject = block.subjectId
      ? scored.find(s => s.id === block.subjectId) ?? null
      : null;

    // Se não tem matéria fixa, pega a próxima da fila de prioridade
    const subjectToShow = fixedSubject ?? subjectQueue.shift() ?? null;

    // Gera start/end a partir das horas do bloco (sem startTime/endTime no banco,
    // calcula horários ilustrativos baseados na ordem e duração)
    const startTime = block.startTime ?? null;
    const endTime   = block.endTime   ?? null;

    return {
      start:    startTime ?? "—",
      end:      endTime   ?? "—",
      label:    block.blockType,
      duration: formatHours(block.hours),
      subject:  subjectToShow,
    };
  });

  // ── Estatísticas de hoje ──────────────────────────────────────────────────
  const todayHours     = sessions.reduce((a, s) => a + s.studyHours, 0);
  const todayQuestions = sessions.reduce((a, s) => a + s.questions, 0);

  // ── Progresso da semana ───────────────────────────────────────────────────
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  const weekSessions = await prisma.studySession.findMany({
    where: { userId: uid, createdAt: { gte: weekStart } },
  });
  const weekHours     = weekSessions.reduce((a, s) => a + s.studyHours, 0);
  const weekQuestions = weekSessions.reduce((a, s) => a + s.questions, 0);

  // ✅ FIX: targetHours vem da soma dos study-blocks da semana (fonte única)
  // Não usa mais weeklyGoal separado nem hardcode de 23
  const targetHours = studyBlocks.reduce((a, b) => a + b.hours, 0);

  // targetQuestions: mantém lógica de weeklyGoal ou padrão 300
  // (não há uma fonte melhor sem que o usuário configure)
  const weeklyGoal = await prisma.weeklyGoal.findFirst({
    where:   { userId: uid },
    orderBy: { createdAt: "desc" },
  });
  const targetQuestions = weeklyGoal?.targetQuestions ?? 300;

  return NextResponse.json({
    todayBlocks,
    reviews:        reviews.slice(0, 10),
    criticalErrors: errorNotes,
    todayStats: {
      hours:     parseFloat(todayHours.toFixed(1)),
      questions: todayQuestions,
    },
    weekStats: {
      hours:           parseFloat(weekHours.toFixed(1)),
      questions:       weekQuestions,
      // ✅ FIX: targetHours = soma real dos study-blocks cadastrados
      targetHours:     parseFloat(targetHours.toFixed(2)),
      targetQuestions,
    },
    nextSubject: scored[0] ?? null,
    weekDay,
  });
}

// Formata horas fracionadas → "1h", "1h30min", "45min"
function formatHours(h: number): string {
  const totalMin = Math.round(h * 60);
  if (totalMin < 60) return `${totalMin}min`;
  const hh = Math.floor(totalMin / 60);
  const mm = totalMin % 60;
  return mm > 0 ? `${hh}h${mm}min` : `${hh}h`;
}
