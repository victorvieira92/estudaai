// src/app/api/import-subjects/parse/route.ts
// Parse de .xlsx sem dependências externas — usa apenas Node.js built-ins
// zlib.inflateRawSync é síncrono e 100% suportado no Vercel Node.js runtime
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { inflateRawSync } from "zlib";

interface PdfInput     { title: string; }
interface TopicInput   { topic: string; pdfs: PdfInput[]; }
interface SubjectInput { subject: string; topics: TopicInput[]; editalWeight: number; criticality: number; }

// ── ZIP reader usando Central Directory (robusto, ignora Local Header flags) ──
function readZip(buf: Buffer): Map<string, Buffer> {
  const files = new Map<string, Buffer>();

  // Localiza End of Central Directory assinando de trás para frente
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("ZIP inválido: EOCD não encontrado");

  const cdCount  = buf.readUInt16LE(eocd + 10);
  const cdOffset = buf.readUInt32LE(eocd + 16);

  let pos = cdOffset;
  for (let i = 0; i < cdCount; i++) {
    if (buf.readUInt32LE(pos) !== 0x02014b50) break;

    const compression = buf.readUInt16LE(pos + 10);
    const compSize    = buf.readUInt32LE(pos + 20); // do Central Directory (confiável)
    const fnLen       = buf.readUInt16LE(pos + 28);
    const extraLen    = buf.readUInt16LE(pos + 30);
    const commentLen  = buf.readUInt16LE(pos + 32);
    const localOffset = buf.readUInt32LE(pos + 42);
    const name        = buf.slice(pos + 46, pos + 46 + fnLen).toString("utf8");

    pos += 46 + fnLen + extraLen + commentLen;

    // Lê do Local File Header apenas os tamanhos dos campos variáveis
    const lhFnLen    = buf.readUInt16LE(localOffset + 26);
    const lhExtraLen = buf.readUInt16LE(localOffset + 28);
    const dataStart  = localOffset + 30 + lhFnLen + lhExtraLen;

    const compData = buf.slice(dataStart, dataStart + compSize);

    let content: Buffer;
    if (compression === 0) {
      content = compData;
    } else if (compression === 8) {
      try {
        // inflateRawSync: síncrono, sem promisify, suportado em todos os runtimes Node.js
        content = inflateRawSync(compData);
      } catch {
        continue;
      }
    } else {
      continue;
    }

    files.set(name, content);
  }

  return files;
}

// ── XML helpers ───────────────────────────────────────────────────────────────
function extractAll(xml: string, tag: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`<${tag}[\\s>]([\\s\\S]*?)<\\/${tag}>`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) out.push(m[1]);
  return out;
}

function attr(str: string, name: string): string {
  const m = new RegExp(`(?:^|\\s)${name}="([^"]*)"`, "i").exec(str);
  return m ? m[1] : "";
}

function parseSharedStrings(xml: string): string[] {
  return extractAll(xml, "si").map(si =>
    extractAll(si, "t").map(t => t.replace(/<[^>]+>/g, "").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))).join("")
  );
}

function parseSheetNames(xml: string): { name: string; rId: string }[] {
  const out: { name: string; rId: string }[] = [];
  const re = /<sheet\s([^/]+)\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const name = attr(m[1], "name");
    const rId  = attr(m[1], "r:id") || attr(m[1], "rid");
    if (name && rId) out.push({ name, rId });
  }
  return out;
}

function parseRels(xml: string): Map<string, string> {
  const map = new Map<string, string>();
  const re = /<Relationship\s([^/]+)\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const id     = attr(m[1], "Id");
    const target = attr(m[1], "Target");
    if (id && target) map.set(id, target);
  }
  return map;
}

