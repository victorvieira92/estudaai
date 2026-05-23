import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });

  const { name, editalWeight, criticality } = await req.json();

  const subject = await prisma.subject.findFirst({
    where: { id: params.id, userId: session.user.id as string },
  });
  if (!subject) return NextResponse.json({ message: "Matéria não encontrada." }, { status: 404 });

  const updated = await prisma.subject.update({
    where: { id: params.id },
    data: {
      ...(name?.trim() && { name: name.trim() }),
      ...(editalWeight != null && { editalWeight: Number(editalWeight) }),
      ...(criticality != null && { criticality: Number(criticality) }),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });

  const subject = await prisma.subject.findFirst({
    where: { id: params.id, userId: session.user.id as string },
  });
  if (!subject) return NextResponse.json({ message: "Matéria não encontrada." }, { status: 404 });

  await prisma.subject.delete({ where: { id: params.id } });

  return NextResponse.json({ ok: true });
}
