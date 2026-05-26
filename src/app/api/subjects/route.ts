import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json([], { status: 401 });

  const subjects = await prisma.subject.findMany({
    where: { userId: session.user.id as string },
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
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });

  const { name, editalWeight = 5, criticality = 5, recurrence = 0 } = await req.json();
  if (!name?.trim()) return NextResponse.json({ message: "Informe o nome." }, { status: 400 });

  const exists = await prisma.subject.findFirst({ where: { name: { equals: name.trim(), mode: "insensitive" }, userId: session.user.id as string } });
  if (exists) return NextResponse.json({ message: "Matéria já cadastrada." }, { status: 409 });

  const subject = await prisma.subject.create({
    data: { name: name.trim(), editalWeight, criticality, recurrence, userId: session.user.id as string },
  });
  return NextResponse.json(subject);
}