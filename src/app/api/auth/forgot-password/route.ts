import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";
import crypto from "crypto";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ message: "Email obrigatorio." }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ ok: true }); // nao revela se email existe

  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 1000 * 60 * 60); // 1 hora

  await prisma.user.update({
    where: { email },
    data: { resetToken: token, resetTokenExpiry: expires },
  });

  const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`;

  await resend.emails.send({
    from: "EstudaAi <onboarding@resend.dev>",
    to: email,
    subject: "Redefinir senha — EstudaAi",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
        <h1 style="font-size:24px;font-weight:700;color:#111827;margin-bottom:8px">Redefinir senha</h1>
        <p style="color:#6b7280;margin-bottom:24px">Clique no botão abaixo para criar uma nova senha. O link expira em 1 hora.</p>
        <a href="${resetUrl}" style="display:inline-block;background:#111827;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">
          Redefinir senha
        </a>
        <p style="color:#9ca3af;font-size:12px;margin-top:24px">Se voce nao solicitou isso, ignore este email.</p>
      </div>
    `,
  });

  return NextResponse.json({ ok: true });
}
