import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json([], { status: 401 });

  const resumos = await prisma.resumo.findMany({
    where: { userId: session.user.id as string },
    include: { subject: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(resumos);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Nao autorizado." }, { status: 401 });

  const { name, url, key, subjectId, size } = await req.json();
  if (!name || !url || !key) return NextResponse.json({ message: "Dados invalidos." }, { status: 400 });

  const resumo = await prisma.resumo.create({
    data: {
      name,
      url,
      key,
      size: size ?? 0,
      subjectId: subjectId || null,
      userId: session.user.id as string,
    },
  });

  return NextResponse.json(resumo);
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Nao autorizado." }, { status: 401 });

  const { id } = await req.json();
  const resumo = await prisma.resumo.findFirst({ where: { id, userId: session.user.id as string } });
  if (!resumo) return NextResponse.json({ message: "Nao encontrado." }, { status: 404 });

  await prisma.resumo.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
