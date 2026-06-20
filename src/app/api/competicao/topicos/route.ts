import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/competicao/topicos?subjectName=xxx
// Compara o usuário logado com o agregado de todos os outros usuários, por tópico, dentro de uma matéria.
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

  const allSubjectsByUser = await Promise.all(
    allUsers.map(u =>
      prisma.subject.findMany({
        where:   { userId: u.id },
        include: { topics: { include: { pdfs: true } } },
      }).then(subs => ({ userId: u.id, subject: subs.find(s => norm(s.name) === targetName) ?? null }))
    )
  );

  function aggregateByTopic(subject: typeof allSubjectsByUser[0]["subject"]) {
    const out: Record<string, { questions: number; correct: number; hours: number; name: string }> = {};
    if (!subject) return out;
    for (const topic of subject.topics) {
      const questions = topic.pdfs.reduce((a, p) => a + p.questions, 0);
      const correct   = topic.pdfs.reduce((a, p) => a + p.correctQuestions, 0);
      const hours     = topic.pdfs.reduce((a, p) => a + p.studyHours, 0);
      out[norm(topic.name)] = { questions, correct, hours, name: topic.name };
    }
    return out;
  }

  const myEntry  = allSubjectsByUser.find(e => e.userId === myId);
  const myTopics = aggregateByTopic(myEntry?.subject ?? null);

  // Soma os tópicos de todos os outros usuários
  const othersTopics: Record<string, { questions: number; correct: number; hours: number; name: string }> = {};
  for (const entry of allSubjectsByUser) {
    if (entry.userId === myId) continue;
    const agg = aggregateByTopic(entry.subject);
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
    subjectName: myEntry?.subject?.name ?? subjectName,
    topics,
  });
}
