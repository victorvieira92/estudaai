// src/app/api/import-subjects/parse/route.ts
// Recebe o arquivo .xlsx via multipart, faz o parse no servidor e devolve o JSON estruturado
// O xlsx é uma dependência de servidor — não vai para o bundle do cliente
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
// @ts-ignore — xlsx pode não ter types perfeitos em todos os setups
import * as XLSX from "xlsx";

interface PdfInput     { title: string; }
interface TopicInput   { topic: string; pdfs: PdfInput[]; }
interface SubjectInput { subject: string; topics: TopicInput[]; editalWeight: number; criticality: number; }

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });

  try {
    const formData = await req.formData();
    const file     = formData.get("file") as File | null;

    if (!file)
      return NextResponse.json({ ok: false, error: "Nenhum arquivo enviado." }, { status: 400 });

    if (!file.name.endsWith(".xlsx"))
      return NextResponse.json({ ok: false, error: "Formato inválido. Envie um arquivo .xlsx." }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb     = XLSX.read(buffer, { type: "buffer" });

    const result: SubjectInput[] = [];

    for (const sheetName of wb.SheetNames) {
      const ws   = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: "" }) as string[][];

      // Detecta e pula linha de cabeçalho
      const firstRow = rows[0] ?? [];
      const hasHeader = firstRow.some((c: string) =>
        typeof c === "string" && /tópico|topico|pdf|aula|conteúdo|material/i.test(c)
      );
      const dataRows = hasHeader ? rows.slice(1) : rows;

      // Detecta formato: tem coluna B preenchida?
      const hasColB = dataRows.some(r => String(r[1] ?? "").trim() !== "");

      const topicsMap = new Map<string, PdfInput[]>();
      let lastTopic = sheetName;

      for (const row of dataRows) {
        const colA = String(row[0] ?? "").trim();
        const colB = String(row[1] ?? "").trim();
        if (!colA && !colB) continue;

        let topicName: string;
        let pdfTitle:  string;

        if (hasColB) {
          // Formato: col A = tópico, col B = PDF
          topicName = colA || lastTopic;
          pdfTitle  = colB;
          if (colA) lastTopic = colA;
        } else {
          // Formato simples: col A = PDF, tópico = nome da aba
          topicName = sheetName;
          pdfTitle  = colA;
        }

        if (!pdfTitle) continue;
        if (!topicsMap.has(topicName)) topicsMap.set(topicName, []);
        topicsMap.get(topicName)!.push({ title: pdfTitle });
      }

      if (topicsMap.size > 0) {
        result.push({
          subject:      sheetName,
          topics:       Array.from(topicsMap.entries()).map(([topic, pdfs]) => ({ topic, pdfs })),
          editalWeight: 5,
          criticality:  5,
        });
      }
    }

    if (result.length === 0)
      return NextResponse.json({ ok: false, error: "Nenhuma matéria encontrada. Verifique o formato da planilha." });

    return NextResponse.json({ ok: true, subjects: result });
  } catch (e) {
    console.error("[import-subjects/parse]", e);
    return NextResponse.json({ ok: false, error: "Erro ao processar o arquivo." }, { status: 500 });
  }
}
