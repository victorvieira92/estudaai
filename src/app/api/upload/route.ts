import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Nao autorizado" }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ message: "Nenhum arquivo enviado" }, { status: 400 });

    const token = process.env.UPLOADTHING_TOKEN ?? "";

    // Pede URL de upload para o Uploadthing
    const presignRes = await fetch("https://uploadthing.com/api/uploadFiles", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Uploadthing-Api-Key": token,
        "X-Uploadthing-Version": "6.4.0",
      },
      body: JSON.stringify({
        files: [{ name: file.name, size: file.size, type: file.type }],
        acl: "public-read",
        contentDisposition: "inline",
      }),
    });

    if (!presignRes.ok) {
      const txt = await presignRes.text();
      throw new Error(`Uploadthing error: ${txt}`);
    }

    const presignData = await presignRes.json();
    const uploadInfo = presignData.data?.[0] ?? presignData[0];

    if (!uploadInfo?.url) throw new Error("URL de upload nao recebida");

    // Faz o upload para S3
    const s3Form = new FormData();
    if (uploadInfo.fields) {
      Object.entries(uploadInfo.fields).forEach(([k, v]) => s3Form.append(k, v as string));
    }
    s3Form.append("file", file);

    const s3Res = await fetch(uploadInfo.url, { method: "POST", body: s3Form });
    if (!s3Res.ok && s3Res.status !== 204) {
      throw new Error(`S3 upload error: ${s3Res.status}`);
    }

    const key = uploadInfo.key ?? uploadInfo.fileKey ?? "";
    const fileUrl = `https://utfs.io/f/${key}`;

    return NextResponse.json({ url: fileUrl, key, name: file.name });
  } catch (e: any) {
    console.error("[upload]", e);
    return NextResponse.json({ message: e.message ?? "Erro no upload" }, { status: 500 });
  }
}
