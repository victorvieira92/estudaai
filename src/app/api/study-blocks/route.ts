import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json([], { status: 401 });

  const blocks = await prisma.studyBlock.findMany({
    where: { userId: session.user.id as string },
    include: { subject: { select: { id: true, name: true } } },
    orderBy: [{ dayOfWeek: "asc" }, { hours: "desc" }],
  });

  return NextResponse.json(blocks);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });

  const body = await req.json();

  if (!Array.isArray(body)) {
    return NextResponse.json({ message: "Envie um array de blocos." }, { status: 400 });
  }

  // Substitui todos os blocos do usuário
  await prisma.studyBlock.deleteMany({ where: { userId: session.user.id as string } });

  if (body.length > 0) {
    await prisma.studyBlock.createMany({
      data: body.map((b: any) => ({
        userId: session.user.id as string,
        dayOfWeek: Number(b.dayOfWeek),
        hours: parseFloat(b.hours) || 1,
        subjectId: b.subjectId || null,
        blockType: String(b.blockType ?? "leitura"),
        startTime: b.startTime || null,
        endTime: b.endTime || null,
      })),
    });
  }

  const blocks = await prisma.studyBlock.findMany({
    where: { userId: session.user.id as string },
    include: { subject: { select: { id: true, name: true } } },
    orderBy: [{ dayOfWeek: "asc" }, { hours: "desc" }],
  });

  return NextResponse.json(blocks);
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });

  const { id } = await req.json();
  await prisma.studyBlock.delete({
    where: { id: String(id), userId: session.user.id as string },
  });
  return NextResponse.json({ ok: true });
}
