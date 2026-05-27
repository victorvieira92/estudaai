// src/app/api/import-subjects/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ── Proteção por email do owner ───────────────────────────────────────────────
// Defina OWNER_EMAIL no .env do Railway/Vercel com o email da sua conta
// Ex: OWNER_EMAIL=victor@email.com
// Só esse email consegue usar esta rota — qualquer outro recebe 403
const OWNER_EMAIL = process.env.OWNER_EMAIL ?? "";

interface PdfInput     { title: string; }
interface SubjectInput {
  subject:       string;
  topic:         string;
  pdfs:          PdfInput[];
  editalWeight?: number;
  criticality?:  number;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session?.user?.email)
    return NextResponse.json({ message: "Não autorizado." }, { status: 401 });

  // Bloqueia qualquer email que não seja o owner
  if (OWNER_EMAIL && session.user.email !== OWNER_EMAIL)
    return NextResponse.json({ message: "Acesso restrito ao administrador." }, { status: 403 });

  const uid = session.user.id as string;

  try {
    const body: SubjectInput[] = await req.json();
    if (!Array.isArray(body) || body.length === 0)
      return NextResponse.json({ message: "Payload inválido." }, { status: 400 });

    const results = { created: 0, skipped: 0, pdfs: 0 };

    for (const item of body) {
      if (!item.subject?.trim() || !item.topic?.trim()) continue;

      // Cria ou reutiliza a matéria
      let subject = await prisma.subject.findFirst({
        where: { name: { equals: item.subject.trim(), mode: "insensitive" }, userId: uid },
      });
      if (!subject) {
        subject = await prisma.subject.create({
          data: {
            name:         item.subject.trim(),
            editalWeight: Math.min(10, Math.max(1, item.editalWeight ?? 5)),
            criticality:  Math.min(10, Math.max(1, item.criticality  ?? 5)),
            userId:       uid,
          },
        });
        results.created++;
      } else {
        results.skipped++;
      }

      // Cria ou reutiliza o tópico
      let topic = await prisma.topic.findFirst({
        where: { name: { equals: item.topic.trim(), mode: "insensitive" }, subjectId: subject.id },
      });
      if (!topic) {
        topic = await prisma.topic.create({
          data: { name: item.topic.trim(), subjectId: subject.id },
        });
      }

      // Cria PDFs evitando duplicatas
      for (const pdf of item.pdfs) {
        if (!pdf.title?.trim()) continue;
        const exists = await prisma.pdf.findFirst({
          where: { title: { equals: pdf.title.trim(), mode: "insensitive" }, topicId: topic.id },
        });
        if (!exists) {
          await prisma.pdf.create({
            data: { title: pdf.title.trim(), topicId: topic.id, totalPages: 0 },
          });
          results.pdfs++;
        }
      }
    }

    return NextResponse.json({ ok: true, ...results });
  } catch (e) {
    console.error("[import-subjects POST]", e);
    return NextResponse.json({ message: "Erro interno.", detail: String(e) }, { status: 500 });
  }
}
