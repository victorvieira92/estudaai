import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json();
    if (!name || !email || !password)
      return NextResponse.json({ message: "Preencha todos os campos." }, { status: 400 });

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists)
      return NextResponse.json({ message: "Email já cadastrado." }, { status: 409 });

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { name, email, password: hashed } });

    return NextResponse.json({ id: user.id, name: user.name, email: user.email });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ message: "Erro interno." }, { status: 500 });
  }
}
