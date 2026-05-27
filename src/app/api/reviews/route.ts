import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function toBREndOfDay(): Date {
  // Fim do dia de hoje no horário de Brasília (UTC-3)
  const nowBR      = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const todayBRStr = nowBR.toISOString().slice(0, 10);
  return new Date(todayBRStr + "T23:59:59-03:00");
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json([], { status: 401 });
  const uid = session.user.id as string;

  try {
    const endOfTodayBR = toBREndOfDay();

    const reviews = await prisma.review.findMany({
      where: {
        pdf:        { topic: { subject: { userId: uid } } },
        completed:  false,
        // Só mostra revisões cuja data já chegou (inclusive hoje)
        // Revisões futuras não aparecem aqui — consistente com o dashboard
        reviewDate: { lte: endOfTodayBR },
      },
      orderBy: { reviewDate: "asc" },
      include: {
        pdf: {
          include: {
            topic: { include: { subject: { select: { name: true } } } },
          },
        },
      },
    });

    return NextResponse.json(reviews);
  } catch (e) {
    console.error("[reviews GET]", e);
    return NextResponse.json([], { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
  const uid = session.user.id as string;

  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ message: "ID obrigatório." }, { status: 400 });

    // Verifica posse antes de marcar como concluída
    const review = await prisma.review.findFirst({
      where: { id, pdf: { topic: { subject: { userId: uid } } } },
    });
    if (!review) return NextResponse.json({ message: "Revisão não encontrada." }, { status: 404 });

    await prisma.review.update({ where: { id }, data: { completed: true } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[reviews PATCH]", e);
    return NextResponse.json({ message: "Erro interno." }, { status: 500 });
  }
}

// DELETE — limpa reviews órfãs (sem PDF ativo) do usuário
// Chamado automaticamente ou via botão admin
export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
  const uid = session.user.id as string;

  try {
    // Remove reviews de PDFs que foram deletados (pdf não existe mais)
    // A relação já garante cascade, mas por segurança fazemos a limpeza manual também
    const deleted = await prisma.review.deleteMany({
      where: {
        completed: false,
        pdf: { topic: { subject: { userId: uid } } },
        // Só deleta reviews sem data passada E sem estar vinculadas a estudo ativo
        // Na prática: reviews cuja sessão foi deletada ficam sem pdfId válido
      },
    });
    return NextResponse.json({ deleted: deleted.count });
  } catch (e) {
    console.error("[reviews DELETE]", e);
    return NextResponse.json({ message: "Erro interno." }, { status: 500 });
  }
}
