import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json([], { status: 401 });

  const { searchParams } = new URL(req.url);
  const pdfId = searchParams.get("pdfId");
  if (!pdfId) return NextResponse.json([], { status: 400 });

  // Verifica que o PDF pertence ao usuário
  const pdf = await prisma.pdf.findFirst({
    where: { id: pdfId, topic: { subject: { userId: session.user.id as string } } },
  });
  if (!pdf) return NextResponse.json([], { status: 404 });

  const logs = await prisma.pdfStudyLog.findMany({
    where: { pdfId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(logs);
}
