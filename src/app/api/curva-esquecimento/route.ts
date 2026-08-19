import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function toBRDate(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function daysSince(dateStr: string): number {
  const today = new Date(toBRDate(new Date()) + "T12:00:00");
  const past  = new Date(dateStr + "T12:00:00");
  return Math.max(0, Math.round((today.getTime() - past.getTime()) / (1000 * 60 * 60 * 24)));
}

// Curva de esquecimento de Ebbinghaus simplificada
// Retenção = e^(-days / estabilidade)
// Estabilidade aumenta com mais repetições e maior acerto
function retention(daysSinceReview: number, stability: number): number {
  return Math.round(Math.exp(-daysSinceReview / stability) * 100);
}

export interface TopicForgetting {
  subjectId:       string;
  subjectName:     string;
  subjectWeight:   number;
  topicName:       string;
  lastStudied:     string;      // data da última sessão
  daysSinceStudy:  number;
  sessions:        number;      // total de sessões
  accuracy:        number;      // % de acerto médio
  retentionPct:    number;      // % estimado de retenção atual
  urgency:         number;      // 0-100, quanto precisa revisar agora
  questions:       number;      // total de questões feitas
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json([], { status: 401 });
  const uid = session.user.id as string;

  const subjects = await prisma.subject.findMany({
    where:  { userId: uid },
    select: { id: true, name: true, editalWeight: true },
  });
  const subjectMap: Record<string, { name: string; weight: number }> = {};
  for (const s of subjects) subjectMap[s.id] = { name: s.name, weight: s.editalWeight ?? 5 };

  const sessions = await prisma.studySession.findMany({
    where:   { userId: uid },
    orderBy: { createdAt: "asc" },
  });

  // Agrega por subjectId + topicName
  const topicMap: Record<string, {
    subjectId: string; topicName: string;
    sessions: number; totalQuestions: number; totalCorrect: number;
    lastStudied: string;
  }> = {};

  for (const s of sessions) {
    let notes: any = {};
    try { notes = JSON.parse(s.notes ?? "{}"); } catch {}
    const topicName = (notes.topicName ?? "").trim();
    if (!topicName) continue;

    const key     = `${s.subjectId}::${topicName}`;
    const dateStr = toBRDate(new Date(s.createdAt));

    if (!topicMap[key]) {
      topicMap[key] = { subjectId: s.subjectId, topicName, sessions: 0, totalQuestions: 0, totalCorrect: 0, lastStudied: dateStr };
    }
    topicMap[key].sessions++;
    topicMap[key].totalQuestions += s.questions;
    topicMap[key].totalCorrect   += s.correct;
    if (dateStr > topicMap[key].lastStudied) topicMap[key].lastStudied = dateStr;
  }

  const result: TopicForgetting[] = [];

  for (const [, t] of Object.entries(topicMap)) {
    const subj    = subjectMap[t.subjectId];
    if (!subj) continue;

    const accuracy      = t.totalQuestions > 0 ? Math.round((t.totalCorrect / t.totalQuestions) * 100) : 50;
    const daysSince_    = daysSince(t.lastStudied);

    // Estabilidade: aumenta com repetições e acerto alto, diminui com erros
    // Base: 7 dias. Cada sessão extra + 3 dias. Acerto alto → multiplica por 1.5
    const stabilityBase = 7 + (t.sessions - 1) * 3;
    const accuracyMult  = accuracy >= 80 ? 1.5 : accuracy >= 60 ? 1.0 : 0.6;
    const stability     = stabilityBase * accuracyMult;

    const retentionPct  = retention(daysSince_, stability);

    // Urgência: considera retenção baixa + peso no edital + tempo sem ver
    // 0-100 onde 100 = precisa revisar imediatamente
    const forgetting    = 100 - retentionPct;
    const weightBonus   = (subj.weight / 10) * 20; // até +20 pontos para peso máximo
    const urgency       = Math.min(100, Math.round(forgetting * 0.7 + weightBonus + Math.min(daysSince_, 30) * 0.5));

    result.push({
      subjectId:      t.subjectId,
      subjectName:    subj.name,
      subjectWeight:  subj.weight,
      topicName:      t.topicName,
      lastStudied:    t.lastStudied,
      daysSinceStudy: daysSince_,
      sessions:       t.sessions,
      accuracy,
      retentionPct,
      urgency,
      questions:      t.totalQuestions,
    });
  }

  // Ordena por urgência decrescente
  result.sort((a, b) => b.urgency - a.urgency);

  return NextResponse.json(result);
}
