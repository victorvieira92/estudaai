import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });

  const { title, topicId, totalPages = 0 } = await req.json();
  if (!title?.trim() || !topicId) return NextResponse.json({ message: "Dados inválidos." }, { status: 400 });

  const pdf = await prisma.pdf.create({ data: { title: title.trim(), topicId, totalPages } });

  await prisma.topic.update({ where: { id: topicId }, data: { totalPdfs: { increment: 1 } } });

  return NextResponse.json(pdf);
}
