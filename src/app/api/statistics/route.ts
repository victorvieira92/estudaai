import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ✅ Converte Date para string "YYYY-MM-DD" no fuso de Brasília (UTC-3)
// Corrige o bug onde sessões das 04h de Brasília aparecem como dia anterior em UTC
function toBRDate(date: Date): string {
  const br = new Date(date.getTime() - 3 * 60 * 60 * 1000);
  return br.toISOString().slice(0, 10);
}

// Data de hoje em Brasília
function todayBR(): string {
  return toBRDate(new Date());
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({}, { status: 401 });

  const uid = session.user.id as string;

  // Hoje em UTC puro para queries do banco
  const todayUTC = new Date();
  todayUTC.setHours(0, 0, 0, 0);
  const todayEndUTC = new Date(todayUTC);
  todayEndUTC.setHours(23, 59, 59, 999);

  const [subjects, errorNotes, reviews, allSessions] = await Promise.all([
    prisma.subject.findMany({
      where:   { userId: uid },
      include: { topics: { include: { pdfs: true } } },
    }),
    prisma.errorNote.findMany({
      where:   { userId: uid },
      include: { subject: { select: { name: true } } },
    }),
    prisma.review.findMany({
      where: { pdf: { topic: { subject: { userId: uid } } } },
    }),
    prisma.studySession.findMany({
      where:   { userId: uid },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const allPdfs        = subjects.flatMap(s => s.topics.flatMap(t => t.pdfs));
  const totalHours     = subjects.reduce((a, s) => a + s.studyHours, 0);
  const totalQuestions = subjects.reduce((a, s) => a + s.totalQuestions, 0);
  const totalCorrect   = subjects.reduce((a, s) => a + s.correctQuestions, 0);
  const totalWrong     = subjects.reduce((a, s) => a + s.wrongQuestions, 0);
  const pendingReviews = reviews.filter(r => !r.completed).length;
  const lateReviews    = reviews.filter(r => !r.completed && new Date(r.reviewDate) < todayUTC).length;

  // ── Horas por dia (últimos 7 dias) — usando datas em BR ─────────────────
  const DAYS = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  const weekMap: Record<string, { label: string; hours: number }> = {};
  for (let i = 6; i >= 0; i--) {
    const d  = new Date();
    d.setDate(d.getDate() - i);
    const ds = toBRDate(d);
    weekMap[ds] = { label: DAYS[d.getDay()], hours: 0 };
  }
  allSessions.forEach(s => {
    const ds = toBRDate(new Date(s.createdAt));
    if (ds in weekMap) weekMap[ds].hours += s.studyHours;
  });
  const weeklyHours = Object.values(weekMap).map(({ label, hours }) => ({
    day: label, hours: parseFloat(hours.toFixed(1)),
  }));

  // ── Constância — usando datas em BR ──────────────────────────────────────
  // ✅ FIX: agrupa por data BR, não por ISO UTC
  const sessionDatesBR = new Set(
    allSessions.map(s => toBRDate(new Date(s.createdAt)))
  );

  // Streak: dias consecutivos até hoje (BR)
  let streak    = 0;
  const todayDS = todayBR();
  const yesterDS = toBRDate(new Date(Date.now() - 86400000));

  // Começa de hoje se estudou hoje, senão de ontem
  let checkTS = sessionDatesBR.has(todayDS)
    ? Date.now()
    : Date.now() - 86400000;

  while (true) {
    const ds = toBRDate(new Date(checkTS));
    if (!sessionDatesBR.has(ds)) break;
    streak++;
    checkTS -= 86400000;
  }

  // ✅ FIX: dias totais desde primeira sessão real
  const firstSession = allSessions[0];
  const firstDS      = firstSession ? toBRDate(new Date(firstSession.createdAt)) : todayDS;
  // Conta dias entre primeira sessão e hoje
  const msPerDay = 86400000;
  const firstMs  = new Date(firstDS + "T12:00:00").getTime();
  const todayMs  = new Date(todayDS + "T12:00:00").getTime();
  const totalDays  = Math.max(1, Math.round((todayMs - firstMs) / msPerDay) + 1);
  const studiedDays = sessionDatesBR.size;
  const consistency = Math.round((studiedDays / totalDays) * 100);

  // ── Dots dos últimos 30 dias — usando datas BR ───────────────────────────
  const consistencyDots: { date: string; studied: boolean }[] = [];
  for (let i = 29; i >= 0; i--) {
    const ds = toBRDate(new Date(Date.now() - i * msPerDay));
    consistencyDots.push({ date: ds, studied: sessionDatesBR.has(ds) });
  }

  // ── Estudos de hoje — usando data BR ─────────────────────────────────────
  const todaySessions = allSessions.filter(
    s => toBRDate(new Date(s.createdAt)) === todayDS
  );
  const todayHours     = todaySessions.reduce((a, s) => a + s.studyHours, 0);
  const todayQuestions = todaySessions.reduce((a, s) => a + s.questions, 0);

  const subjectMap = new Map<string, number>();
  for (const s of todaySessions) {
    const subj = subjects.find(sub => sub.id === s.subjectId);
    if (subj) subjectMap.set(subj.name, (subjectMap.get(subj.name) ?? 0) + s.studyHours);
  }
  const todayBySubject = Array.from(subjectMap.entries()).map(([name, hours]) => ({
    name, hours: parseFloat(hours.toFixed(2)),
  }));

  // ── Stats por disciplina ─────────────────────────────────────────────────
  const subjectStats = subjects.map(s => ({
    name:      s.name,
    hours:     parseFloat(s.studyHours.toFixed(1)),
    questions: s.totalQuestions,
    correct:   s.correctQuestions,
    wrong:     s.wrongQuestions,
    accuracy:  s.totalQuestions > 0
      ? parseFloat(((s.correctQuestions / s.totalQuestions) * 100).toFixed(1))
      : null,
  }));

  return NextResponse.json({
    totalHours:     parseFloat(totalHours.toFixed(1)),
    totalQuestions, totalCorrect, totalWrong,
    accuracy:       totalQuestions > 0
      ? parseFloat(((totalCorrect / totalQuestions) * 100).toFixed(1))
      : null,
    completedPdfs:  allPdfs.filter(p => p.completed).length,
    totalPdfs:      allPdfs.length,
    pendingErrors:  errorNotes.filter(e => !e.resolved).length,
    resolvedErrors: errorNotes.filter(e => e.resolved).length,
    pendingReviews, lateReviews,
    // Constância
    streak, studiedDays, totalDays, consistency, consistencyDots,
    // Hoje
    todayHours:     parseFloat(todayHours.toFixed(1)),
    todayQuestions, todayBySubject,
    // Por disciplina
    subjectStats,
    criticalErrors: errorNotes
      .filter(e => !e.resolved)
      .sort((a, b) => (b.wrongCount + b.reviewCount) - (a.wrongCount + a.reviewCount))
      .slice(0, 8)
      .map(e => ({
        title: e.title, subject: e.subject.name, topic: e.topic,
        reviewCount: e.reviewCount, wrongCount: e.wrongCount, difficulty: e.difficulty,
      })),
    weeklyHours,
  });
}
