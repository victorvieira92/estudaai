import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });

  const body = await req.json();

  const pdf = await prisma.pdf.findFirst({
    where: { id: params.id, topic: { subject: { userId: session.user.id as string } } },
  });
  if (!pdf) return NextResponse.json({ message: "PDF não encontrado." }, { status: 404 });

  const updated = await prisma.pdf.update({
    where: { id: params.id },
    data: {
      ...(body.title?.trim()          && { title: body.title.trim() }),
      ...(body.totalPages      != null && { totalPages: Number(body.totalPages) }),
      ...(body.lastPageStudied != null && { lastPageStudied: Number(body.lastPageStudied) }),
      ...(body.completed       != null && { completed: Boolean(body.completed) }),
      ...(body.studyHours      != null && { studyHours: Number(body.studyHours) }),
      ...(body.questions       != null && { questions: Number(body.questions) }),
      ...(body.correctQuestions!= null && { correctQuestions: Number(body.correctQuestions) }),
      ...(body.wrongQuestions  != null && { wrongQuestions: Number(body.wrongQuestions) }),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });

  const pdf = await prisma.pdf.findFirst({
    where: { id: params.id, topic: { subject: { userId: session.user.id as string } } },
  });
  if (!pdf) return NextResponse.json({ message: "PDF não encontrado." }, { status: 404 });

  await prisma.pdf.delete({ where: { id: params.id } });

  await prisma.topic.update({
    where: { id: pdf.topicId },
    data: { totalPdfs: { decrement: 1 } },
  });

  return NextResponse.json({ ok: true });
}
