import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json([], { status: 401 });

  const reviews = await prisma.review.findMany({
    where: { pdf: { topic: { subject: { userId: session.user.id as string } } } },
    orderBy: { reviewDate: "asc" },
    include: { pdf: { include: { topic: { include: { subject: { select: { name: true } } } } } } },
  });
  return NextResponse.json(reviews);
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });

  const { id } = await req.json();
  await prisma.review.update({ where: { id }, data: { completed: true } });
  return NextResponse.json({ ok: true });
}
