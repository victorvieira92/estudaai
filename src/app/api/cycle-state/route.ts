// src/app/api/cycle-state/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const uid = session.user.id as string;

  const state = await prisma.userCycleState.findUnique({ where: { userId: uid } });
  if (!state) return NextResponse.json({ dayStates: {} });

  let dayStates: Record<string, any> = {};
  try {
    const parsed = JSON.parse(state.pendingBlocks ?? "{}");
    // Novo formato: { dayStates: { "2026-06-02": { manualDone: { blockId: true } } } }
    if (parsed?.dayStates) {
      dayStates = parsed.dayStates;
    }
  } catch { dayStates = {}; }

  return NextResponse.json({ dayStates });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const uid = session.user.id as string;

  const body = await req.json();
  const { dayStates } = body;

  const payload = JSON.stringify({ dayStates: dayStates ?? {} });

  await prisma.userCycleState.upsert({
    where:  { userId: uid },
    create: { userId: uid, currentDayIdx: 0, pendingBlocks: payload, lastDate: "" },
    update: { pendingBlocks: payload },
  });

  return NextResponse.json({ ok: true });
}
