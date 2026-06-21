import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/competicao/topicos?subjectName=xxx
// Compara o usuário logado com o agregado de todos os outros usuários, por tópico, dentro de uma matéria.
// Fonte de verdade: StudySession (igual Histórico/Matérias), não os campos agregados em Pdf,
// que podem ficar desatualizados quando o lançamento não passa pelo fluxo de PDF específico.
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
  const myId = session.user.id as string;

  const { searchParams } = new URL(req.url);
  const subjectName = searchParams.get("subjectName");
  if (!subjectName) return NextResponse.json({ message: "Parâmetro obrigatório: subjectName." }, { status: 400 });

  const norm = (s: string) => s.trim().toLowerCase();
  const targetName = norm(subjectName);

  const allUsers = await prisma.user.findMany({ select: { id: true } });

  // Agrega questões/acertos/horas por tópico a partir das StudySessions reais
  // (não usa os campos agregados em Pdf, que podem ficar desatualizados).
  async function aggregateByTopicReal(userId: string, subjectId: string | null) {
    const out: Record<string, { questions: number; correct: number; hours: number; name: string }> = {};
    if (!subjectId) return out;
    const sessions = await prisma.studySession.findMany({
      where: { userId, subjectId },
    });
    for (const s of sessions) {
      let n: any = {};
      try { n = JSON.parse(s.notes ?? "{}"); } catch {}
      const topicNameRaw = (n.topicName ?? "").trim();
      if (!topicNameRaw) continue;
      const key = norm(topicNameRaw);
      if (!out[key]) out[key] = { questions: 0, correct: 0, hours: 0, name: topicNameRaw };
      out[key].questions += s.questions;
      out[key].correct   += s.correct;
      out[key].hours     += s.studyHours;
    }
    return out;
  }

  const mySubjects = await prisma.subject.findMany({ where: { userId: myId }, select: { id: true, name: true } });
  const mySubject  = mySubjects.find(s => norm(s.name) === targetName) ?? null;
  const myTopics   = await aggregateByTopicReal(myId, mySubject?.id ?? null);

  const othersTopics: Record<string, { questions: number; correct: number; hours: number; name: string }> = {};
  for (const u of allUsers) {
    if (u.id === myId) continue;
    const subjects = await prisma.subject.findMany({ where: { userId: u.id }, select: { id: true, name: true } });
    const subject  = subjects.find(s => norm(s.name) === targetName) ?? null;
    if (!subject) continue;
    const agg = await aggregateByTopicReal(u.id, subject.id);
    for (const [key, val] of Object.entries(agg)) {
      if (!othersTopics[key]) othersTopics[key] = { questions: 0, correct: 0, hours: 0, name: val.name };
      othersTopics[key].questions += val.questions;
      othersTopics[key].correct   += val.correct;
      othersTopics[key].hours     += val.hours;
    }
  }

  const allKeys = [...new Set([...Object.keys(myTopics), ...Object.keys(othersTopics)])];

  const topics = allKeys.map(key => {
    const mine  = myTopics[key]     ?? { questions: 0, correct: 0, hours: 0, name: key };
    const other = othersTopics[key] ?? { questions: 0, correct: 0, hours: 0, name: key };
    return {
      name: mine.name !== key ? mine.name : other.name,
      you:    { questions: mine.questions,  correct: mine.correct,  hours: parseFloat(mine.hours.toFixed(1)),  accuracy: mine.questions  > 0 ? Math.round((mine.correct  / mine.questions)  * 100) : null },
      others: { questions: other.questions, correct: other.correct, hours: parseFloat(other.hours.toFixed(1)), accuracy: other.questions > 0 ? Math.round((other.correct / other.questions) * 100) : null },
    };
  }).sort((a, b) => (b.you.questions + b.others.questions) - (a.you.questions + a.others.questions));

  return NextResponse.json({
    subjectName: mySubject?.name ?? subjectName,
    topics,
  });
}
