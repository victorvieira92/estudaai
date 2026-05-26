import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function toBRDate(date: Date): string {
  const br = new Date(date.getTime() - 3 * 60 * 60 * 1000);
  return br.toISOString().slice(0, 10);
}
function todayBR(): string { return toBRDate(new Date()); }

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({}, { status: 401 });
  const uid = session.user.id as string;

  const todayUTC = new Date();
  todayUTC.setHours(0, 0, 0, 0);

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
  const pendingReviews = reviews.filter(r => !r.completed).length;
  const lateReviews    = reviews.filter(r => !r.completed && new Date(r.reviewDate) < todayUTC).length;

  // ── KPIs globais — calculados direto das StudySessions (fonte única) ──────
  const totalHours     = allSessions.reduce((a, s) => a + s.studyHours, 0);
  const totalQuestions = allSessions.reduce((a, s) => a + s.questions, 0);
  const totalCorrect   = allSessions.reduce((a, s) => a + s.correct, 0);
  const totalWrong     = allSessions.reduce((a, s) => a + s.wrong, 0);

  // ── Stats por disciplina — também via StudySessions ───────────────────────
  const subjectSessionMap = new Map<string, {
    name: string; hours: number; questions: number; correct: number; wrong: number;
  }>();
  for (const subj of subjects) {
    subjectSessionMap.set(subj.id, {
      name: subj.name, hours: 0, questions: 0, correct: 0, wrong: 0,
    });
  }
  for (const s of allSessions) {
    const entry = subjectSessionMap.get(s.subjectId);
    if (entry) {
      entry.hours     += s.studyHours;
      entry.questions += s.questions;
      entry.correct   += s.correct;
      entry.wrong     += s.wrong;
    }
  }
  const subjectStats = Array.from(subjectSessionMap.values()).map(s => ({
    name:      s.name,
    hours:     parseFloat(s.hours.toFixed(1)),
    questions: s.questions,
    correct:   s.correct,
    wrong:     s.wrong,
    accuracy:  s.questions > 0
      ? parseFloat(((s.correct / s.questions) * 100).toFixed(1))
      : null,
  }));

  // ── Horas por dia (últimos 7 dias) ────────────────────────────────────────
  const DAYS_BR = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  const weekMap: Record<string, { label: string; hours: number; questions: number; correct: number; wrong: number }> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = toBRDate(d);
    weekMap[ds] = { label: DAYS_BR[d.getDay()], hours: 0, questions: 0, correct: 0, wrong: 0 };
  }
  for (const s of allSessions) {
    const ds = toBRDate(new Date(s.createdAt));
    if (ds in weekMap) {
      weekMap[ds].hours     += s.studyHours;
      weekMap[ds].questions += s.questions;
      weekMap[ds].correct   += s.correct;
      weekMap[ds].wrong     += s.wrong;
    }
  }
  const weeklyHours = Object.values(weekMap).map(({ label, hours }) => ({
    day: label, hours: parseFloat(hours.toFixed(1)),
  }));

  // ── Constância ────────────────────────────────────────────────────────────
  const sessionDatesBR = new Set(allSessions.map(s => toBRDate(new Date(s.createdAt))));
  const todayDS  = todayBR();
  const msPerDay = 86400000;

  let streak  = 0;
  let checkTS = sessionDatesBR.has(todayDS) ? Date.now() : Date.now() - msPerDay;
  while (true) {
    const ds = toBRDate(new Date(checkTS));
    if (!sessionDatesBR.has(ds)) break;
    streak++;
    checkTS -= msPerDay;
  }

  const firstSession = allSessions[0];
  const firstDS      = firstSession ? toBRDate(new Date(firstSession.createdAt)) : todayDS;
  const firstMs      = new Date(firstDS + "T12:00:00").getTime();
  const todayMs      = new Date(todayDS + "T12:00:00").getTime();
  const totalDays    = Math.max(1, Math.round((todayMs - firstMs) / msPerDay) + 1);
  const studiedDays  = sessionDatesBR.size;
  const consistency  = Math.round((studiedDays / totalDays) * 100);

  const consistencyDots: { date: string; studied: boolean }[] = [];
  const daysToShow = Math.min(totalDays, 90);
  for (let i = daysToShow - 1; i >= 0; i--) {
    const ds = toBRDate(new Date(todayMs - i * msPerDay));
    consistencyDots.push({ date: ds, studied: sessionDatesBR.has(ds) });
  }

  // ── Estudos de hoje ───────────────────────────────────────────────────────
  const todaySessions  = allSessions.filter(s => toBRDate(new Date(s.createdAt)) === todayDS);
  const todayHours     = todaySessions.reduce((a, s) => a + s.studyHours, 0);
  const todayQuestions = todaySessions.reduce((a, s) => a + s.questions, 0);

  const todaySubjectMap = new Map<string, number>();
  for (const s of todaySessions) {
    const subj = subjects.find(sub => sub.id === s.subjectId);
    if (subj) todaySubjectMap.set(subj.name, (todaySubjectMap.get(subj.name) ?? 0) + s.studyHours);
  }
  const todayBySubject = Array.from(todaySubjectMap.entries()).map(([name, hours]) => ({
    name, hours: parseFloat(hours.toFixed(2)),
  }));

  // ── Dados semanais navegáveis (últimas 8 semanas) ─────────────────────────
  function getWeekData(weekOffset: number) {
    const now = new Date();
    const dow = now.getDay();
    const sunday = new Date(now);
    sunday.setDate(now.getDate() - dow - weekOffset * 7);
    sunday.setHours(0, 0, 0, 0);

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(sunday);
      d.setDate(sunday.getDate() + i);
      const ds = toBRDate(d);
      const daySessions = allSessions.filter(s => toBRDate(new Date(s.createdAt)) === ds);
      return {
        day:       DAYS_BR[d.getDay()],
        date:      ds,
        hours:     parseFloat(daySessions.reduce((a, s) => a + s.studyHours, 0).toFixed(1)),
        questions: daySessions.reduce((a, s) => a + s.questions, 0),
        correct:   daySessions.reduce((a, s) => a + s.correct, 0),
        wrong:     daySessions.reduce((a, s) => a + s.wrong, 0),
      };
    });
  }

  const weeksData = Array.from({ length: 8 }, (_, i) => {
    const days = getWeekData(i);
    return { weekOffset: i, startDate: days[0].date, endDate: days[6].date, days };
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
