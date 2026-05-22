import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addDays, startOfToday } from "@/lib/utils";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json([], { status: 401 });

  const cards = await prisma.flashcard.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { subject: { select: { name: true } } },
  });
  return NextResponse.json(cards);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });

  const { question, answer, subjectId, topic, banca, difficulty = "Media" } = await req.json();
  if (!question?.trim() || !answer?.trim() || !subjectId)
    return NextResponse.json({ message: "Dados inválidos." }, { status: 400 });

  const today = startOfToday();
  const card = await prisma.flashcard.create({
    data: { question: question.trim(), answer: answer.trim(), subjectId, topic, banca, difficulty, userId: session.user.id, nextReviewAt: addDays(today, 1) },
  });
  return NextResponse.json(card);
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });

  const { id, result } = await req.json(); // result: "easy"|"medium"|"hard"|"wrong"
  const card = await prisma.flashcard.findFirst({ where: { id, userId: session.user.id } });
  if (!card) return NextResponse.json({ message: "Card não encontrado." }, { status: 404 });

  const intervalMap: Record<string, number> = { easy: card.intervalDays * 2, medium: card.intervalDays, hard: Math.max(1, Math.floor(card.intervalDays / 2)), wrong: 1 };
  const newInterval = intervalMap[result] ?? 1;
  const wrong = result === "wrong" ? card.wrongCount + 1 : card.wrongCount;

  await prisma.flashcard.update({
    where: { id },
    data: { intervalDays: newInterval, reviewCount: { increment: 1 }, wrongCount: wrong, lastReviewedAt: new Date(), nextReviewAt: addDays(startOfToday(), newInterval) },
  });
  return NextResponse.json({ ok: true });
}
