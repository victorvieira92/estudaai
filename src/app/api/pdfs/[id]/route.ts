import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });

  const { title, totalPages } = await req.json();

  const pdf = await prisma.pdf.findFirst({
    where: { id: params.id, topic: { subject: { userId: session.user.id as string } } },
  });
  if (!pdf) return NextResponse.json({ message: "PDF não encontrado." }, { status: 404 });

  const updated = await prisma.pdf.update({
    where: { id: params.id },
    data: {
      ...(title?.trim() && { title: title.trim() }),
      ...(totalPages != null && { totalPages: Number(totalPages) }),
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

  // Atualiza contagem do tópico
  await prisma.topic.update({
    where: { id: pdf.topicId },
    data: { totalPdfs: { decrement: 1 } },
  });

  return NextResponse.json({ ok: true });
}
