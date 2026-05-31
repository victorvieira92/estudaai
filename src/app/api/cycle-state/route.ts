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
  if (!state) {
    return NextResponse.json({ currentDayIdx: 0, pendingBlocks: [], lastDate: "", advancedAt: "" });
  }

  // advancedAt é salvo dentro do campo pendingBlocks como objeto wrapper
  // { blocks: [...], advancedAt: "ISO string" }
  let pendingBlocks: any[] = [];
  let advancedAt = "";
  try {
    const parsed = JSON.parse(state.pendingBlocks ?? "[]");
    if (Array.isArray(parsed)) {
      pendingBlocks = parsed;
    } else if (parsed && typeof parsed === "object" && Array.isArray(parsed.blocks)) {
      pendingBlocks = parsed.blocks;
      advancedAt    = parsed.advancedAt ?? "";
    }
  } catch {
    pendingBlocks = [];
  }

  return NextResponse.json({
    currentDayIdx: state.currentDayIdx,
    pendingBlocks,
    lastDate:   state.lastDate ?? "",
    advancedAt,
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const uid = session.user.id as string;

  const body = await req.json();
  const { currentDayIdx, pendingBlocks, lastDate, advancedAt } = body;

  // Salva pendingBlocks + advancedAt juntos no campo JSON
  const pendingPayload = JSON.stringify({
    blocks:     pendingBlocks ?? [],
    advancedAt: advancedAt ?? "",
  });

  await prisma.userCycleState.upsert({
    where:  { userId: uid },
    create: {
      userId:        uid,
      currentDayIdx: currentDayIdx ?? 0,
      pendingBlocks: pendingPayload,
      lastDate:      lastDate ?? "",
    },
    update: {
      currentDayIdx: currentDayIdx ?? 0,
      pendingBlocks: pendingPayload,
      lastDate:      lastDate ?? "",
    },
  });

  return NextResponse.json({ ok: true });
}
