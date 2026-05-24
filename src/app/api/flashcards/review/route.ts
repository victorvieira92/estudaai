import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Algoritmo fiel ao Anki SM-2 adaptado para concursos
// Intervalo máximo: 60 dias (concursos precisam de revisões mais frequentes)
const MAX_INTERVAL = 60;

function nextInterval(action: string, currentInterval: number): number {
  switch (action) {
    case "again": return 1;                                                        // Reinicia amanhã
    case "hard":  return Math.min(Math.round(currentInterval * 1.2), MAX_INTERVAL); // Cresce devagar
    case "good":  return Math.min(Math.round(Math.max(currentInterval * 1.5, currentInterval + 1)), MAX_INTERVAL); // Crescimento padrão
    case "easy":  return Math.min(Math.round(Math.max(currentInterval * 2.5, currentInterval + 3)), MAX_INTERVAL); // Cresce rápido
    default:      return 1;
  }
}

function calcDifficulty(action: string): string {
  if (action === "again")         return "Alta";
  if (action === "hard")          return "Alta";
  if (action === "good")          return "Média";
  if (action === "easy")          return "Baixa";
  return "Média";
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

  const { id, origin, action } = await req.json() as { id: string; origin: "FLASHCARD" | "ERROR_NOTE"; action: string };
  if (!id || !origin || !action) return NextResponse.json({ message: "Dados incompletos." }, { status: 400 });

  const now = new Date();

  if (origin === "FLASHCARD") {
    const card = await prisma.flashcard.findFirst({ where: { id, userId: session.user.id as string } });
    if (!card) return NextResponse.json({ message: "Card não encontrado." }, { status: 404 });

    const intervalDays = nextInterval(action, card.intervalDays);

    await prisma.flashcard.update({
      where: { id },
      data: {
        reviewCount:    { increment: 1 },
        wrongCount:     action === "again" ? { increment: 1 } : undefined,
        difficulty:     calcDifficulty(action),
        intervalDays,
        nextReviewAt:   addDays(intervalDays),
        lastReviewedAt: now,
        resolved:       false, // nunca "resolve" automaticamente no modo Anki
      },
    });
  }

  if (origin === "ERROR_NOTE") {
    const note = await prisma.errorNote.findFirst({ where: { id, userId: session.user.id as string } });
    if (!note) return NextResponse.json({ message: "Erro não encontrado." }, { status: 404 });

    const intervalDays = nextInterval(action, note.intervalDays);

    await prisma.errorNote.update({
      where: { id },
      data: {
        reviewCount:    { increment: 1 },
        wrongCount:     action === "again" ? { increment: 1 } : undefined,
        difficulty:     calcDifficulty(action),
        intervalDays,
        nextReviewAt:   addDays(intervalDays),
        lastReviewedAt: now,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
