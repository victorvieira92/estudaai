// src/app/api/fix-cycle/route.ts
// ROTA TEMPORÁRIA — deletar após usar
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const uid = session.user.id as string;

  const state = await prisma.userCycleState.findUnique({ where: { userId: uid } });
  if (!state) return NextResponse.json({ error: "Nenhum estado encontrado." }, { status: 404 });

  // 21h00 BRT = 00h00 UTC do dia seguinte (BRT = UTC-3)
  const advancedAt = "2026-05-31T00:30:00.000Z"; // 21h00 BRT de 30/05

  // Lê os blocos atuais
  let blocks: any[] = [];
  try {
    const parsed = JSON.parse(state.pendingBlocks ?? "[]");
    blocks = Array.isArray(parsed) ? parsed : (parsed.blocks ?? []);
  } catch { blocks = []; }

  const newPayload = JSON.stringify({ blocks, advancedAt });

  await prisma.userCycleState.update({
    where: { userId: uid },
    data:  { pendingBlocks: newPayload },
  });

  return NextResponse.json({ ok: true, advancedAt, blocks });
}
