import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json([], { status: 401 });

  const { searchParams } = new URL(req.url);
  const pdfId = searchParams.get("pdfId");
  if (!pdfId) return NextResponse.json([], { status: 400 });

  const pdf = await prisma.pdf.findFirst({
    where: { id: pdfId, topic: { subject: { userId: session.user.id as string } } },
  });
  if (!pdf) return NextResponse.json([], { status: 404 });

  const logs = await prisma.pdfStudyLog.findMany({
    where: { pdfId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(logs);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });

  const body = await req.json();
  const { pdfId, studyHours, questions, correctQuestions, wrongQuestions } = body;
  if (!pdfId) return NextResponse.json({ message: "pdfId obrigatório." }, { status: 400 });

  const pdf = await prisma.pdf.findFirst({
    where: { id: pdfId, topic: { subject: { userId: session.user.id as string } } },
    include: { topic: { include: { subject: true } } },
  });
  if (!pdf) return NextResponse.json({ message: "PDF não encontrado." }, { status: 404 });

  const log = await prisma.pdfStudyLog.create({
    data: {
      pdfId,
      studyHours:       Number(studyHours)       || 0,
      questions:        Number(questions)         || 0,
      correctQuestions: Number(correctQuestions)  || 0,
      wrongQuestions:   Number(wrongQuestions)    || 0,
      startPage: 0,
      endPage:   0,
    },
  });

  // Recalcula PDF somando todos os logs (incluindo o recém-criado)
  const logs = await prisma.pdfStudyLog.findMany({ where: { pdfId } });
  const newStudyHours       = logs.reduce((a, l) => a + l.studyHours, 0);
  const newQuestions        = logs.reduce((a, l) => a + l.questions, 0);
  const newCorrectQuestions = logs.reduce((a, l) => a + l.correctQuestions, 0);
  const newWrongQuestions   = logs.reduce((a, l) => a + l.wrongQuestions, 0); // ← soma real

  await prisma.pdf.update({
    where: { id: pdfId },
    data: {
      studyHours:       newStudyHours,
      questions:        newQuestions,
      correctQuestions: newCorrectQuestions,
      wrongQuestions:   newWrongQuestions,
    },
  });

  // Recalcula matéria usando os valores atualizados do PDF atual
  const sub = await prisma.subject.findUnique({
    where: { id: pdf.topic.subject.id },
    include: { topics: { include: { pdfs: true } } },
  });
  if (sub) {
    const pdfs = sub.topics.flatMap(t => t.pdfs);
    const updatedPdfs = pdfs.map(p =>
      p.id === pdfId
        ? { ...p, studyHours: newStudyHours, questions: newQuestions, correctQuestions: newCorrectQuestions, wrongQuestions: newWrongQuestions }
        : p
    );
    await prisma.subject.update({
      where: { id: sub.id },
      data: {
        studyHours:       updatedPdfs.reduce((a, p) => a + p.studyHours, 0),
        totalQuestions:   updatedPdfs.reduce((a, p) => a + p.questions, 0),
        correctQuestions: updatedPdfs.reduce((a, p) => a + p.correctQuestions, 0),
        wrongQuestions:   updatedPdfs.reduce((a, p) => a + p.wrongQuestions, 0),
      },
    });
  }

  return NextResponse.json(log);
}
