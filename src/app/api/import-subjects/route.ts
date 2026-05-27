// src/app/api/import-subjects/route.ts
// Importação em massa — qualquer usuário autenticado pode importar para a própria conta
// Formato da planilha: aba = matéria | coluna A = tópico | coluna B = PDF (aula)
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface PdfInput {
  title: string;
}
interface TopicInput {
  topic: string;
  pdfs:  PdfInput[];
}
interface SubjectInput {
  subject:       string;   // nome da aba = nome da matéria
  topics:        TopicInput[];
  editalWeight?: number;
  criticality?:  number;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
  const uid = session.user.id as string;

  try {
    const body: SubjectInput[] = await req.json();
    if (!Array.isArray(body) || body.length === 0)
      return NextResponse.json({ message: "Payload inválido." }, { status: 400 });

    const results = { subjects: 0, topics: 0, pdfs: 0, skipped: 0 };

    for (const item of body) {
      if (!item.subject?.trim()) continue;

      // Cria ou reutiliza a matéria (isolada por userId)
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
        results.subjects++;
      } else {
        results.skipped++;
      }

      // Para cada tópico da matéria
      for (const topicItem of item.topics) {
        if (!topicItem.topic?.trim()) continue;

        let topic = await prisma.topic.findFirst({
          where: { name: { equals: topicItem.topic.trim(), mode: "insensitive" }, subjectId: subject.id },
        });
        if (!topic) {
          topic = await prisma.topic.create({
            data: { name: topicItem.topic.trim(), subjectId: subject.id },
          });
          results.topics++;
        }

        // Para cada PDF do tópico
        for (const pdf of topicItem.pdfs) {
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
    }

    return NextResponse.json({ ok: true, ...results });
  } catch (e) {
    console.error("[import-subjects POST]", e);
    return NextResponse.json({ message: "Erro interno.", detail: String(e) }, { status: 500 });
  }
}
