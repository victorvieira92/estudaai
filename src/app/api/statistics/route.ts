import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({}, { status: 401 });

  const uid = session.user.id as string;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayEnd = new Date(today); todayEnd.setHours(23, 59, 59, 999);

  const [subjects, errorNotes, reviews, allSessions] = await Promise.all([
    prisma.subject.findMany({ where: { userId: uid }, include: { topics: { include: { pdfs: true } } } }),
    prisma.errorNote.findMany({ where: { userId: uid }, include: { subject: { select: { name: true } } } }),
    prisma.review.findMany({ where: { pdf: { topic: { subject: { userId: uid } } } } }),
    prisma.studySession.findMany({ where: { userId: uid }, orderBy: { createdAt: "asc" } }),
  ]);

  const allPdfs        = subjects.flatMap(s => s.topics.flatMap(t => t.pdfs));
  const totalHours     = subjects.reduce((a, s) => a + s.studyHours, 0);
  const totalQuestions = subjects.reduce((a, s) => a + s.totalQuestions, 0);
  const totalCorrect   = subjects.reduce((a, s) => a + s.correctQuestions, 0);
  const totalWrong     = subjects.reduce((a, s) => a + s.wrongQuestions, 0);
  const accuracy       = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;
  const pendingReviews = reviews.filter(r => !r.completed).length;
  const lateReviews    = reviews.filter(r => !r.completed && new Date(r.reviewDate) < today).length;

  // ── Horas por dia (últimos 7 dias) ───────────────────────────────────────
  const DAYS = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  const weekMap: Record<string, number> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    weekMap[d.toISOString().slice(0, 10)] = 0;
  }
  allSessions.forEach(s => {
    const k = new Date(s.createdAt).toISOString().slice(0, 10);
    if (k in weekMap) weekMap[k] += s.studyHours;
  });
  const weeklyHours = Object.entries(weekMap).map(([k, h]) => ({
    day:   DAYS[new Date(k + "T12:00:00").getDay()],
    hours: parseFloat(h.toFixed(1)),
  }));

  // ── Constância — sequência atual de dias com estudo ──────────────────────
  // Agrupa sessões por data
  const sessionDates = new Set(
    allSessions.map(s => new Date(s.createdAt).toISOString().slice(0, 10))
  );
  // Conta streak: quantos dias consecutivos até hoje (ou ontem) têm estudo
  let streak = 0;
  const todayStr     = today.toISOString().slice(0, 10);
  const yesterdayStr = new Date(today.getTime() - 86400000).toISOString().slice(0, 10);
  // Começa de hoje; se não estudou hoje, começa de ontem
  let checkDate = sessionDates.has(todayStr) ? today : new Date(today.getTime() - 86400000);
  while (true) {
    const dateStr = checkDate.toISOString().slice(0, 10);
    if (!sessionDates.has(dateStr)) break;
    streak++;
    checkDate = new Date(checkDate.getTime() - 86400000);
  }
  // Total de dias estudados e dias totais desde o início
  const firstSession  = allSessions[0];
  const firstDate     = firstSession ? new Date(firstSession.createdAt) : today;
  firstDate.setHours(0, 0, 0, 0);
  const totalDays     = Math.max(1, Math.round((today.getTime() - firstDate.getTime()) / 86400000) + 1);
  const studiedDays   = sessionDates.size;
  const consistency   = Math.round((studiedDays / totalDays) * 100);

  // ── Histórico de dias (últimos 30) para o gráfico de constância ──────────
  const consistencyDots: { date: string; studied: boolean }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today); d.setDate(today.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    consistencyDots.push({ date: ds, studied: sessionDates.has(ds) });
  }

  // ── Estudos de hoje ───────────────────────────────────────────────────────
  const todaySessions = allSessions.filter(s => {
    const d = new Date(s.createdAt); return d >= today && d <= todayEnd;
  });
  const todayHours     = todaySessions.reduce((a, s) => a + s.studyHours, 0);
  const todayQuestions = todaySessions.reduce((a, s) => a + s.questions, 0);

  // Horas por disciplina hoje (para o gráfico pizza)
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
      : null, // ✅ null quando sem dados
  }));

  return NextResponse.json({
    // Totais gerais
    totalHours:     parseFloat(totalHours.toFixed(1)),
    totalQuestions, totalCorrect, totalWrong,
    accuracy:       totalQuestions > 0 ? parseFloat(accuracy.toFixed(1)) : null,
    completedPdfs:  allPdfs.filter(p => p.completed).length,
    totalPdfs:      allPdfs.length,
    pendingErrors:  errorNotes.filter(e => !e.resolved).length,
    resolvedErrors: errorNotes.filter(e => e.resolved).length,
    pendingReviews, lateReviews,
    // Constância
    streak, studiedDays, totalDays, consistency, consistencyDots,
    // Hoje
    todayHours:     parseFloat(todayHours.toFixed(1)),
    todayQuestions,
    todayBySubject,
    // Por disciplina
    subjectStats,
    criticalErrors: errorNotes
      .filter(e => !e.resolved)
      .sort((a, b) => (b.wrongCount + b.reviewCount) - (a.wrongCount + a.reviewCount))
      .slice(0, 8)
      .map(e => ({ title: e.title, subject: e.subject.name, topic: e.topic, reviewCount: e.reviewCount, wrongCount: e.wrongCount, difficulty: e.difficulty })),
    weeklyHours,
  });
}
