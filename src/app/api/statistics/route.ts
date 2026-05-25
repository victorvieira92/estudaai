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

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({}, { status: 401 });

  const uid = session.user.id as string;

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

  // ── Horas por dia (últimos 7 dias) ───────────────────────────────────────
  const DAYS = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  const weekMap: Record<string, { label: string; hours: number }> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
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

  // ── Constância ───────────────────────────────────────────────────────────
  const sessionDatesBR = new Set(
    allSessions.map(s => toBRDate(new Date(s.createdAt)))
  );

  const todayDS  = todayBR();
  const msPerDay = 86400000;

  // Streak: dias consecutivos até hoje
  let streak  = 0;
  let checkTS = sessionDatesBR.has(todayDS)
    ? Date.now()
    : Date.now() - msPerDay;
  while (true) {
    const ds = toBRDate(new Date(checkTS));
    if (!sessionDatesBR.has(ds)) break;
    streak++;
    checkTS -= msPerDay;
  }

  // Primeiro dia de estudo do usuário em BR
  const firstSession = allSessions[0];
  const firstDS      = firstSession ? toBRDate(new Date(firstSession.createdAt)) : todayDS;
  const firstMs      = new Date(firstDS + "T12:00:00").getTime();
  const todayMs      = new Date(todayDS + "T12:00:00").getTime();
  const totalDays    = Math.max(1, Math.round((todayMs - firstMs) / msPerDay) + 1);
  const studiedDays  = sessionDatesBR.size;
  const consistency  = Math.round((studiedDays / totalDays) * 100);

  // ✅ FIX: dots começam no primeiro dia de estudo do usuário, não 30 dias atrás
  // Para um novo usuário que começou hoje, aparece só 1 dot (hoje = verde)
  // Os dots crescem dia a dia conforme o usuário estuda
  const consistencyDots: { date: string; studied: boolean }[] = [];
  const daysToShow = Math.min(totalDays, 90); // máximo 90 dots
  for (let i = daysToShow - 1; i >= 0; i--) {
    const ds = toBRDate(new Date(todayMs - i * msPerDay));
    consistencyDots.push({ date: ds, studied: sessionDatesBR.has(ds) });
  }

  // ── Estudos de hoje ───────────────────────────────────────────────────────
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

  // ── Stats por disciplina ──────────────────────────────────────────────────
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

  // ── Dados semanais com horas + questões (últimas 8 semanas) ──────────────
  // Permite navegação entre semanas no gráfico do Dashboard
  const DAYS_BR = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  
  function getWeekData(weekOffset: number): { day: string; date: string; hours: number; questions: number }[] {
    // weekOffset 0 = semana atual, 1 = semana passada, etc
    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - dayOfWeek - (weekOffset * 7));
    monday.setHours(0, 0, 0, 0);
    
    const result = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const ds = toBRDate(d);
      const daySessions = allSessions.filter(s => toBRDate(new Date(s.createdAt)) === ds);
      result.push({
        day:       DAYS_BR[d.getDay()],
        date:      ds,
        hours:     parseFloat(daySessions.reduce((a, s) => a + s.studyHours, 0).toFixed(1)),
        questions: daySessions.reduce((a, s) => a + s.questions, 0),
      });
    }
    return result;
  }

  // Gera as últimas 8 semanas
  const weeksData = Array.from({ length: 8 }, (_, i) => {
    const weekDays = getWeekData(i);
    const startDate = weekDays[0].date;
    const endDate   = weekDays[6].date;
    return { weekOffset: i, startDate, endDate, days: weekDays };
  });

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
    streak, studiedDays, totalDays, consistency, consistencyDots,
    todayHours:     parseFloat(todayHours.toFixed(1)),
    todayQuestions, todayBySubject,
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
    weeksData,
  });
}
