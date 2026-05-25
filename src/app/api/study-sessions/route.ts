import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { safeInt, safeFloat, addDays, startOfTomorrow } from "@/lib/utils";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });

  try {
    const body = await req.json();
    const subjectId = String(body.subjectId ?? "").trim();
    const topicId   = String(body.topicId   ?? "").trim();
    const pdfId     = String(body.pdfId     ?? "").trim();

    if (!subjectId) return NextResponse.json({ message: "Disciplina obrigatória." }, { status: 400 });

    const hours      = safeFloat(body.hours ?? body.studyHours);
    const duration   = safeInt(body.duration) || Math.max(1, Math.round(hours * 60));
    const questions  = safeInt(body.questions);
    const correct    = safeInt(body.correctQuestions ?? body.correct);
    const wrong      = safeInt(body.wrongQuestions ?? body.errors ?? (questions - correct));
    const startPage  = safeInt(body.startPage);
    const endPage    = safeInt(body.endPage);
    const totalPages = safeInt(body.totalPages);
    const completed  = Boolean(body.completed ?? body.markCompleted);

    await prisma.$transaction(async (tx) => {
      // 1. Sessão de estudo
      await tx.studySession.create({
        data: {
          userId:     session.user!.id as string,
          subjectId,
          duration,
          studyHours: hours,
          questions,
          correct,
          wrong,
        },
      });

      // 2. PDF (se selecionado)
      if (pdfId) {
        const pdf = await tx.pdf.findUnique({ where: { id: pdfId } });
        if (pdf) {
          const finalTotal   = totalPages > 0 ? totalPages : pdf.totalPages;
          const finalLast    = Math.max(pdf.lastPageStudied, endPage);
          const shouldFinish = completed || (finalTotal > 0 && finalLast >= finalTotal);

          await tx.pdfStudyLog.create({
            data: {
              pdfId,
              studyHours:       hours,
              questions,
              correctQuestions: correct,
              wrongQuestions:   wrong,
              startPage,
              endPage,
            },
          });

          await tx.pdf.update({
            where: { id: pdfId },
            data: {
              studyHours:       { increment: hours },
              questions:        { increment: questions },
              correctQuestions: { increment: correct },
              wrongQuestions:   { increment: wrong },
              lastPageStudied:  finalLast,
              ...(finalTotal > 0 && { totalPages: finalTotal }),
              completed: shouldFinish,
            },
          });

          // 3. Revisões espaçadas — todas usando fuso de Brasília
          // ✅ FIX: revisão 24h começa amanhã (startOfTomorrow), não hoje
          // Revisão  7d = amanhã + 6 dias = 7 dias após o estudo
          // Revisão 30d = amanhã + 29 dias = 30 dias após o estudo
          const tomorrow = startOfTomorrow();

          const revisoesPendentes = await tx.review.findMany({
            where: { pdfId, completed: false },
          });

          // Remove revisões pendentes antigas do mesmo PDF para não duplicar
          if (revisoesPendentes.length > 0) {
            await tx.review.deleteMany({
              where: { pdfId, completed: false },
            });
          }

          // Cria revisões novas com datas corretas em BR
          for (const [type, days] of [
            ["24H",  1] as const,  // amanhã
            ["7D",   7] as const,  // 7 dias a partir de amanhã
            ["30D", 30] as const,  // 30 dias a partir de amanhã
          ]) {
            await tx.review.create({
              data: {
                type,
                reviewDate: addDays(tomorrow, days - 1),
                pdfId,
              },
            });
          }
        }
      }
    });

    // Recalcula disciplina e tópico
    await recalcSubject(subjectId);
    if (topicId) await recalcTopic(topicId);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[study-sessions POST]", e);
    return NextResponse.json({ message: "Erro interno.", detail: String(e) }, { status: 500 });
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json([], { status: 401 });

  const sessions = await prisma.studySession.findMany({
    where:   { userId: session.user.id as string },
    orderBy: { createdAt: "desc" },
    take:    60,
    include: { subject: { select: { name: true } } },
  });
  return NextResponse.json(sessions);
}

async function recalcTopic(topicId: string) {
  const topic = await prisma.topic.findUnique({
    where:   { id: topicId },
    include: { pdfs: true },
  });
  if (!topic) return;
  const total = topic.pdfs.length;
  const done  = topic.pdfs.filter(p => p.completed).length;
  await prisma.topic.update({
    where: { id: topicId },
    data: {
      totalPdfs:     total,
      completedPdfs: done,
      progress:      total > 0 ? Math.round((done / total) * 100) : 0,
    },
  });
}

async function recalcSubject(subjectId: string) {
  const sub = await prisma.subject.findUnique({
    where:   { id: subjectId },
    include: { topics: { include: { pdfs: true } } },
  });
  if (!sub) return;
  const pdfs = sub.topics.flatMap(t => t.pdfs);
  await prisma.subject.update({
    where: { id: subjectId },
    data: {
      totalPdfs:        pdfs.length,
      completedPdfs:    pdfs.filter(p => p.completed).length,
      studyHours:       pdfs.reduce((a, p) => a + p.studyHours, 0),
      totalQuestions:   pdfs.reduce((a, p) => a + p.questions, 0),
      correctQuestions: pdfs.reduce((a, p) => a + p.correctQuestions, 0),
      wrongQuestions:   pdfs.reduce((a, p) => a + p.wrongQuestions, 0),
      progress:         pdfs.length > 0
        ? Math.round((pdfs.filter(p => p.completed).length / pdfs.length) * 100)
        : 0,
      lastStudyAt: new Date(),
    },
  });
}
