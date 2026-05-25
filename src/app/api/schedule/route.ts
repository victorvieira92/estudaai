import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ✅ Converte qualquer Date para string "YYYY-MM-DD" no fuso de Brasília (UTC-3)
function toBRDate(date: Date): string {
  const br = new Date(date.getTime() - 3 * 60 * 60 * 1000);
  return br.toISOString().slice(0, 10);
}

function todayBR(): string {
  return toBRDate(new Date());
}

function formatHours(h: number): string {
  const totalMin = Math.round(h * 60);
  if (totalMin < 60) return `${totalMin}min`;
  const hh = Math.floor(totalMin / 60);
  const mm  = totalMin % 60;
  return mm > 0 ? `${hh}h${mm}min` : `${hh}h`;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({}, { status: 401 });

  const uid = session.user.id as string;

  // Data de hoje em Brasília
  const todayDS = todayBR(); // "2026-05-25"

  // Range UTC para a query — pega ±1 dia para cobrir qualquer fuso
  const rangeStart = new Date(todayDS + "T00:00:00-03:00"); // meia-noite BR
  const rangeEnd   = new Date(todayDS + "T23:59:59-03:00"); // fim do dia BR
  const weekDay    = new Date().getDay();

  // Início da semana atual em UTC (domingo)
  const nowUTC = new Date();
  nowUTC.setHours(0, 0, 0, 0);
  const weekStart = new Date(nowUTC);
  weekStart.setDate(nowUTC.getDate() - nowUTC.getDay());

  const [subjects, reviews, errorNotes, sessionsToday, sessionsWeek, studyBlocks] =
    await Promise.all([
      prisma.subject.findMany({
        where: { userId: uid },
        include: {
          topics:     { include: { pdfs: true } },
          errorNotes: { where: { resolved: false } },
          flashcards: { where: { resolved: false } },
        },
        orderBy: { lastStudyAt: "asc" },
      }),
      prisma.review.findMany({
        where: {
          pdf:        { topic: { subject: { userId: uid } } },
          completed:  false,
          reviewDate: { lte: rangeEnd },
        },
        include: {
          pdf: { include: { topic: { include: { subject: { select: { name: true } } } } } },
        },
      }),
      prisma.errorNote.findMany({
        where:   { userId: uid, resolved: false },
        include: { subject: { select: { name: true } } },
        orderBy: { wrongCount: "desc" },
        take:    5,
      }),
      // ✅ FIX DEFINITIVO: usa range BR explícito com offset -03:00
      // Isso garante que sessões das 04h de Brasília não caiam no dia errado
      prisma.studySession.findMany({
        where:   { userId: uid, createdAt: { gte: rangeStart, lte: rangeEnd } },
        include: { subject: { select: { id: true, name: true } } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.studySession.findMany({
        where: { userId: uid, createdAt: { gte: weekStart } },
      }),
      prisma.studyBlock.findMany({
        where:   { userId: uid },
        include: { subject: { select: { id: true, name: true } } },
        orderBy: [{ dayOfWeek: "asc" }, { hours: "desc" }],
      }),
    ]);

  // ── Score de prioridade ───────────────────────────────────────────────────
  const scored = subjects
    .map(s => {
      const allPdfs   = s.topics.flatMap(t => t.pdfs);
      const nextPdf   = allPdfs.find(p => !p.completed);
      const daysSince = s.lastStudyAt
        ? Math.floor((Date.now() - new Date(s.lastStudyAt).getTime()) / 86400000)
        : 30;

      const hasData  = s.totalQuestions > 0;
      const accuracy = hasData
        ? (s.correctQuestions / s.totalQuestions) * 100
        : null;

      const score = hasData
        ? s.editalWeight * 10 + s.criticality * 8 + daysSince * 3 +
          s.errorNotes.length * 12 + (100 - accuracy!) * 0.5
        : s.editalWeight * 10 + s.criticality * 8 + daysSince * 3 +
          s.errorNotes.length * 12;

      return {
        id:                s.id,
        name:              s.name,
        score:             Math.round(score),
        nextPdf:           nextPdf ? { id: nextPdf.id, title: nextPdf.title } : null,
        pendingErrors:     s.errorNotes.length,
        pendingFlashcards: s.flashcards.length,
        accuracy:          hasData ? Math.round(accuracy!) : null,
        studyHours:        s.studyHours,
      };
    })
    .sort((a, b) => b.score - a.score);

  // ── Blocos de hoje ────────────────────────────────────────────────────────
  const todayDbBlocks = studyBlocks.filter(b => b.dayOfWeek === weekDay);
  let subjectQueue    = [...scored];

  const todayBlocks = todayDbBlocks.map(block => {
    const fixedSubject  = block.subjectId
      ? scored.find(s => s.id === block.subjectId) ?? null
      : null;
    const subjectToShow = fixedSubject ?? subjectQueue.shift() ?? null;
    return {
      start:    block.startTime ?? "—",
      end:      block.endTime   ?? "—",
      label:    block.blockType,
      duration: formatHours(block.hours),
      subject:  subjectToShow,
    };
  });

  // ── Estatísticas de hoje ──────────────────────────────────────────────────
  const todayHours     = sessionsToday.reduce((a, s) => a + s.studyHours, 0);
  const todayQuestions = sessionsToday.reduce((a, s) => a + s.questions,  0);

  // ── Histórico do dia ─────────────────────────────────────────────────────
  const todayHistory = sessionsToday.map(s => ({
    id:          s.id,
    subjectName: s.subject?.name ?? "Sem disciplina",
    subjectId:   s.subjectId,
    hours:       s.studyHours,
    questions:   s.questions,
    correct:     s.correct,
    wrong:       s.wrong,
    createdAt:   s.createdAt.toISOString(),
  }));

  // ── Progresso semanal ─────────────────────────────────────────────────────
  const weekHours     = sessionsWeek.reduce((a, s) => a + s.studyHours, 0);
  const weekQuestions = sessionsWeek.reduce((a, s) => a + s.questions,  0);
  const targetHours   = studyBlocks.reduce((a, b) => a + b.hours, 0);

  // ── Próxima ação — próximo bloco do ciclo não concluído ─────────────────
  // Lógica: pega o dia atual do ciclo e os blocos marcados como feitos
  // O ciclo usa CYCLE_KEY e DONE_KEY no localStorage do cliente
  // Na API, usamos os blocos do dia atual na ordem e quantas sessões foram feitas hoje
  // para determinar qual é o próximo bloco a estudar
  
  // Conta quantas sessões foram registradas hoje por matéria
  const sessionCountToday = new Map<string, number>();
  for (const s of sessionsToday) {
    sessionCountToday.set(s.subjectId, (sessionCountToday.get(s.subjectId) ?? 0) + 1);
  }
  
  // Pega os blocos do ciclo atual (CYCLE_KEY começa em 0)
  // Como não temos acesso ao localStorage no servidor, usamos weekDay como fallback
  // mas priorizamos a ordem dos blocos do ciclo
  const allCycleBlocks = studyBlocks.sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.hours - b.hours);
  
  // Encontra o próximo bloco não estudado:
  // Para cada bloco, verifica se o número de sessões da matéria hoje
  // ainda é menor que o número de blocos dessa matéria no ciclo do dia
  const usedCount = new Map<string, number>();
  let nextBlockSubject: typeof scored[0] | null = null;
  let nextBlockType: string | null = null;

  for (const block of todayDbBlocks) {
    if (!block.subjectId) continue;
    const key = block.subjectId + "_" + block.blockType;
    const used = usedCount.get(key) ?? 0;
    const studiedCount = sessionsToday.filter(s => s.subjectId === block.subjectId).length;
    const blockIndexForSubject = todayDbBlocks
      .filter(b => b.subjectId === block.subjectId && b.blockType === block.blockType)
      .indexOf(block);
    
    if (studiedCount <= blockIndexForSubject || used < 1) {
      const subj = scored.find(s => s.id === block.subjectId);
      if (subj && !nextBlockSubject) {
        nextBlockSubject = subj;
        nextBlockType = block.blockType;
      }
    }
    usedCount.set(key, used + 1);
  }

  // Fallback: primeiro bloco do ciclo cuja matéria tem menos sessões que blocos no dia
  if (!nextBlockSubject) {
    // Conta blocos por matéria no dia
    const blocksPerSubject = new Map<string, number>();
    for (const b of todayDbBlocks) {
      if (b.subjectId) blocksPerSubject.set(b.subjectId, (blocksPerSubject.get(b.subjectId) ?? 0) + 1);
    }
    // Encontra matéria onde sessões hoje < blocos no dia
    for (const b of todayDbBlocks) {
      if (!b.subjectId) continue;
      const sessionsForSubject = sessionsToday.filter(s => s.subjectId === b.subjectId).length;
      const blocksForSubject   = blocksPerSubject.get(b.subjectId) ?? 1;
      if (sessionsForSubject < blocksForSubject) {
        nextBlockSubject = scored.find(s => s.id === b.subjectId) ?? null;
        nextBlockType    = b.blockType;
        break;
      }
    }
  }

  // Se todos os blocos do dia foram estudados, recomenda por score
  const nextSubject = nextBlockSubject ?? scored[0] ?? null;

  return NextResponse.json({
    todayBlocks,
    todayHistory,
    reviews:        reviews.slice(0, 10),
    criticalErrors: errorNotes,
    todayStats: {
      hours:     parseFloat(todayHours.toFixed(1)),
      questions: todayQuestions,
    },
    weekStats: {
      hours:        parseFloat(weekHours.toFixed(1)),
      questions:    weekQuestions,
      targetHours:  parseFloat(targetHours.toFixed(2)),
    },
    nextSubject,
    weekDay,
  });
}
