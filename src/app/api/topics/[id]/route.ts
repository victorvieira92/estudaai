import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });

  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ message: "Nome inválido." }, { status: 400 });

  // Verifica se o tópico pertence ao usuário
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

  await prisma.topic.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true });
}
