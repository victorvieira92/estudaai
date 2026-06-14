import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });

  const { id } = params;
  const body = await req.json();

  const note = await prisma.errorNote.findFirst({ where: { id, userId: session.user.id as string } });
  if (!note) return NextResponse.json({ message: "Erro não encontrado." }, { status: 404 });

  const updated = await prisma.errorNote.update({
    where: { id },
    data: {
      title:      body.title      ?? note.title,
      description: body.description ?? note.description,
      hint:       body.hint !== undefined ? (body.hint?.trim() || null) : note.hint,
      topic:      body.topic      ?? note.topic,
      banca:      body.banca      ?? note.banca,
      difficulty: body.difficulty ?? note.difficulty,
      errorType:  body.errorType !== undefined ? (body.errorType || null) : note.errorType,
      subjectId:  body.subjectId  ?? note.subjectId,
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });

  const { id } = params;
  const note = await prisma.errorNote.findFirst({ where: { id, userId: session.user.id as string } });
  if (!note) return NextResponse.json({ message: "Não encontrado." }, { status: 404 });

  await prisma.errorNote.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
