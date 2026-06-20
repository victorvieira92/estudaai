import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/competicao
// Compara o usuário logado com o agregado de TODOS os outros usuários cadastrados.
// Matérias são casadas por nome (normalizado), já que cada usuário tem seus próprios registros.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
  const myId = session.user.id as string;

  const users = await prisma.user.findMany({
    select: {
      id: true,
      subjects: {
        select: {
          name: true, studyHours: true,
          totalQuestions: true, correctQuestions: true, wrongQuestions: true,
        },
      },
    },
  });

  const norm = (s: string) => s.trim().toLowerCase();
  const otherUsersCount = users.filter(u => u.id !== myId).length;

  // Agrega por nome de matéria: "you" = só o usuário logado, "others" = soma de todos os outros
  const subjectMap: Record<string, {
    name: string;
    you:    { hours: number; questions: number; correct: number; wrong: number };
    others: { hours: number; questions: number; correct: number; wrong: number };
  }> = {};

  for (const user of users) {
    const isMe = user.id === myId;
    for (const subj of user.subjects) {
      const key = norm(subj.name);
      if (!subjectMap[key]) {
        subjectMap[key] = {
          name: subj.name,
          you:    { hours: 0, questions: 0, correct: 0, wrong: 0 },
          others: { hours: 0, questions: 0, correct: 0, wrong: 0 },
        };
      }
      const target = isMe ? subjectMap[key].you : subjectMap[key].others;
      target.hours     += subj.studyHours;
      target.questions += subj.totalQuestions;
      target.correct   += subj.correctQuestions;
      target.wrong      += subj.wrongQuestions;
    }
  }

  const subjects = Object.values(subjectMap)
    .map(s => ({
      name: s.name,
      you: {
        hours: parseFloat(s.you.hours.toFixed(1)), questions: s.you.questions, correct: s.you.correct, wrong: s.you.wrong,
        accuracy: s.you.questions > 0 ? Math.round((s.you.correct / s.you.questions) * 100) : null,
      },
      others: {
        hours: parseFloat(s.others.hours.toFixed(1)), questions: s.others.questions, correct: s.others.correct, wrong: s.others.wrong,
        accuracy: s.others.questions > 0 ? Math.round((s.others.correct / s.others.questions) * 100) : null,
      },
    }))
    .filter(s => s.you.questions > 0 || s.others.questions > 0)
    .sort((a, b) => (b.you.questions + b.others.questions) - (a.you.questions + a.others.questions));

  return NextResponse.json({
    otherUsersCount,
    subjects,
  });
}
