import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Recalcula PDF e Subject — só opera em dados já validados pelo caller
async function recalcPdf(pdfId: string, uid: string) {
  const logs = await prisma.pdfStudyLog.findMany({ where: { pdfId } });
  const pdf  = await prisma.pdf.findFirst({
    where:   { id: pdfId, topic: { subject: { userId: uid } } },
    include: { topic: { include: { subject: { include: { topics: { include: { pdfs: true } } } } } } },
  });
  if (!pdf) return;

  const questions        = logs.reduce((a, l) => a + l.questions, 0);
  const correctQuestions = logs.reduce((a, l) => a + l.correctQuestions, 0);
  const wrongQuestions   = Math.max(0, questions - correctQuestions);
  const studyHours       = logs.reduce((a, l) => a + l.studyHours, 0);
  const lastPageStudied  = logs.length > 0 ? Math.max(...logs.map(l => l.endPage)) : 0;

  await prisma.pdf.update({
    where: { id: pdfId },
    data:  { questions, correctQuestions, wrongQuestions, studyHours, lastPageStudied },
  });

  // Recalcula subject — usa apenas PDFs desse subject (sem cruzar usuários)
  const sub  = pdf.topic.subject;
  const pdfs = sub.topics.flatMap(t => t.pdfs);

  // Busca PDFs atualizados (o update acima ainda não refletiu na memória)
  const freshPdfs = await prisma.pdf.findMany({
    where: { topic: { subjectId: sub.id } },
  });

  await prisma.subject.update({
    where: { id: sub.id },
    data: {
      totalQuestions:   freshPdfs.reduce((a, p) => a + p.questions, 0),
      correctQuestions: freshPdfs.reduce((a, p) => a + p.correctQuestions, 0),
      wrongQuestions:   freshPdfs.reduce((a, p) => a + p.wrongQuestions, 0),
      studyHours:       freshPdfs.reduce((a, p) => a + p.studyHours, 0),
      completedPdfs:    freshPdfs.filter(p => p.completed).length,
      totalPdfs:        freshPdfs.length,
      progress:         freshPdfs.length > 0
        ? Math.round((freshPdfs.filter(p => p.completed).length / freshPdfs.length) * 100)
        : 0,
    },
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
  const uid = session.user.id as string;

  const body = await req.json();

  // Verifica posse: o log deve pertencer a um PDF do usuário logado
  const log = await prisma.pdfStudyLog.findFirst({
    where: { id: params.id, pdf: { topic: { subject: { userId: uid } } } },
  });
  if (!log) return NextResponse.json({ message: "Log não encontrado." }, { status: 404 });

  const questions        = body.questions        != null ? Number(body.questions)        : log.questions;
  const correctQuestions = body.correctQuestions != null ? Number(body.correctQuestions) : log.correctQuestions;
  const wrongQuestions   = Math.max(0, questions - correctQuestions);

  const updated = await prisma.pdfStudyLog.update({
    where: { id: params.id },
    data: {
      ...(body.studyHours != null && { studyHours: Number(body.studyHours) }),
      ...(body.startPage  != null && { startPage:  Number(body.startPage)  }),
      ...(body.endPage    != null && { endPage:    Number(body.endPage)    }),
      questions,
      correctQuestions,
      wrongQuestions,
    },
  });

  await recalcPdf(log.pdfId, uid);

  return NextResponse.json(updated);
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
  const uid = session.user.id as string;

  // Verifica posse antes de deletar
  const log = await prisma.pdfStudyLog.findFirst({
    where: { id: params.id, pdf: { topic: { subject: { userId: uid } } } },
  });
  if (!log) return NextResponse.json({ message: "Log não encontrado." }, { status: 404 });

  await prisma.pdfStudyLog.delete({ where: { id: params.id } });
  await recalcPdf(log.pdfId, uid);

  return NextResponse.json({ ok: true });
}
