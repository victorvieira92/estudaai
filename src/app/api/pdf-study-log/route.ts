import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json([], { status: 401 });
  const uid = session.user.id as string;

  const { searchParams } = new URL(req.url);
  const pdfId = searchParams.get("pdfId");
  if (!pdfId) return NextResponse.json([], { status: 400 });

  // Verifica posse do PDF antes de retornar os logs
  const pdf = await prisma.pdf.findFirst({
    where: { id: pdfId, topic: { subject: { userId: uid } } },
  });
  if (!pdf) return NextResponse.json([], { status: 404 });

  const logs = await prisma.pdfStudyLog.findMany({
    where:   { pdfId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(logs);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
  const uid = session.user.id as string;

  try {
    const body = await req.json();
    const { pdfId, studyHours, questions, correctQuestions, wrongQuestions } = body;

    if (!pdfId || typeof pdfId !== "string")
      return NextResponse.json({ message: "pdfId obrigatório." }, { status: 400 });

    // Verifica posse do PDF
    const pdf = await prisma.pdf.findFirst({
      where:   { id: pdfId, topic: { subject: { userId: uid } } },
      include: { topic: { include: { subject: true } } },
    });
    if (!pdf) return NextResponse.json({ message: "PDF não encontrado." }, { status: 404 });

    // Sanitiza e valida valores numéricos
    const sHours    = Math.max(0, parseFloat(String(studyHours))    || 0);
    const sQ        = Math.max(0, parseInt(String(questions))       || 0);
    const sCorrect  = Math.max(0, parseInt(String(correctQuestions)) || 0);
    const sWrong    = Math.max(0, parseInt(String(wrongQuestions))   || 0);

    if (sHours > 24)
      return NextResponse.json({ message: "Horas inválidas." }, { status: 400 });

    await prisma.$transaction(async (tx) => {
      // Cria o log
      await tx.pdfStudyLog.create({
        data: { pdfId, studyHours: sHours, questions: sQ, correctQuestions: sCorrect, wrongQuestions: sWrong, startPage: 0, endPage: 0 },
      });

      // Recalcula o PDF somando todos os logs (fonte da verdade)
      const logs = await tx.pdfStudyLog.findMany({ where: { pdfId } });
      await tx.pdf.update({
        where: { id: pdfId },
        data: {
          studyHours:       logs.reduce((a, l) => a + l.studyHours, 0),
          questions:        logs.reduce((a, l) => a + l.questions, 0),
          correctQuestions: logs.reduce((a, l) => a + l.correctQuestions, 0),
          wrongQuestions:   logs.reduce((a, l) => a + l.wrongQuestions, 0),
        },
      });

      // Recalcula o Subject somando todos os PDFs atualizados
      const freshPdfs = await tx.pdf.findMany({
        where: { topic: { subjectId: pdf.topic.subject.id } },
      });
      await tx.subject.update({
        where: { id: pdf.topic.subject.id },
        data: {
          studyHours:       freshPdfs.reduce((a, p) => a + p.studyHours, 0),
          totalQuestions:   freshPdfs.reduce((a, p) => a + p.questions, 0),
          correctQuestions: freshPdfs.reduce((a, p) => a + p.correctQuestions, 0),
          wrongQuestions:   freshPdfs.reduce((a, p) => a + p.wrongQuestions, 0),
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[pdf-study-log POST]", e);
    return NextResponse.json({ message: "Erro interno.", detail: String(e) }, { status: 500 });
  }
}
