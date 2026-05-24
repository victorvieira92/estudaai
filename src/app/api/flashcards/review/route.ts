import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_INTERVAL = 60;

function nextInterval(action: string, current: number): number {
  const i = Math.max(current, 1);
  switch (action) {
    case "again": return 1;
    case "hard":  return Math.min(Math.round(i * 1.2), MAX_INTERVAL);
    case "good":  return Math.min(Math.round(Math.max(i * 2, i + 1)), MAX_INTERVAL);
    case "easy":  return Math.min(Math.round(Math.max(i * 3.5, i + 4)), MAX_INTERVAL);
    default:      return 1;
  }
}

function calcDifficulty(action: string): string {
  if (action === "again" || action === "hard") return "Alta";
  if (action === "good") return "Média";
  return "Baixa";
}

function addDays(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });

  const { id, origin, action } = await req.json();
  if (!id || !origin || !action) return NextResponse.json({ message: "Dados incompletos." }, { status: 400 });

  const now = new Date();

  if (origin === "FLASHCARD") {
    const card = await prisma.flashcard.findFirst({ where: { id, userId: session.user.id as string } });
    if (!card) return NextResponse.json({ message: "Card não encontrado." }, { status: 404 });
    const intervalDays = nextInterval(action, card.intervalDays);
    await prisma.flashcard.update({
      where: { id },
      data: { reviewCount: { increment: 1 }, wrongCount: action === "again" ? { increment: 1 } : undefined, difficulty: calcDifficulty(action), intervalDays, nextReviewAt: addDays(intervalDays), lastReviewedAt: now },
    });
  }

  if (origin === "ERROR_NOTE") {
    const note = await prisma.errorNote.findFirst({ where: { id, userId: session.user.id as string } });
    if (!note) return NextResponse.json({ message: "Erro não encontrado." }, { status: 404 });
    const intervalDays = nextInterval(action, note.intervalDays);
    await prisma.errorNote.update({
      where: { id },
      data: { reviewCount: { increment: 1 }, wrongCount: action === "again" ? { increment: 1 } : undefined, difficulty: calcDifficulty(action), intervalDays, nextReviewAt: addDays(intervalDays), lastReviewedAt: now },
    });
  }

  return NextResponse.json({ ok: true });
}
