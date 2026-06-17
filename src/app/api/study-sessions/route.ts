import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { safeInt, safeFloat, addDays, startOfTomorrow } from "@/lib/utils";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
  const uid = session.user.id as string;

  try {
    const body = await req.json();
    const subjectId = String(body.subjectId ?? "").trim();
    const topicId   = String(body.topicId   ?? "").trim();
    const pdfId     = String(body.pdfId     ?? "").trim();

    if (!subjectId) return NextResponse.json({ message: "Disciplina obrigatória." }, { status: 400 });

    // Verifica que o subject pertence ao usuário logado
    const subject = await prisma.subject.findFirst({ where: { id: subjectId, userId: uid } });
    if (!subject) return NextResponse.json({ message: "Disciplina não encontrada." }, { status: 404 });

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
      startPage,
      endPage,
    });

    await prisma.$transaction(async (tx) => {
      // 1. Sessão de estudo
      // studyDate: data enviada pelo cliente no formato YYYY-MM-DD (para registros retroativos)
      // Converte para DateTime em UTC-3 (Brasília) às 12:00 para evitar problemas de fuso
      let createdAt: Date | undefined;
      if (body.studyDate && typeof body.studyDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.studyDate)) {
        // Interpreta a data como horário de Brasília (UTC-3), meio-dia
        // Isso garante que toBRDate() sempre vai retornar a data correta
        const [y, m, d] = body.studyDate.split("-").map(Number);
        createdAt = new Date(Date.UTC(y, m - 1, d, 15, 0, 0)); // 15:00 UTC = 12:00 BRT
      }

      await tx.studySession.create({
        data: {
          userId: uid, subjectId, duration, studyHours: hours,
          questions, correct, wrong, notes,
          ...(createdAt ? { createdAt } : {}),
        },
      });

      // 2. PDF (se selecionado — verifica que pertence ao usuário)
      if (pdfId) {
        const pdf = await tx.pdf.findFirst({
          where: { id: pdfId, topic: { subject: { userId: uid } } },
        });
        if (pdf) {
          const finalTotal   = totalPages > 0 ? totalPages : pdf.totalPages;
          const finalLast    = Math.max(pdf.lastPageStudied, endPage);
          const shouldFinish = completed || (finalTotal > 0 && finalLast >= finalTotal);

          await tx.pdfStudyLog.create({
            data: { pdfId, studyHours: hours, questions, correctQuestions: correct, wrongQuestions: wrong, startPage, endPage },
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

          // Revisões espaçadas
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

    await recalcSubjectWithSessions(subjectId, uid);
    if (topicId) await recalcTopic(topicId, uid);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[study-sessions POST]", e);
    return NextResponse.json({ message: "Erro interno.", detail: String(e) }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json([], { status: 401 });
  const uid = session.user.id as string;

  const { searchParams } = new URL(req.url);
  const subjectId = searchParams.get("subjectId");

  const sessions = await prisma.studySession.findMany({
    where: {
      userId: uid,
      ...(subjectId ? { subjectId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take:    200,
    include: { subject: { select: { name: true } } },
  });
  return NextResponse.json(sessions);
}

// Recalc com userId obrigatório — garante isolamento total
async function recalcTopic(topicId: string, uid: string) {
  const topic = await prisma.topic.findFirst({
    where:   { id: topicId, subject: { userId: uid } },
    include: { pdfs: true },
  });
  if (!topic) return;
  const total = topic.pdfs.length;
  const done  = topic.pdfs.filter(p => p.completed).length;
  await prisma.topic.update({
    where: { id: topicId },
    data:  { totalPdfs: total, completedPdfs: done, progress: total > 0 ? Math.round((done / total) * 100) : 0 },
  });
}

async function recalcSubjectWithSessions(subjectId: string, uid: string) {
  const sub = await prisma.subject.findFirst({
    where:   { id: subjectId, userId: uid }, // garante que é do usuário correto
    include: { topics: { include: { pdfs: true } } },
  });
  if (!sub) return;

  const pdfs = sub.topics.flatMap(t => t.pdfs);

  // Só busca sessões deste usuário + desta matéria
  const allSessions = await prisma.studySession.findMany({
    where: { subjectId, userId: uid },
  });

  let extraHours = 0, extraQuestions = 0, extraCorrect = 0, extraWrong = 0;

  for (const s of allSessions) {
    try {
      const parsed = JSON.parse(s.notes ?? "{}");
      if (!parsed.pdfTitle || parsed.pdfTitle.trim() === "") {
        extraHours     += s.studyHours;
        extraQuestions += s.questions;
        extraCorrect   += s.correct;
        extraWrong     += s.wrong;
      }
    } catch {
      extraHours     += s.studyHours;
      extraQuestions += s.questions;
      extraCorrect   += s.correct;
      extraWrong     += s.wrong;
    }
  }

  const pdfsHours    = pdfs.reduce((a, p) => a + p.studyHours, 0);
  const pdfsQ        = pdfs.reduce((a, p) => a + p.questions, 0);
  const pdfsCorrect  = pdfs.reduce((a, p) => a + p.correctQuestions, 0);
  const pdfsWrong    = pdfs.reduce((a, p) => a + p.wrongQuestions, 0);

  await prisma.subject.update({
    where: { id: subjectId },
    data: {
      totalPdfs:        pdfs.length,
      completedPdfs:    pdfs.filter(p => p.completed).length,
      studyHours:       pdfsHours   + extraHours,
      totalQuestions:   pdfsQ       + extraQuestions,
      correctQuestions: pdfsCorrect + extraCorrect,
      wrongQuestions:   pdfsWrong   + extraWrong,
      progress:         pdfs.length > 0 ? Math.round((pdfs.filter(p => p.completed).length / pdfs.length) * 100) : 0,
      lastStudyAt:      new Date(),
    },
  });
}
