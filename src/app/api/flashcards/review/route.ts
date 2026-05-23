import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type Action = "wrong" | "hard" | "medium" | "easy" | "resolved";

function addDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

function getInterval(action: Action, currentInterval: number): number {
  if (action === "wrong")    return 1;
  if (action === "hard")     return Math.max(1, Math.floor(currentInterval * 1.2));
  if (action === "medium")   return Math.floor(currentInterval * 1.5);
  if (action === "easy")     return currentInterval * 2;
  return 7; // resolved
}

function getDifficulty(action: Action): string {
  if (action === "wrong" || action === "hard") return "Alta";
  if (action === "medium") return "Média";
  return "Baixa";
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });

  const { id, origin, action } = await req.json() as { id: string; origin: "FLASHCARD" | "ERROR_NOTE"; action: Action };

  if (!id || !origin || !action) return NextResponse.json({ message: "Dados incompletos." }, { status: 400 });

  const now = new Date();

  if (origin === "FLASHCARD") {
    const card = await prisma.flashcard.findFirst({ where: { id, userId: session.user.id as string } });
    if (!card) return NextResponse.json({ message: "Card não encontrado." }, { status: 404 });

    const intervalDays = getInterval(action, card.intervalDays);
    await prisma.flashcard.update({
      where: { id },
      data: {
        resolved:       action === "resolved",
        reviewCount:    { increment: 1 },
        wrongCount:     action === "wrong" ? { increment: 1 } : undefined,
        difficulty:     getDifficulty(action),
        intervalDays,
        nextReviewAt:   addDays(intervalDays),
        lastReviewedAt: now,
      },
    });
  }

  if (origin === "ERROR_NOTE") {
    const note = await prisma.errorNote.findFirst({ where: { id, userId: session.user.id as string } });
    if (!note) return NextResponse.json({ message: "Erro não encontrado." }, { status: 404 });

    const intervalDays = getInterval(action, note.intervalDays);
    await prisma.errorNote.update({
      where: { id },
      data: {
        resolved:       action === "resolved",
        reviewCount:    { increment: 1 },
        wrongCount:     action === "wrong" ? { increment: 1 } : undefined,
        difficulty:     getDifficulty(action),
        intervalDays,
        nextReviewAt:   addDays(intervalDays),
        lastReviewedAt: now,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
