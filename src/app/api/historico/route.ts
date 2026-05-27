import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function toBRDate(date: Date): string {
  const br = new Date(date.getTime() - 3 * 60 * 60 * 1000);
  return br.toISOString().slice(0, 10);
}

function parseMeta(notes: string | null) {
  if (!notes) return { category: "", topicName: "", pdfTitle: "", comment: "" };
  try {
    const p = JSON.parse(notes);
    return {
      category:  p.category  ?? "",
      topicName: p.topicName ?? "",
      pdfTitle:  p.pdfTitle  ?? "",
      comment:   p.comment   ?? "",
    };
  } catch {
    return { category: "", topicName: "", pdfTitle: "", comment: notes };
  }
}

function fmtHours(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return mm > 0 ? `${hh}h${mm.toString().padStart(2,"0")}min` : `${hh}h`;
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json([], { status: 401 });
  const uid = session.user.id as string;

  const sessions = await prisma.studySession.findMany({
    where:   { userId: uid }, // ← isolamento garantido
    orderBy: { createdAt: "desc" },
    include: { subject: { select: { name: true } } },
  });

  const grouped = new Map<string, { date: string; sessions: typeof sessions; totalHours: number }>();

  for (const s of sessions) {
    const ds = toBRDate(new Date(s.createdAt));
    if (!grouped.has(ds)) grouped.set(ds, { date: ds, sessions: [], totalHours: 0 });
    const g = grouped.get(ds)!;
    g.sessions.push(s);
    g.totalHours += s.studyHours;
  }

  const result = Array.from(grouped.values()).map(g => ({
    date:       g.date,
    totalHours: g.totalHours,
    sessions:   g.sessions.map(s => {
      const meta = parseMeta(s.notes);
      return {
        id:             s.id,
        subjectId:      s.subjectId,
        subjectName:    s.subject?.name ?? "Sem disciplina",
        hours:          s.studyHours,
        hoursFormatted: fmtHours(s.studyHours),
        questions:      s.questions,
        correct:        s.correct,
        wrong:          s.wrong,
        accuracy:       s.questions > 0
          ? Math.round((s.correct / s.questions) * 100)
          : null,
        createdAt:      s.createdAt,
        category:       meta.category,
        topicName:      meta.topicName,
        pdfTitle:       meta.pdfTitle,
        comment:        meta.comment,
      };
    }),
  }));

  return NextResponse.json(result);
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
  const uid = session.user.id as string;

  const body = await req.json();
  const { id, category, topicName, pdfTitle, comment, hours, correct, wrong } = body;

  // Verifica posse — só edita se for do usuário logado
  const existing = await prisma.studySession.findFirst({
    where: { id, userId: uid },
  });
  if (!existing) return NextResponse.json({ message: "Sessão não encontrada." }, { status: 404 });

  const meta = parseMeta(existing.notes);
  if (category  !== undefined) meta.category  = category;
  if (topicName !== undefined) meta.topicName = topicName;
  if (pdfTitle  !== undefined) meta.pdfTitle  = pdfTitle;
  if (comment   !== undefined) meta.comment   = comment;

  const updateData: Record<string, unknown> = { notes: JSON.stringify(meta) };
  if (hours   != null) updateData.studyHours = Number(hours);
  if (correct != null) updateData.correct    = Number(correct);
  if (wrong   != null) updateData.wrong      = Number(wrong);
  if (correct != null || wrong != null) {
    updateData.questions = (Number(correct) || existing.correct) + (Number(wrong) || existing.wrong);
  }

  const updated = await prisma.studySession.update({ where: { id }, data: updateData });
  return NextResponse.json(updated);
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
  const uid = session.user.id as string;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ message: "ID obrigatório." }, { status: 400 });

  // Verifica posse — só deleta se for do usuário logado
  const existing = await prisma.studySession.findFirst({
    where: { id, userId: uid },
  });
  if (!existing) return NextResponse.json({ message: "Sessão não encontrada." }, { status: 404 });

  await prisma.studySession.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
