// src/app/api/cycle-state/route.ts
// Lê e salva o estado do ciclo de estudos no banco — sincroniza entre dispositivos
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const uid = session.user.id as string;

  const state = await prisma.userCycleState.findUnique({ where: { userId: uid } });
  if (!state) {
    return NextResponse.json({ currentDayIdx: 0, pendingBlocks: [], lastDate: "" });
  }
  return NextResponse.json({
    currentDayIdx: state.currentDayIdx,
    pendingBlocks: JSON.parse(state.pendingBlocks ?? "[]"),
    lastDate:      state.lastDate ?? "",
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const uid = session.user.id as string;

  const body = await req.json();
  const { currentDayIdx, pendingBlocks, lastDate } = body;

  await prisma.userCycleState.upsert({
    where:  { userId: uid },
    create: {
      userId:        uid,
      currentDayIdx: currentDayIdx ?? 0,
      pendingBlocks: JSON.stringify(pendingBlocks ?? []),
      lastDate:      lastDate ?? "",
    },
    update: {
      currentDayIdx: currentDayIdx ?? 0,
      pendingBlocks: JSON.stringify(pendingBlocks ?? []),
      lastDate:      lastDate ?? "",
    },
  });

  return NextResponse.json({ ok: true });
}
