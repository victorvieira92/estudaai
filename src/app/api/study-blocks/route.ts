import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json([], { status: 401 });

  const blocks = await prisma.studyBlock.findMany({
    where: { userId: session.user.id as string },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  return NextResponse.json(blocks);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });

  const body = await req.json();

  // Suporta salvar array inteiro (upsert completo) ou bloco único
  if (Array.isArray(body)) {
    // Substitui todos os blocos do usuário de uma vez
    await prisma.studyBlock.deleteMany({ where: { userId: session.user.id as string } });
    if (body.length > 0) {
      await prisma.studyBlock.createMany({
        data: body.map((b: any) => ({
          userId: session.user.id as string,
          dayOfWeek: Number(b.dayOfWeek),
          startTime: String(b.startTime),
          endTime: String(b.endTime),
          blockType: String(b.blockType ?? "leitura"),
        })),
      });
    }
    const blocks = await prisma.studyBlock.findMany({
      where: { userId: session.user.id as string },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });
    return NextResponse.json(blocks);
  }

  // Bloco único
  const block = await prisma.studyBlock.create({
    data: {
      userId: session.user.id as string,
      dayOfWeek: Number(body.dayOfWeek),
      startTime: String(body.startTime),
      endTime: String(body.endTime),
      blockType: String(body.blockType ?? "leitura"),
    },
  });
  return NextResponse.json(block);
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
