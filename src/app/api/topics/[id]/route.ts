import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function recalcSubject(subjectId: string) {
  const sub = await prisma.subject.findUnique({
    where: { id: subjectId },
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
      progress:         pdfs.length > 0 ? Math.round((pdfs.filter(p => p.completed).length / pdfs.length) * 100) : 0,
    },
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });

  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ message: "Nome inválido." }, { status: 400 });

  const topic = await prisma.topic.findFirst({
    where: { id: params.id, subject: { userId: session.user.id as string } },
  });
  if (!topic) return NextResponse.json({ message: "Tópico não encontrado." }, { status: 404 });

  const updated = await prisma.topic.update({
    where: { id: params.id },
    data: { name: name.trim() },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });

  const topic = await prisma.topic.findFirst({
    where: { id: params.id, subject: { userId: session.user.id as string } },
  });
  if (!topic) return NextResponse.json({ message: "Tópico não encontrado." }, { status: 404 });

  const subjectId = topic.subjectId;

  await prisma.topic.delete({ where: { id: params.id } });

  // Recalcula totais da matéria após deletar o tópico
  await recalcSubject(subjectId);

  return NextResponse.json({ ok: true });
}
