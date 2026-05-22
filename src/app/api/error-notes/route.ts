import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addDays, startOfToday } from "@/lib/utils";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json([], { status: 401 });

  const notes = await prisma.errorNote.findMany({
    where: { userId: session.user.id as string },
    orderBy: { createdAt: "desc" },
    include: { subject: { select: { name: true } } },
  });
  return NextResponse.json(notes);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });

  const { title, description, subjectId, topic, banca, difficulty = "Media" } = await req.json();
  if (!title?.trim() || !description?.trim() || !subjectId)
    return NextResponse.json({ message: "Dados inválidos." }, { status: 400 });

  const today = startOfToday();
  const note = await prisma.errorNote.create({
    data: { title: title.trim(), description: description.trim(), subjectId, topic, banca, difficulty, userId: session.user.id as string, nextReviewAt: addDays(today, 1) },
  });
  return NextResponse.json(note);
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });

  const { id, action } = await req.json(); // action: "resolve"|"review"|"wrong"
  const note = await prisma.errorNote.findFirst({ where: { id, userId: session.user.id as string } });
  if (!note) return NextResponse.json({ message: "Erro não encontrado." }, { status: 404 });

  if (action === "resolve") {
    await prisma.errorNote.update({ where: { id }, data: { resolved: true } });
  } else if (action === "review") {
    const newInterval = note.intervalDays * 2;
    await prisma.errorNote.update({ where: { id }, data: { reviewCount: { increment: 1 }, intervalDays: newInterval, lastReviewedAt: new Date(), nextReviewAt: addDays(startOfToday(), newInterval) } });
  } else if (action === "wrong") {
    await prisma.errorNote.update({ where: { id }, data: { wrongCount: { increment: 1 }, reviewCount: { increment: 1 }, intervalDays: 1, lastReviewedAt: new Date(), nextReviewAt: addDays(startOfToday(), 1) } });
  }
  return NextResponse.json({ ok: true });
}
