import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Exporta em formato tab-separated compatível com Anki import
// O Anki aceita arquivos .txt com campos separados por tab:
// pergunta[TAB]resposta[TAB]deck
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });

  const [flashcards, errorNotes] = await Promise.all([
    prisma.flashcard.findMany({
      where: { userId: session.user.id as string },
      include: { subject: { select: { name: true } } },
    }),
    prisma.errorNote.findMany({
      where: { userId: session.user.id as string },
      include: { subject: { select: { name: true } } },
    }),
  ]);

  // Header compatível com Anki
  const lines = [
    "#separator:tab",
    "#html:true",
    "#deck column:3",
    "#notetype:Basic",
  ];

  // Limpa HTML para texto puro
  const strip = (html: string) => html?.replace(/<[^>]*>/g, "") ?? "";

  for (const c of flashcards) {
    const deck = c.topic ? `${c.subject.name}::${c.topic}` : c.subject.name;
    lines.push([strip(c.question), strip(c.answer), deck].join("\t"));
  }

  for (const n of errorNotes) {
    const deck = n.topic ? `${n.subject.name}::${n.topic}` : n.subject.name;
    lines.push([strip(n.title), strip(n.description), deck].join("\t"));
  }

  const content = lines.join("\n");

  return new NextResponse(content, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": 'attachment; filename="estudaai_anki.txt"',
    },
  });
}
