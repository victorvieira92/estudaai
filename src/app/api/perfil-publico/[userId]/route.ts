// src/app/api/perfil-publico/[userId]/route.ts
// Retorna dados públicos de um usuário para a página de compartilhamento
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function toBRDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(date);
}

export async function GET(_: Request, { params }: { params: { userId: string } }) {
  const { userId } = params;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, createdAt: true },
    });
    if (!user) return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });

    const [sessions, subjects, editalTopicos] = await Promise.all([
      prisma.studySession.findMany({ where: { userId } }),
      prisma.subject.findMany({
        where: { userId },
        select: { name: true, editalWeight: true },
      }),
      prisma.editalTopico.findMany({
        where: { userId },
        select: { concluido: true, disciplina: true },
      }),
    ]);

    const totalHours     = sessions.reduce((a, s) => a + s.studyHours, 0);
    const totalQuestions = sessions.reduce((a, s) => a + s.questions, 0);
    const totalCorrect   = sessions.reduce((a, s) => a + s.correct, 0);
    const accuracy       = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : null;

    // Constância (dias estudados)
    const sessionDates = new Set(sessions.map(s => toBRDate(new Date(s.createdAt))));
    const studiedDays  = sessionDates.size;

    // Streak
    const todayDS  = toBRDate(new Date());
    const msPerDay = 86400000;
    let streak = 0;
    let checkTS = sessionDates.has(todayDS) ? Date.now() : Date.now() - msPerDay;
    while (true) {
      const ds = toBRDate(new Date(checkTS));
      if (!sessionDates.has(ds)) break;
      streak++;
      checkTS -= msPerDay;
    }

    // Edital
    const editalConcluidos = editalTopicos.filter(t => t.concluido).length;
    const editalTotal      = editalTopicos.length;

    // Top 3 matérias por horas
    const subjectHours = new Map<string, number>();
    for (const s of sessions) {
      const sub = subjects.find(sub => {
        // aproxima pelo nome — não temos subjectId aqui diretamente
        return true; // pega tudo
      });
      subjectHours.set(s.subjectId, (subjectHours.get(s.subjectId) ?? 0) + s.studyHours);
    }

    // Usa subjectStats por sessão
    const subjectMap = new Map<string, { name: string; hours: number; questions: number; correct: number }>();
    for (const s of sessions) {
      if (!subjectMap.has(s.subjectId)) {
        subjectMap.set(s.subjectId, { name: s.subjectId, hours: 0, questions: 0, correct: 0 });
      }
      const entry = subjectMap.get(s.subjectId)!;
      entry.hours     += s.studyHours;
      entry.questions += s.questions;
      entry.correct   += s.correct;
    }

    // Enriquece com nome real do subject
    const subjectsWithIds = await prisma.subject.findMany({
      where: { userId },
      select: { id: true, name: true },
    });
    const subjectIdToName = new Map(subjectsWithIds.map(s => [s.id, s.name]));

    const topSubjects = Array.from(subjectMap.entries())
      .map(([id, data]) => ({
        name:     subjectIdToName.get(id) ?? "Desconhecido",
        hours:    parseFloat(data.hours.toFixed(1)),
        accuracy: data.questions > 0 ? Math.round((data.correct / data.questions) * 100) : null,
      }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 5);

    return NextResponse.json({
      name:         user.name,
      memberSince:  user.createdAt,
      totalHours:   parseFloat(totalHours.toFixed(1)),
      totalQuestions,
      accuracy,
      studiedDays,
      streak,
      editalConcluidos,
      editalTotal,
      topSubjects,
    });
  } catch (e) {
    console.error("[perfil-publico]", e);
    return NextResponse.json({ error: "Erro interno." }, { status: 500 });
  }
}
