import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function toBRDate(date: Date): string {
  // Usa Intl.DateTimeFormat para obter a data real no fuso de Brasília (America/Sao_Paulo)
  // Isso lida corretamente com horário de verão e evita offset fixo de -3h
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(date);
}
function todayBR(): string { return toBRDate(new Date()); }

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({}, { status: 401 });
  const uid = session.user.id as string;

  const todayUTC = new Date();
  todayUTC.setHours(0, 0, 0, 0);

  const [subjects, errorNotes, reviews, allSessions, studyBlocks] = await Promise.all([
    prisma.subject.findMany({
      where:   { userId: uid },
      include: { topics: { include: { pdfs: true } } },
    }),
    prisma.errorNote.findMany({
      where:   { userId: uid },
      include: { subject: { select: { name: true } } },
    }),
    prisma.review.findMany({
      where: { pdf: { topic: { subject: { userId: uid } } } },
    }),
    prisma.studySession.findMany({
      where:   { userId: uid },
      orderBy: { createdAt: "asc" },
    }),
    prisma.studyBlock.findMany({ where: { userId: uid } }),
  ]);

  const allPdfs        = subjects.flatMap(s => s.topics.flatMap(t => t.pdfs));
  // Usa a mesma lógica da rota /api/reviews: só conta revisões cuja data já chegou
  // reviews com reviewDate futuro NÃO são exibidas na aba Revisões, portanto não devem
  // aparecer no dashboard como pendentes
  const todayEndUTC = new Date(todayUTC); todayEndUTC.setHours(23, 59, 59, 999);
  const pendingReviews = reviews.filter(r => !r.completed && new Date(r.reviewDate) <= todayEndUTC).length;
  const lateReviews    = reviews.filter(r => !r.completed && new Date(r.reviewDate) < todayUTC).length;

  // ── KPIs globais — calculados direto das StudySessions (fonte única) ──────
  const totalHours     = allSessions.reduce((a, s) => a + s.studyHours, 0);
  const totalQuestions = allSessions.reduce((a, s) => a + s.questions, 0);
  const totalCorrect   = allSessions.reduce((a, s) => a + s.correct, 0);
  const totalWrong     = allSessions.reduce((a, s) => a + s.wrong, 0);

  // ── Stats por disciplina — também via StudySessions ───────────────────────
  const subjectSessionMap = new Map<string, {
    name: string; hours: number; questions: number; correct: number; wrong: number;
  }>();
  for (const subj of subjects) {
    subjectSessionMap.set(subj.id, {
      name: subj.name, hours: 0, questions: 0, correct: 0, wrong: 0,
    });
  }
  for (const s of allSessions) {
    const entry = subjectSessionMap.get(s.subjectId);
    if (entry) {
      entry.hours     += s.studyHours;
      entry.questions += s.questions;
      entry.correct   += s.correct;
      entry.wrong     += s.wrong;
    }
  }
  const subjectStats = Array.from(subjectSessionMap.values()).map(s => ({
    name:      s.name,
    hours:     parseFloat(s.hours.toFixed(1)),
    questions: s.questions,
    correct:   s.correct,
    wrong:     s.wrong,
    accuracy:  s.questions > 0
      ? parseFloat(((s.correct / s.questions) * 100).toFixed(1))
      : null,
  }));

  // ── Horas por dia (últimos 7 dias) ────────────────────────────────────────
  const DAYS_BR = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  const DAYS_WEEK_SHORT = ["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"];
  const weekMap: Record<string, { label: string; hours: number; questions: number; correct: number; wrong: number }> = {};
  // Começa na segunda-feira usando BRT
  const todayBRForMap = todayBR();
  const todayForMap   = new Date(todayBRForMap + "T12:00:00");
  const daysSinceMonForMap = (todayForMap.getDay() + 6) % 7;
  for (let i = 0; i < 7; i++) {
    const d = new Date(todayForMap);
    d.setDate(todayForMap.getDate() - daysSinceMonForMap + i);
    const ds = toBRDate(d);
    weekMap[ds] = { label: DAYS_WEEK_SHORT[i], hours: 0, questions: 0, correct: 0, wrong: 0 };
  }
  for (const s of allSessions) {
    const ds = toBRDate(new Date(s.createdAt));
    if (ds in weekMap) {
      weekMap[ds].hours     += s.studyHours;
      weekMap[ds].questions += s.questions;
      weekMap[ds].correct   += s.correct;
      weekMap[ds].wrong     += s.wrong;
    }
  }
  const weeklyHours = Object.values(weekMap).map(({ label, hours }) => ({
    day: label, hours: parseFloat(hours.toFixed(1)),
  }));

  // ── Constância ────────────────────────────────────────────────────────────
  const sessionDatesBR = new Set(allSessions.map(s => toBRDate(new Date(s.createdAt))));
  const todayDS  = todayBR();
  const msPerDay = 86400000;

  let streak  = 0;
  let checkTS = sessionDatesBR.has(todayDS) ? Date.now() : Date.now() - msPerDay;
  while (true) {
    const ds = toBRDate(new Date(checkTS));
    if (!sessionDatesBR.has(ds)) break;
    streak++;
    checkTS -= msPerDay;
  }

  const todayMs = new Date(todayDS + "T12:00:00").getTime();

  // ── Mês atual em BRT ──────────────────────────────────────────────────────
  const [todayYear, todayMonth] = todayDS.split("-").map(Number);
  const firstOfMonthDS = `${todayYear}-${String(todayMonth).padStart(2, "0")}-01`;
  const lastDayOfMonth = new Date(todayYear, todayMonth, 0).getDate();
  const lastOfMonthDS  = `${todayYear}-${String(todayMonth).padStart(2, "0")}-${String(lastDayOfMonth).padStart(2, "0")}`;
  const firstOfMonthMs = new Date(firstOfMonthDS + "T12:00:00").getTime();
  const lastOfMonthMs  = new Date(lastOfMonthDS  + "T12:00:00").getTime();
  const totalDays      = lastDayOfMonth;
  const studiedDays    = [...sessionDatesBR].filter(ds => ds >= firstOfMonthDS && ds <= todayDS).length;
  const daysElapsed    = Math.round((todayMs - firstOfMonthMs) / msPerDay) + 1;
  const consistency    = Math.round((studiedDays / daysElapsed) * 100);

  // Mapa data → sessões (subjectId) para calcular parcial/completo
  const dateToSubjectSessions: Record<string, string[]> = {};
  allSessions.forEach(s => {
    const ds = toBRDate(new Date(s.createdAt));
    if (!dateToSubjectSessions[ds]) dateToSubjectSessions[ds] = [];
    if (s.subjectId) dateToSubjectSessions[ds].push(s.subjectId);
  });

  // Calcula status de cada dia: done | partial | none
  // Dia da semana → idx do ciclo: seg(1)=0, ter(2)=1, qua(3)=2, qui(4)=3, sex(5)=4, sab(6)=5, dom(0)=6
  function jsDoWtoCycleIdx(dow: number): number { return dow === 0 ? 6 : dow - 1; }
  function getDayStatus(ds: string): "done" | "partial" | "none" {
    const sessions = dateToSubjectSessions[ds] ?? [];
    if (!sessions.length) return "none";
    const d = new Date(ds + "T12:00:00Z");
    const dow = d.getUTCDay();
    const idx = jsDoWtoCycleIdx(dow);
    const dayBlocks = studyBlocks.filter(b => b.dayOfWeek === idx && b.subjectId);
    if (!dayBlocks.length) return sessions.length > 0 ? "done" : "none";
    // Conta quantos blocos foram cobertos (1 sessão por bloco da mesma matéria)
    const sessCount: Record<string, number> = {};
    sessions.forEach(sid => { sessCount[sid] = (sessCount[sid] ?? 0) + 1; });
    const used: Record<string, number> = {};
    let covered = 0;
    dayBlocks.forEach(b => {
      if (!b.subjectId) return;
      const avail = sessCount[b.subjectId] ?? 0;
      const u = used[b.subjectId] ?? 0;
      if (u < avail) { covered++; used[b.subjectId] = u + 1; }
    });
    if (covered >= dayBlocks.length) return "done";
    if (covered > 0) return "partial";
    return "none";
  }

  // Lê overrides manuais do UserCycleState
  const cycleState = await prisma.userCycleState.findUnique({ where: { userId: uid } });
  let dotOverrides: Record<string, "done" | "partial" | "none"> = {};
  try {
    const parsed = JSON.parse(cycleState?.pendingBlocks ?? "{}");
    dotOverrides = parsed?.dotOverrides ?? {};
  } catch { dotOverrides = {}; }

  // consistencyDots: todos os dias do mês atual (1º ao último)
  // Dias passados/hoje: status real; dias futuros: "future"
  // Usa string para evitar bug de horário de verão ao somar ms
  const consistencyDots: { date: string; studied: boolean; status: "done" | "partial" | "none" | "future" }[] = [];
  for (let day = 1; day <= lastDayOfMonth; day++) {
    const ds = `${todayYear}-${String(todayMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (ds > todayDS) {
      consistencyDots.push({ date: ds, studied: false, status: "future" });
    } else {
      const status = dotOverrides[ds] ?? getDayStatus(ds);
      consistencyDots.push({ date: ds, studied: status !== "none", status });
    }
  }

  // ── Estudos de hoje ───────────────────────────────────────────────────────
  const todaySessions  = allSessions.filter(s => toBRDate(new Date(s.createdAt)) === todayDS);
  const todayHours     = todaySessions.reduce((a, s) => a + s.studyHours, 0);
  const todayQuestions = todaySessions.reduce((a, s) => a + s.questions, 0);

  const todaySubjectMap = new Map<string, number>();
  for (const s of todaySessions) {
    const subj = subjects.find(sub => sub.id === s.subjectId);
    if (subj) todaySubjectMap.set(subj.name, (todaySubjectMap.get(subj.name) ?? 0) + s.studyHours);
  }
  const todayBySubject = Array.from(todaySubjectMap.entries()).map(([name, hours]) => ({
    name, hours: parseFloat(hours.toFixed(2)),
  }));

  // ── Dados semanais navegáveis (últimas 8 semanas) ─────────────────────────
  function getWeekData(weekOffset: number) {
    // Usa a data atual em BRT para calcular o início da semana (segunda-feira)
    const todayBRStr = todayBR(); // YYYY-MM-DD em BRT
    const todayBRDate = new Date(todayBRStr + "T12:00:00"); // meio-dia para evitar DST
    // getDay(): 0=Dom,1=Seg,...,6=Sab → dias desde segunda = (getDay()+6)%7
    const daysSinceMonday = (todayBRDate.getDay() + 6) % 7;
    const monday = new Date(todayBRDate);
    monday.setDate(todayBRDate.getDate() - daysSinceMonday - weekOffset * 7);

    // Seg, Ter, Qua, Qui, Sex, Sáb, Dom (começa na segunda)
    const DAYS_WEEK = ["Seg","Ter","Qua","Qui","Sex","Sáb","Dom"];

    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const ds = toBRDate(d);
      const daySessions = allSessions.filter(s => toBRDate(new Date(s.createdAt)) === ds);
      return {
        day:       DAYS_WEEK[i],
        date:      ds,
        hours:     parseFloat(daySessions.reduce((a, s) => a + s.studyHours, 0).toFixed(1)),
        questions: daySessions.reduce((a, s) => a + s.questions, 0),
        correct:   daySessions.reduce((a, s) => a + s.correct, 0),
        wrong:     daySessions.reduce((a, s) => a + s.wrong, 0),
      };
    });
  }

  const weeksData = Array.from({ length: 8 }, (_, i) => {
    const days = getWeekData(i);
    return { weekOffset: i, startDate: days[0].date, endDate: days[6].date, days };
  });

  // Meta semanal de horas = soma das horas de todos os StudyBlocks do ciclo (1 ciclo = 1 semana)
  // Sem arredondamento — exibe exatamente como configurado (ex: 19.5h = 19h30min)
  const weeklyGoalHours = parseFloat(
    (studyBlocks as any[]).reduce((a: number, b: any) => a + (b.hours ?? 0), 0).toFixed(2)
  );

  return NextResponse.json({
    totalHours:     parseFloat(totalHours.toFixed(1)),
    totalQuestions, totalCorrect, totalWrong,
    accuracy:       totalQuestions > 0
      ? parseFloat(((totalCorrect / totalQuestions) * 100).toFixed(1))
      : null,
    completedPdfs:  allPdfs.filter(p => p.completed).length,
    totalPdfs:      allPdfs.length,
    pendingErrors:  errorNotes.filter(e => !e.resolved).length,
    resolvedErrors: errorNotes.filter(e => e.resolved).length,
    pendingReviews, lateReviews,
    streak, studiedDays, totalDays, consistency, consistencyDots,
    todayHours:     parseFloat(todayHours.toFixed(1)),
    todayQuestions, todayBySubject,
    subjectStats,
    criticalErrors: errorNotes
      .filter(e => !e.resolved)
      .sort((a, b) => (b.wrongCount + b.reviewCount) - (a.wrongCount + a.reviewCount))
      .slice(0, 8)
      .map(e => ({
        title: e.title, subject: e.subject.name, topic: e.topic,
        reviewCount: e.reviewCount, wrongCount: e.wrongCount, difficulty: e.difficulty,
      })),
    weeklyHours,
    weeksData,
    weeklyGoalHours,
  });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const uid = session.user.id as string;

  const { date, status } = await req.json();
  if (!date || !status) return NextResponse.json({ error: "date e status obrigatórios." }, { status: 400 });

  // Lê estado atual
  const cycleState = await prisma.userCycleState.findUnique({ where: { userId: uid } });
  let payload: any = {};
  try { payload = JSON.parse(cycleState?.pendingBlocks ?? "{}"); } catch {}

  if (!payload.dotOverrides) payload.dotOverrides = {};

  if (status === "auto") {
    // Remove override — volta ao cálculo automático
    delete payload.dotOverrides[date];
  } else {
    payload.dotOverrides[date] = status;
  }

  await prisma.userCycleState.upsert({
    where:  { userId: uid },
    create: { userId: uid, currentDayIdx: 0, pendingBlocks: JSON.stringify(payload), lastDate: "" },
    update: { pendingBlocks: JSON.stringify(payload) },
  });

  return NextResponse.json({ ok: true });
}