function parseRows(xml: string, shared: string[]): string[][] {
  const rows: string[][] = [];
  const rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
  let rm: RegExpExecArray | null;
  while ((rm = rowRe.exec(xml)) !== null) {
    const cells: string[] = [];
    const cellRe = /<c\s([^>]*)>([\s\S]*?)<\/c>/g;
    let cm: RegExpExecArray | null;
    while ((cm = cellRe.exec(rm[1])) !== null) {
      const attrs = cm[1]; const inner = cm[2];
      const isStr = /t="s"/.test(attrs);
      const refM  = /r="([A-Z]+)\d+"/.exec(attrs);
      let value   = "";
      if (isStr) {
        const vM = /<v>(\d+)<\/v>/.exec(inner);
        if (vM) value = shared[parseInt(vM[1])] ?? "";
      } else {
        const tM = /<t[^>]*>([^<]*)<\/t>/.exec(inner);
        const vM = /<v>([^<]*)<\/v>/.exec(inner);
        value = (tM ?? vM)?.[1]?.trim() ?? "";
      }
      if (refM) {
        const col = refM[1].split("").reduce((a, c) => a * 26 + c.charCodeAt(0) - 64, 0) - 1;
        while (cells.length <= col) cells.push("");
        cells[col] = value;
      } else {
        cells.push(value);
      }
    }
    if (cells.some(c => c)) rows.push(cells);
  }
  return rows;
}

function rowsToSubject(name: string, rows: string[][]): SubjectInput | null {
  const first     = rows[0] ?? [];
  const hasHeader = first.some(c => /tópico|topico|pdf|aula|conteúdo|material/i.test(c));
  const data      = hasHeader ? rows.slice(1) : rows;
  const hasColB   = data.some(r => (r[1] ?? "").trim() !== "");
  const map       = new Map<string, PdfInput[]>();
  let last        = name;

  for (const row of data) {
    const a = (row[0] ?? "").trim();
    const b = (row[1] ?? "").trim();
    if (!a && !b) continue;
    const topic = hasColB ? (a || last) : name;
    const pdf   = hasColB ? b : a;
    if (a && hasColB) last = a;
    if (!pdf) continue;
    if (!map.has(topic)) map.set(topic, []);
    map.get(topic)!.push({ title: pdf });
  }

  if (!map.size) return null;
  return {
    subject:      name,
    topics:       Array.from(map.entries()).map(([topic, pdfs]) => ({ topic, pdfs })),
    editalWeight: 5,
    criticality:  5,
  };
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });

  try {
    const formData = await req.formData();
    const file     = formData.get("file") as File | null;
    if (!file)
      return NextResponse.json({ ok: false, error: "Nenhum arquivo enviado." }, { status: 400 });
    if (!file.name.toLowerCase().endsWith(".xlsx"))
      return NextResponse.json({ ok: false, error: "Envie um arquivo .xlsx." }, { status: 400 });

    const buf   = Buffer.from(await file.arrayBuffer());
    const files = readZip(buf);

    const ssFile = files.get("xl/sharedStrings.xml");
    const shared = ssFile ? parseSharedStrings(ssFile.toString("utf8")) : [];

    const wbFile  = files.get("xl/workbook.xml");
    const relFile = files.get("xl/_rels/workbook.xml.rels");
    if (!wbFile || !relFile)
      return NextResponse.json({ ok: false, error: "Arquivo xlsx inválido ou corrompido." }, { status: 400 });

    const sheets = parseSheetNames(wbFile.toString("utf8"));
    const rels   = parseRels(relFile.toString("utf8"));
    const result: SubjectInput[] = [];

    for (const sheet of sheets) {
      const target = rels.get(sheet.rId) ?? "";
      const path   = target.startsWith("xl/") ? target : `xl/${target}`;
      const sf     = files.get(path);
      if (!sf) continue;
      const rows = parseRows(sf.toString("utf8"), shared);
      const sub  = rowsToSubject(sheet.name, rows);
      if (sub) result.push(sub);
    }

    if (!result.length)
      return NextResponse.json({ ok: false, error: "Nenhuma matéria encontrada. Verifique o formato da planilha." });

    return NextResponse.json({ ok: true, subjects: result });
  } catch (e: any) {
    console.error("[parse xlsx]", e?.message ?? e);
    return NextResponse.json({ ok: false, error: `Erro interno: ${e?.message ?? "desconhecido"}` }, { status: 500 });
  }
}
