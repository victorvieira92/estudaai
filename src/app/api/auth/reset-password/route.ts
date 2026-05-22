import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  const { token, password } = await req.json();
  if (!token || !password) return NextResponse.json({ message: "Dados invalidos." }, { status: 400 });
  if (password.length < 6) return NextResponse.json({ message: "Senha deve ter pelo menos 6 caracteres." }, { status: 400 });

  const user = await prisma.user.findFirst({
    where: {
      resetToken: token,
      resetTokenExpiry: { gt: new Date() },
    },
  });

  if (!user) return NextResponse.json({ message: "Link invalido ou expirado." }, { status: 400 });

  const hashed = await bcrypt.hash(password, 10);

  await prisma.user.update({
    where: { id: user.id },
    data: { password: hashed, resetToken: null, resetTokenExpiry: null },
  });

  return NextResponse.json({ ok: true });
}
