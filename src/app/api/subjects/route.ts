import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json([], { status: 401 });

  try {
    const subjects = await prisma.subject.findMany({
      where:   { userId: session.user.id as string },
      orderBy: { name: "asc" },
      include: {
        topics: {
          orderBy: { name: "asc" },
          include: {
            pdfs: {
              orderBy: { title: "asc" },
              select: {
                id: true, title: true, completed: true,
                totalPages: true, lastPageStudied: true,
                studyHours: true, questions: true,
                correctQuestions: true, wrongQuestions: true,
              },
            },
          },
        },
      },
    });
    return NextResponse.json(subjects);
  } catch (e) {
    console.error("[subjects GET]", e);
    return NextResponse.json([], { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
  const uid = session.user.id as string;

  try {
    const body = await req.json();
    const { name, editalWeight, criticality, recurrence = 0 } = body;

    if (!name?.trim())
      return NextResponse.json({ message: "Informe o nome." }, { status: 400 });

    if (name.trim().length > 100)
      return NextResponse.json({ message: "Nome muito longo (máx. 100 caracteres)." }, { status: 400 });

    // Valida ranges de peso e criticidade
    const ew   = Math.min(10, Math.max(1, parseInt(String(editalWeight)) || 5));
    const crit = Math.min(10, Math.max(1, parseInt(String(criticality))  || 5));
    const rec  = Math.max(0, parseInt(String(recurrence)) || 0);

    const exists = await prisma.subject.findFirst({
      where: { name: { equals: name.trim(), mode: "insensitive" }, userId: uid },
    });
    if (exists) return NextResponse.json({ message: "Matéria já cadastrada." }, { status: 409 });

    const subject = await prisma.subject.create({
      data: { name: name.trim(), editalWeight: ew, criticality: crit, recurrence: rec, userId: uid },
    });
    return NextResponse.json(subject);
  } catch (e) {
    console.error("[subjects POST]", e);
    return NextResponse.json({ message: "Erro interno." }, { status: 500 });
  }
}
