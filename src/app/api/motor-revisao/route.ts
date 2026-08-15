import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ── Motor de Consolidação ─────────────────────────────────────────────────────
// Prioriza revisões com base em 4 fatores:
// 1. Peso do conteúdo no edital (Subject.editalWeight)
// 2. Erros acumulados (ErrorNote.wrongCount)
// 3. Instabilidade do conteúdo (wrongCount / reviewCount)
// 4. Urgência temporal (dias em atraso + intervalo da curva de esquecimento)

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").trim();
}

function toBRToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function daysDiff(date: Date | null, today: string): number {
  if (!date) return 0;
  const d = date.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const diff = (new Date(today).getTime() - new Date(d).getTime()) / (1000 * 60 * 60 * 24);
  return Math.round(diff);
}

export interface ConsolidationItem {
  id: string;
  type: "errorNote" | "pdfReview";
  title: string;
  subjectName: string;
  subjectId: string;
  editalWeight: number;
  wrongCount: number;
  reviewCount: number;
  instability: number;       // wrongCount / reviewCount
  daysOverdue: number;       // dias em atraso
  intervalDays: number;      // intervalo atual de revisão
  accuracyPct: number | null; // % de acerto (se disponível)
  score: number;             // score final de prioridade
  nextIntervalDays: number;  // próximo intervalo sugerido
  // Só para pdfReview
  pdfId?: string;
  pdfTitle?: string;
  reviewId?: string;
  reviewType?: string;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json([], { status: 401 });
  const uid = session.user.id as string;
  const today = toBRToday();

  // 1. Busca todos os subjects com peso no edital
  const subjects = await prisma.subject.findMany({
    where:   { userId: uid },
    select:  { id: true, name: true, editalWeight: true },
  });
  const subjectWeightMap: Record<string, { name: string; weight: number }> = {};
  for (const s of subjects) subjectWeightMap[s.id] = { name: s.name, weight: s.editalWeight };

  // 2. ErrorNotes pendentes de revisão
  const errorNotes = await prisma.errorNote.findMany({
    where: {
      userId:   uid,
      resolved: false,
      OR: [
        { nextReviewAt: null },
        { nextReviewAt: { lte: new Date(today + "T23:59:59-03:00") } },
      ],
    },
    select: {
      id: true, title: true, subjectId: true,
      wrongCount: true, reviewCount: true,
      intervalDays: true, nextReviewAt: true, lastReviewedAt: true,
    },
  });

  // 3. Reviews de PDF pendentes
  const pdfReviews = await prisma.review.findMany({
    where: {
      pdf:        { topic: { subject: { userId: uid } } },
      completed:  false,
      reviewDate: { lte: new Date(today + "T23:59:59-03:00") },
    },
    include: {
      pdf: {
        select: {
          id: true, title: true, questions: true, correctQuestions: true, wrongQuestions: true,
          topic: { include: { subject: { select: { id: true, name: true, editalWeight: true } } } },
        },
      },
    },
  });

  const items: ConsolidationItem[] = [];

  // ── Processa ErrorNotes ───────────────────────────────────────────────────
  for (const e of errorNotes) {
    const subj      = subjectWeightMap[e.subjectId];
    if (!subj) continue;
    const weight     = subj.weight ?? 5;
    const instab     = e.reviewCount > 0 ? e.wrongCount / e.reviewCount : e.wrongCount;
    const overdue    = daysDiff(e.nextReviewAt, today);
    const overduePos = Math.max(0, overdue);

    // Score: peso edital × 2 + erros × 2 + instabilidade × 2 + urgência × 1 (cap 30d)
    const overdueCapped = Math.min(overduePos, 30); // limita em 30 dias para não distorcer
    const score = (weight * 2) + (e.wrongCount * 2) + (instab * 2) + (overdueCapped * 1);

    // Próximo intervalo: se errou recentemente, reduz; se está em dia, aumenta
    let nextInterval = e.intervalDays;
    if (e.wrongCount > 0 && e.reviewCount > 0) {
      const errorRate = e.wrongCount / e.reviewCount;
      if (errorRate > 0.5)      nextInterval = 1;   // mais de 50% de erro → revisão diária
      else if (errorRate > 0.3) nextInterval = 3;   // 30-50% → a cada 3 dias
      else if (errorRate > 0.1) nextInterval = 7;   // 10-30% → semanal
      else                      nextInterval = 14;  // < 10% → quinzenal
    } else if (e.reviewCount > 3 && e.wrongCount === 0) {
      nextInterval = Math.min(30, e.intervalDays * 2); // consolidado → dobra intervalo
    }

    items.push({
      id:            e.id,
      type:          "errorNote",
      title:         stripHtml(e.title),
      subjectName:   subj.name,
      subjectId:     e.subjectId,
      editalWeight:  weight,
      wrongCount:    e.wrongCount,
      reviewCount:   e.reviewCount,
      instability:   parseFloat(instab.toFixed(2)),
      daysOverdue:   overduePos,
      intervalDays:  e.intervalDays,
      accuracyPct:   null,
      score:         parseFloat(score.toFixed(2)),
      nextIntervalDays: nextInterval,
    });
  }

