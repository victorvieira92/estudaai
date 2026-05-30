import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addDays, startOfToday } from "@/lib/utils";

// Intervalos de spaced repetition (em dias)
// Acertos consecutivos: 1 → 7 → 30 → 90 (máximo)
const NEXT_INTERVAL: Record<number, number> = {
  1:  7,
  7:  30,
  30: 90,
};
function nextInterval(current: number): number {
  return NEXT_INTERVAL[current] ?? 90;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json([], { status: 401 });

  const notes = await prisma.errorNote.findMany({
    where: { userId: session.user.id as string },
    orderBy: { createdAt: "desc" },
    include: { subject: { select: { name: true } } },
  });

  const today = startOfToday();

  // "Pendente" = nextReviewAt já chegou (ou nunca foi definido)
  // "Resolvido" = nextReviewAt ainda está no futuro
  return NextResponse.json(notes.map(n => ({
    ...n,
    pending: !n.nextReviewAt || n.nextReviewAt <= today,
    nextReviewAt: n.nextReviewAt,
  })));
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });

  const { title, description, subjectId, topic, banca, difficulty = "Media", errorType } = await req.json();
  if (!title?.trim() || !description?.trim() || !subjectId)
    return NextResponse.json({ message: "Dados inválidos." }, { status: 400 });

  const today = startOfToday();
  const note = await prisma.errorNote.create({
    data: {
      title: title.trim(),
      description: description.trim(),
      subjectId,
      topic,
      banca,
      difficulty,
      errorType: errorType ?? null,
      userId: session.user.id as string,
      intervalDays: 1,
      nextReviewAt: addDays(today, 1), // aparece pendente amanhã
      resolved: false,
    },
  });
  return NextResponse.json(note);
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });

  const { id, action } = await req.json();
  const note = await prisma.errorNote.findFirst({ where: { id, userId: session.user.id as string } });
  if (!note) return NextResponse.json({ message: "Erro não encontrado." }, { status: 404 });

  const today = startOfToday();

  if (action === "correct") {
    // Acertei → avança o intervalo (spaced repetition)
    const newInterval = nextInterval(note.intervalDays);
    await prisma.errorNote.update({
      where: { id },
      data: {
        reviewCount:    { increment: 1 },
        intervalDays:   newInterval,
        lastReviewedAt: new Date(),
        nextReviewAt:   addDays(today, newInterval),
        resolved:       true,
      },
    });
  } else if (action === "wrong") {
    // Errei → volta amanhã, intervalo reseta para 1
    await prisma.errorNote.update({
      where: { id },
      data: {
        wrongCount:     { increment: 1 },
        reviewCount:    { increment: 1 },
        intervalDays:   1,
        lastReviewedAt: new Date(),
        nextReviewAt:   addDays(today, 1),
        resolved:       true,
      },
    });
  }

  return NextResponse.json({ ok: true });
}
