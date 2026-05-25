import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function toBRDate(date: Date): string {
  const br = new Date(date.getTime() - 3 * 60 * 60 * 1000);
  return br.toISOString().slice(0, 10);
}

function formatHours(h: number): string {
  const totalMin = Math.round(h * 60);
  if (totalMin < 60) return `${totalMin}min`;
  const hh = Math.floor(totalMin / 60);
  const mm  = totalMin % 60;
  return mm > 0 ? `${hh}h${mm}min` : `${hh}h`;
}

// Extrai metadata do campo notes (JSON com category, topicName, pdfTitle, comment)
function parseMeta(notes: string | null): { category: string; topicName: string; pdfTitle: string; comment: string } {
  if (!notes) return { category: "", topicName: "", pdfTitle: "", comment: "" };
  try {
    const parsed = JSON.parse(notes);
    return {
      category:  parsed.category  ?? "",
      topicName: parsed.topicName ?? "",
      pdfTitle:  parsed.pdfTitle  ?? "",
      comment:   parsed.comment   ?? "",
    };
  } catch {
    // Campo notes com texto simples (sessões antigas)
    return { category: "", topicName: "", pdfTitle: "", comment: notes };
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json([], { status: 401 });

  const uid = session.user.id as string;

  const sessions = await prisma.studySession.findMany({
    where:   { userId: uid },
    orderBy: { createdAt: "desc" },
    include: { subject: { select: { id: true, name: true } } },
    take:    500,
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
    date:                g.date,
    totalHours:          parseFloat(g.totalHours.toFixed(2)),
    totalHoursFormatted: formatHours(g.totalHours),
    sessions: g.sessions.map(s => {
      const meta = parseMeta(s.notes);
      return {
        id:             s.id,
        subjectId:      s.subjectId,
        subjectName:    s.subject?.name ?? "Sem disciplina",
        hours:          s.studyHours,
        hoursFormatted: formatHours(s.studyHours),
        questions:      s.questions,
        correct:        s.correct,
        wrong:          s.wrong,
        accuracy:       s.questions > 0 ? Math.round((s.correct / s.questions) * 100) : null,
        createdAt:      s.createdAt.toISOString(),
        // Metadata do campo notes
        category:       meta.category,
        topicName:      meta.topicName,
        pdfTitle:       meta.pdfTitle,
        comment:        meta.comment,
      };
    }),
  }));

  return NextResponse.json(result);
}

// PATCH — editar observação de uma sessão
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });

  const { id, comment } = await req.json();
  const existing = await prisma.studySession.findFirst({
    where: { id, userId: session.user.id as string },
  });
  if (!existing) return NextResponse.json({ message: "Não encontrado." }, { status: 404 });

  const meta = parseMeta(existing.notes);
  meta.comment = comment ?? "";

  await prisma.studySession.update({
    where: { id },
    data:  { notes: JSON.stringify(meta) },
  });

  return NextResponse.json({ ok: true });
}

// DELETE — excluir uma sessão
export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ message: "ID obrigatório." }, { status: 400 });

  const existing = await prisma.studySession.findFirst({
    where: { id, userId: session.user.id as string },
  });
  if (!existing) return NextResponse.json({ message: "Não encontrado." }, { status: 404 });

  await prisma.studySession.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