  // ── Processa Reviews de PDF ───────────────────────────────────────────────
  for (const r of pdfReviews) {
    const subj      = r.pdf.topic.subject;
    const weight    = subj.editalWeight ?? 5;
    const totalQ    = r.pdf.questions;
    const correctQ  = r.pdf.correctQuestions;
    const accuracy  = totalQ > 0 ? Math.round((correctQ / totalQ) * 100) : null;
    const wrongQ    = r.pdf.wrongQuestions;

    const overdue    = daysDiff(r.reviewDate, today);
    const overduePos = Math.max(0, overdue);

    // Instabilidade: baseada no % de erros do PDF
    const errorRate = totalQ > 0 ? wrongQ / totalQ : 0;
    const instab    = errorRate;

    // Score: peso edital × 2 + erros × 1 + instabilidade × 10 + urgência × 1.5 (cap 30d)
    const overdueCapped = Math.min(overduePos, 30);
    const score = (weight * 2) + (wrongQ * 1) + (instab * 10) + (overdueCapped * 1.5);

    // Tipo de revisão em texto
    const reviewTypeMap: Record<string, string> = {
      "24h": "24 horas", "7d": "7 dias", "14d": "14 dias", "30d": "30 dias",
    };

    items.push({
      id:            r.id,
      type:          "pdfReview",
      title:         `Revisão ${reviewTypeMap[r.type] ?? r.type} — ${r.pdf.title}`,
      subjectName:   subj.name,
      subjectId:     subj.id,
      editalWeight:  weight,
      wrongCount:    wrongQ,
      reviewCount:   0,
      instability:   parseFloat(instab.toFixed(2)),
      daysOverdue:   overduePos,
      intervalDays:  parseInt(r.type.replace(/[^0-9]/g, "")) || 1,
      accuracyPct:   accuracy,
      score:         parseFloat(score.toFixed(2)),
      nextIntervalDays: 0,
      pdfId:         r.pdf.id,
      pdfTitle:      r.pdf.title,
      reviewId:      r.id,
      reviewType:    r.type,
    });
  }

  // Ordena por score decrescente — maior score = revisar primeiro
  items.sort((a, b) => b.score - a.score);

  return NextResponse.json({
    items,
    summary: {
      total:        items.length,
      errorNotes:   items.filter(i => i.type === "errorNote").length,
      pdfReviews:   items.filter(i => i.type === "pdfReview").length,
      critical:     items.filter(i => i.score >= 20).length,
      overdue:      items.filter(i => i.daysOverdue > 0).length,
    },
  });
}

// PATCH — marca item como revisado e atualiza intervalo (ErrorNote)
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
  const uid = session.user.id as string;
  const today = toBRToday();

  const { id, type, acertos, erros, nextIntervalDays } = await req.json();

  if (type === "errorNote") {
    const note = await prisma.errorNote.findFirst({
      where: { id, userId: uid },
    });
    if (!note) return NextResponse.json({ message: "Não encontrado." }, { status: 404 });

    const totalQ    = (acertos ?? 0) + (erros ?? 0);
    const newWrong  = note.wrongCount + (erros ?? 0);
    const newReview = note.reviewCount + (totalQ > 0 ? 1 : 0);
    const interval  = nextIntervalDays ?? note.intervalDays;
    const nextDate  = new Date(today);
    nextDate.setDate(nextDate.getDate() + interval);

    await prisma.errorNote.update({
      where: { id },
      data:  {
        wrongCount:    newWrong,
        reviewCount:   newReview,
        intervalDays:  interval,
        lastReviewedAt: new Date(),
        nextReviewAt:  nextDate,
        // Marca como resolvido se erros = 0 e já revisou pelo menos 3 vezes
        resolved: erros === 0 && newReview >= 3,
      },
    });
    return NextResponse.json({ ok: true });
  }

  if (type === "pdfReview") {
    const review = await prisma.review.findFirst({
      where: { id, pdf: { topic: { subject: { userId: uid } } } },
    });
    if (!review) return NextResponse.json({ message: "Não encontrado." }, { status: 404 });
    await prisma.review.update({ where: { id }, data: { completed: true } });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ message: "Tipo inválido." }, { status: 400 });
}
