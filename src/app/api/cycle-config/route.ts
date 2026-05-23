import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json(null, { status: 401 });

  const config = await prisma.weeklyCycleConfig.findUnique({
    where: { userId: session.user.id as string },
  });

  return NextResponse.json(config);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Não autorizado." }, { status: 401 });

  const body = await req.json();

  // Garante que só aceita floats ou null para cada dia
  const data = {
    sun: body.sun != null ? parseFloat(body.sun) : null,
    mon: body.mon != null ? parseFloat(body.mon) : null,
    tue: body.tue != null ? parseFloat(body.tue) : null,
    wed: body.wed != null ? parseFloat(body.wed) : null,
    thu: body.thu != null ? parseFloat(body.thu) : null,
    fri: body.fri != null ? parseFloat(body.fri) : null,
    sat: body.sat != null ? parseFloat(body.sat) : null,
  };

  const config = await prisma.weeklyCycleConfig.upsert({
    where: { userId: session.user.id as string },
    update: data,
    create: { userId: session.user.id as string, ...data },
  });

  return NextResponse.json(config);
}
