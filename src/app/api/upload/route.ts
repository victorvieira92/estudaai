import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { UTApi } from "uploadthing/server";

const utapi = new UTApi();

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ message: "Nao autorizado" }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return NextResponse.json({ message: "Nenhum arquivo enviado" }, { status: 400 });

    const response = await utapi.uploadFiles(file);

    if (response.error) {
      throw new Error(response.error.message);
    }

    return NextResponse.json({
      url: response.data.url,
      key: response.data.key,
      name: response.data.name,
    });
  } catch (e: any) {
    console.error("[upload]", e);
    return NextResponse.json({ message: e.message ?? "Erro no upload" }, { status: 500 });
  }
}
