import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/competicao
// Compara o usuário logado com o agregado de TODOS os outros usuários cadastrados.
// Matérias são casadas por nome (normalizado), já que cada usuário tem seus próprios registros.
// Fonte de verdade: StudySession (igual Histórico/Matérias) — não os campos agregados em
// Subject (totalQuestions/correctQuestions/wrongQuestions), que dependem de recalcSubject
// rodar a partir de Pdf e podem ficar desatualizados em relação ao Histórico real.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
  const myId = session.user.id as string;

  const users = await prisma.user.findMany({ select: { id: true } });
  const norm  = (s: string) => s.trim().toLowerCase();
  const otherUsersCount = users.filter(u => u.id !== myId).length;

  // Para cada usuário, busca as matérias e as sessões de estudo (fonte real de questões/horas)
  const perUser = await Promise.all(
    users.map(async u => {
      const subjects = await prisma.subject.findMany({
        where:   { userId: u.id },
        select:  { id: true, name: true },
      });
      const sessions = await prisma.studySession.findMany({
        where:  { userId: u.id },
        select: { subjectId: true, studyHours: true, questions: true, correct: true, wrong: true },
      });
      return { userId: u.id, subjects, sessions };
    })
  );

  // Agrega por nome de matéria: "you" = só o usuário logado, "others" = soma de todos os outros
  const subjectMap: Record<string, {
    name: string;
    you:    { hours: number; questions: number; correct: number; wrong: number };
    others: { hours: number; questions: number; correct: number; wrong: number };
  }> = {};

  for (const { userId, subjects, sessions } of perUser) {
    const isMe = userId === myId;
    // Mapa subjectId -> nome da matéria, para casar a sessão com o nome correto
    const subjectNameById: Record<string, string> = {};
    for (const s of subjects) subjectNameById[s.id] = s.name;

    // Inicializa todas as matérias do usuário no map (mesmo sem sessões ainda)
    for (const s of subjects) {
      const key = norm(s.name);
      if (!subjectMap[key]) {
        subjectMap[key] = {
          name: s.name,
          you:    { hours: 0, questions: 0, correct: 0, wrong: 0 },
          others: { hours: 0, questions: 0, correct: 0, wrong: 0 },
        };
      }
    }

    for (const sess of sessions) {
      const subjName = subjectNameById[sess.subjectId];
      if (!subjName) continue;
      const key = norm(subjName);
      if (!subjectMap[key]) {
        subjectMap[key] = {
          name: subjName,
          you:    { hours: 0, questions: 0, correct: 0, wrong: 0 },
          others: { hours: 0, questions: 0, correct: 0, wrong: 0 },
        };
      }
      const target = isMe ? subjectMap[key].you : subjectMap[key].others;
      target.hours     += sess.studyHours;
      target.questions += sess.questions;
      target.correct   += sess.correct;
      target.wrong      += sess.wrong;
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
