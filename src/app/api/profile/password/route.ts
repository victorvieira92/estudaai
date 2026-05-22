import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
  }

  try {
    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ message: "Preencha todos os campos." }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ message: "A nova senha deve ter pelo menos 6 caracteres." }, { status: 400 });
    }

    // Busca o usuário
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ message: "Usuário não encontrado." }, { status: 404 });
    }

    // Verifica a senha atual
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) {
      return NextResponse.json({ message: "Senha atual incorreta." }, { status: 400 });
    }

    // Salva a nova senha
    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { email: session.user.email },
      data: { password: hashed },
    });

    return NextResponse.json({ message: "Senha alterada com sucesso." });
  } catch (e) {
    console.error("[PATCH /api/profile/password]", e);
    return NextResponse.json({ message: "Erro interno." }, { status: 500 });
  }
}
