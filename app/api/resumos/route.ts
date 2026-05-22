import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET — lista resumos do usuário
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json([], { status: 401 });

  const resumos = await prisma.resumo.findMany({
    where: { userId: session.user.id as string },
    include: { subject: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(resumos);
}

// POST — salva metadados após upload
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });

  const { name, url, key, subjectId, size } = await req.json();

  if (!name || !url || !key) {
    return NextResponse.json({ message: "Dados inválidos." }, { status: 400 });
  }

  const resumo = await prisma.resumo.create({
    data: {
      name,
      url,
      key,
      size: size ?? 0,
      subjectId: subjectId || null,
      userId: session.user.id as string,
    },
  });

  return NextResponse.json(resumo);
}

// DELETE — remove resumo
export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });

  const { id, key } = await req.json();

  const resumo = await prisma.resumo.findFirst({
    where: { id, userId: session.user.id as string },
  });

  if (!resumo) return NextResponse.json({ message: "Resumo não encontrado." }, { status: 404 });

  // Deleta do Uploadthing
  try {
    await fetch("https://uploadthing.com/api/deleteFile", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Uploadthing-Api-Key": process.env.UPLOADTHING_TOKEN ?? "",
      },
      body: JSON.stringify({ fileKeys: [key] }),
    });
  } catch {}

  await prisma.resumo.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
