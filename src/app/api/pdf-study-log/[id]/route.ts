import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function recalcPdf(pdfId: string) {
  const logs = await prisma.pdfStudyLog.findMany({ where: { pdfId } });
  const pdf = await prisma.pdf.findUnique({
    where: { id: pdfId },
    include: { topic: { include: { subject: true } } },
  });
  if (!pdf) return;

  const questions        = logs.reduce((a, l) => a + l.questions, 0);
  const correctQuestions = logs.reduce((a, l) => a + l.correctQuestions, 0);
  const wrongQuestions   = logs.reduce((a, l) => a + l.wrongQuestions, 0); // ← soma real dos erros
  const studyHours       = logs.reduce((a, l) => a + l.studyHours, 0);
  const lastPageStudied  = logs.length > 0 ? Math.max(...logs.map(l => l.endPage)) : 0;

  await prisma.pdf.update({
    where: { id: pdfId },
    data: { questions, correctQuestions, wrongQuestions, studyHours, lastPageStudied },
  });

  // Recalcula matéria com os PDFs já atualizados
  const sub = await prisma.subject.findUnique({
    where: { id: pdf.topic.subject.id },
    include: { topics: { include: { pdfs: true } } },
  });
  if (!sub) return;
  const pdfs = sub.topics.flatMap(t => t.pdfs);

  // Usa os valores recém-calculados para o PDF atual
  const updatedPdfs = pdfs.map(p =>
    p.id === pdfId
      ? { ...p, questions, correctQuestions, wrongQuestions, studyHours }
      : p
  );

  await prisma.subject.update({
    where: { id: sub.id },
    data: {
      totalQuestions:   updatedPdfs.reduce((a, p) => a + p.questions, 0),
      correctQuestions: updatedPdfs.reduce((a, p) => a + p.correctQuestions, 0),
      wrongQuestions:   updatedPdfs.reduce((a, p) => a + p.wrongQuestions, 0),
      studyHours:       updatedPdfs.reduce((a, p) => a + p.studyHours, 0),
      completedPdfs:    updatedPdfs.filter(p => p.completed).length,
      progress:         updatedPdfs.length > 0
        ? Math.round((updatedPdfs.filter(p => p.completed).length / updatedPdfs.length) * 100)
        : 0,
    },
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });

  const body = await req.json();

  const log = await prisma.pdfStudyLog.findFirst({
    where: { id: params.id, pdf: { topic: { subject: { userId: session.user.id as string } } } },
  });
  if (!log) return NextResponse.json({ message: "Log não encontrado." }, { status: 404 });

  const questions        = body.questions        != null ? Number(body.questions)        : log.questions;
  const correctQuestions = body.correctQuestions != null ? Number(body.correctQuestions) : log.correctQuestions;
  // Usa wrongQuestions do body se fornecido; senão calcula como diferença
  const wrongQuestions   = body.wrongQuestions   != null
    ? Number(body.wrongQuestions)
    : Math.max(0, questions - correctQuestions);

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

  await recalcPdf(log.pdfId);

  return NextResponse.json(updated);
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });

  const log = await prisma.pdfStudyLog.findFirst({
    where: { id: params.id, pdf: { topic: { subject: { userId: session.user.id as string } } } },
  });
  if (!log) return NextResponse.json({ message: "Log não encontrado." }, { status: 404 });

  await prisma.pdfStudyLog.delete({ where: { id: params.id } });
  await recalcPdf(log.pdfId);

  return NextResponse.json({ ok: true });
}
