import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json([], { status: 401 });

  // ✅ FIX: revisões só aparecem a partir de amanhã (não no mesmo dia que foram criadas)
  // Usa fuso de Brasília (UTC-3)
  const nowBR       = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const todayBRStr  = nowBR.toISOString().slice(0, 10);
  // Fim do dia de hoje em BR = início de amanhã
  const endOfTodayBR = new Date(todayBRStr + "T23:59:59-03:00");

  const reviews = await prisma.review.findMany({
    where: {
      pdf:        { topic: { subject: { userId: session.user.id as string } } },
      // ✅ Só mostra revisões cuja data já passou (estritamente antes de amanhã)
      // Revisão criada hoje com reviewDate = hoje NÃO aparece (< amanhã 00:00)
      reviewDate: { lt: endOfTodayBR },
    },
    orderBy: { reviewDate: "asc" },
    include: {
      pdf: {
        include: { topic: { include: { subject: { select: { name: true } } } } },
      },
    },
  });

  return NextResponse.json(reviews);
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ message: "Não autorizado." }, { status: 401 });

  const { id } = await req.json();
  await prisma.review.update({ where: { id }, data: { completed: true } });
  return NextResponse.json({ ok: true });
}
