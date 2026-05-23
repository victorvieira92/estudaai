import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });

  const body = await req.json();
  const note = await prisma.errorNote.findFirst({ where: { id: params.id, userId: session.user.id as string } });
  if (!note) return NextResponse.json({ message: "Não encontrado." }, { status: 404 });

  // Edição completa
  if (body.title !== undefined) {
    const updated = await prisma.errorNote.update({
      where: { id: params.id },
      data: {
        title:       body.title?.trim(),
        description: body.description?.trim(),
        topic:       body.topic ?? null,
        banca:       body.banca ?? null,
        difficulty:  body.difficulty ?? note.difficulty,
        errorType:   body.errorType ?? null,
        subjectId:   body.subjectId ?? note.subjectId,
      },
    });
    return NextResponse.json(updated);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });

  const note = await prisma.errorNote.findFirst({ where: { id: params.id, userId: session.user.id as string } });
  if (!note) return NextResponse.json({ message: "Não encontrado." }, { status: 404 });

  await prisma.errorNote.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
