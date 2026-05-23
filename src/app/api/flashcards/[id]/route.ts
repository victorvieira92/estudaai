import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });

  const body = await req.json();
  const card = await prisma.flashcard.findFirst({ where: { id: params.id, userId: session.user.id as string } });
  if (!card) return NextResponse.json({ message: "Não encontrado." }, { status: 404 });

  const updated = await prisma.flashcard.update({
    where: { id: params.id },
    data: {
      question:  body.question?.trim() ?? card.question,
      answer:    body.answer?.trim()   ?? card.answer,
      topic:     body.topic  ?? card.topic,
      banca:     body.banca  ?? card.banca,
      subjectId: body.subjectId ?? card.subjectId,
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });

  const card = await prisma.flashcard.findFirst({ where: { id: params.id, userId: session.user.id as string } });
  if (!card) return NextResponse.json({ message: "Não encontrado." }, { status: 404 });

  await prisma.flashcard.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
