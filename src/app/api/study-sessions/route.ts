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

    const notes = JSON.stringify({
      category:  body.category  ?? "Teoria",
      topicName: body.topicName ?? "",
      pdfTitle:  body.pdfTitle  ?? "",
      comment:   body.comment   ?? "",
    });

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
          notes,
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

          // 3. Revisões espaçadas
          const tomorrow = startOfTomorrow();
          await tx.review.deleteMany({ where: { pdfId, completed: false } });
          for (const [type, days] of [["24H",1],["7D",7],["30D",30]] as const) {
            await tx.review.create({
              data: { type, reviewDate: addDays(tomorrow, days - 1), pdfId },
            });
          }
        }
      }
    });

    // Recalcula subject somando PDFs + sessões sem PDF
    await recalcSubjectWithSessions(subjectId);
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
  const topic = await prisma.topic.findUnique({ where: { id: topicId }, include: { pdfs: true } });
  if (!topic) return;
  const total = topic.pdfs.length;
  const done  = topic.pdfs.filter(p => p.completed).length;
  await prisma.topic.update({
    where: { id: topicId },
    data: { totalPdfs: total, completedPdfs: done, progress: total > 0 ? Math.round((done / total) * 100) : 0 },
  });
}

// Recalcula subject somando PDFs E sessões que não têm PDF vinculado
async function recalcSubjectWithSessions(subjectId: string) {
  const sub = await prisma.subject.findUnique({
    where:   { id: subjectId },
    include: { topics: { include: { pdfs: true } } },
  });
  if (!sub) return;

  const pdfs = sub.topics.flatMap(t => t.pdfs);

  // Soma das sessões SEM pdf associado (pdfId vazio ou nulo via notes)
  // Usamos as StudySessions que não têm correspondente em PdfStudyLog
  const allSessions = await prisma.studySession.findMany({
    where: { subjectId },
  });

  // Pega todos os pdfIds que têm logs
  const allPdfIds = new Set(
    (await prisma.pdfStudyLog.findMany({
      where: { pdf: { topic: { subjectId } } },
      select: { pdfId: true },
    })).map(l => l.pdfId)
  );

  // Sessões sem PDF = sessões cujos dados não estão em nenhum PDF
  // Estratégia: soma das StudySessions - soma dos PDFs = contribuição das sessões sem PDF
  const sessionsStudyHours  = allSessions.reduce((a, s) => a + s.studyHours, 0);
  const sessionsQuestions   = allSessions.reduce((a, s) => a + s.questions, 0);
  const sessionsCorrect     = allSessions.reduce((a, s) => a + s.correct, 0);
  const sessionsWrong       = allSessions.reduce((a, s) => a + s.wrong, 0);

  const pdfsStudyHours      = pdfs.reduce((a, p) => a + p.studyHours, 0);
  const pdfsQuestions       = pdfs.reduce((a, p) => a + p.questions, 0);
  const pdfsCorrect         = pdfs.reduce((a, p) => a + p.correctQuestions, 0);
  const pdfsWrong           = pdfs.reduce((a, p) => a + p.wrongQuestions, 0);

  // Total = PDFs + sessões sem PDF (o que sobra além do que já está nos PDFs)
  const extraHours     = Math.max(0, sessionsStudyHours - pdfsStudyHours);
  const extraQuestions = Math.max(0, sessionsQuestions  - pdfsQuestions);
  const extraCorrect   = Math.max(0, sessionsCorrect    - pdfsCorrect);
  const extraWrong     = Math.max(0, sessionsWrong      - pdfsWrong);

  await prisma.subject.update({
    where: { id: subjectId },
    data: {
      totalPdfs:        pdfs.length,
      completedPdfs:    pdfs.filter(p => p.completed).length,
      studyHours:       pdfsStudyHours + extraHours,
      totalQuestions:   pdfsQuestions  + extraQuestions,
      correctQuestions: pdfsCorrect    + extraCorrect,
      wrongQuestions:   pdfsWrong      + extraWrong,
      progress:         pdfs.length > 0 ? Math.round((pdfs.filter(p => p.completed).length / pdfs.length) * 100) : 0,
      lastStudyAt:      new Date(),
    },
  });
}
