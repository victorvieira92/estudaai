import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });

  const { name, subjectId } = await req.json();
  if (!name?.trim() || !subjectId) return NextResponse.json({ message: "Dados inválidos." }, { status: 400 });

  const subject = await prisma.subject.findFirst({ where: { id: subjectId, userId: session.user.id as string } });
  if (!subject) return NextResponse.json({ message: "Matéria não encontrada." }, { status: 404 });

  const topic = await prisma.topic.create({ data: { name: name.trim(), subjectId } });
  return NextResponse.json(topic);
}
