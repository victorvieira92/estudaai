import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({}, { status: 401 });

  const uid = session.user.id;
  const [subjects, errorNotes, reviews, sessions] = await Promise.all([
    prisma.subject.findMany({ where: { userId: uid }, include: { topics: { include: { pdfs: true } } } }),
    prisma.errorNote.findMany({ where: { userId: uid }, include: { subject: { select: { name: true } } } }),
    prisma.review.findMany({ where: { pdf: { topic: { subject: { userId: uid } } } } }),
    prisma.studySession.findMany({ where: { userId: uid }, orderBy: { createdAt: "desc" }, take: 90 }),
  ]);

  const allPdfs = subjects.flatMap((s) => s.topics.flatMap((t) => t.pdfs));
  const totalHours      = subjects.reduce((a, s) => a + s.studyHours, 0);
  const totalQuestions  = subjects.reduce((a, s) => a + s.totalQuestions, 0);
  const totalCorrect    = subjects.reduce((a, s) => a + s.correctQuestions, 0);
  const totalWrong      = subjects.reduce((a, s) => a + s.wrongQuestions, 0);
  const accuracy        = totalQuestions > 0 ? (totalCorrect / totalQuestions) * 100 : 0;
  const today           = new Date(); today.setHours(0, 0, 0, 0);
  const pendingReviews  = reviews.filter((r) => !r.completed).length;
  const lateReviews     = reviews.filter((r) => !r.completed && new Date(r.reviewDate) < today).length;

  const DAYS = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  const weekMap: Record<string, number> = {};
  for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); weekMap[d.toISOString().slice(0,10)] = 0; }
  sessions.forEach((s) => { const k = new Date(s.createdAt).toISOString().slice(0,10); if (k in weekMap) weekMap[k] += s.studyHours; });
  const weeklyHours = Object.entries(weekMap).map(([k, h]) => ({ day: DAYS[new Date(k + "T12:00:00").getDay()], hours: parseFloat(h.toFixed(1)) }));

  return NextResponse.json({
    totalHours: parseFloat(totalHours.toFixed(1)),
    totalQuestions, totalCorrect, totalWrong,
    accuracy: parseFloat(accuracy.toFixed(1)),
    completedPdfs: allPdfs.filter((p) => p.completed).length,
    totalPdfs: allPdfs.length,
    pendingErrors: errorNotes.filter((e) => !e.resolved).length,
    resolvedErrors: errorNotes.filter((e) => e.resolved).length,
    pendingReviews, lateReviews,
    subjectStats: subjects.map((s) => ({ name: s.name, hours: parseFloat(s.studyHours.toFixed(1)), questions: s.totalQuestions, accuracy: s.totalQuestions > 0 ? parseFloat(((s.correctQuestions / s.totalQuestions) * 100).toFixed(1)) : 0, errors: s.wrongQuestions })),
    criticalErrors: errorNotes.filter((e) => !e.resolved).sort((a,b) => (b.wrongCount+b.reviewCount)-(a.wrongCount+a.reviewCount)).slice(0,8).map((e) => ({ title: e.title, subject: e.subject.name, topic: e.topic, reviewCount: e.reviewCount, wrongCount: e.wrongCount, difficulty: e.difficulty })),
    weeklyHours,
  });
}
