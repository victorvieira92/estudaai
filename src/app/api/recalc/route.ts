import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Recalcula todos os totais de todas as matérias do usuário
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });

  const subjects = await prisma.subject.findMany({
    where: { userId: session.user.id as string },
    include: { topics: { include: { pdfs: true } } },
  });

  for (const sub of subjects) {
    const pdfs = sub.topics.flatMap(t => t.pdfs);
    await prisma.subject.update({
      where: { id: sub.id },
      data: {
        totalPdfs:        pdfs.length,
        completedPdfs:    pdfs.filter(p => p.completed).length,
        studyHours:       pdfs.reduce((a, p) => a + p.studyHours, 0),
        totalQuestions:   pdfs.reduce((a, p) => a + p.questions, 0),
        correctQuestions: pdfs.reduce((a, p) => a + p.correctQuestions, 0),
        wrongQuestions:   pdfs.reduce((a, p) => a + p.wrongQuestions, 0),
        progress:         pdfs.length > 0 ? Math.round((pdfs.filter(p => p.completed).length / pdfs.length) * 100) : 0,
      },
    });
  }

  return NextResponse.json({ ok: true, recalculated: subjects.length });
}
