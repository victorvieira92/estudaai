// src/app/api/import-subjects/parse/route.ts
// Parse de .xlsx sem nenhuma dependência externa — usa apenas Node.js built-ins
// .xlsx é um ZIP contendo XMLs — descompactamos com o módulo nativo 'zlib'
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Readable } from "stream";
import zlib from "zlib";
import { promisify } from "util";

const inflate = promisify(zlib.inflate);
const inflateRaw = promisify(zlib.inflateRaw);

interface PdfInput     { title: string; }
interface TopicInput   { topic: string; pdfs: PdfInput[]; }
interface SubjectInput { subject: string; topics: TopicInput[]; editalWeight: number; criticality: number; }

// ── ZIP parser mínimo (sem dependências) ────────────────────────────────────
// Lê o Central Directory do ZIP e extrai os arquivos necessários
async function readZipFiles(buf: Buffer): Promise<Map<string, Buffer>> {
  const files = new Map<string, Buffer>();

  // Busca o End of Central Directory (EOCD): assinatura 0x06054b50
  let eocdOffset = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf[i] === 0x50 && buf[i+1] === 0x4b && buf[i+2] === 0x05 && buf[i+3] === 0x06) {
      eocdOffset = i; break;
    }
  }
  if (eocdOffset < 0) throw new Error("Arquivo ZIP inválido");

  const cdOffset = buf.readUInt32LE(eocdOffset + 16);
  const cdCount  = buf.readUInt16LE(eocdOffset + 10);

  let pos = cdOffset;
  for (let i = 0; i < cdCount; i++) {
    if (buf.readUInt32LE(pos) !== 0x02014b50) break;

    const compression  = buf.readUInt16LE(pos + 10);
    const compSize     = buf.readUInt32LE(pos + 20);
    const uncompSize   = buf.readUInt32LE(pos + 24);
    const fnLen        = buf.readUInt16LE(pos + 28);
    const extraLen     = buf.readUInt16LE(pos + 30);
    const commentLen   = buf.readUInt16LE(pos + 32);
    const localOffset  = buf.readUInt32LE(pos + 42);
    const name         = buf.slice(pos + 46, pos + 46 + fnLen).toString("utf8");

    pos += 46 + fnLen + extraLen + commentLen;

    // Lê o Local File Header
    const lhExtraLen = buf.readUInt16LE(localOffset + 28);
    const lhFnLen    = buf.readUInt16LE(localOffset + 26);
    const dataStart  = localOffset + 30 + lhFnLen + lhExtraLen;
    const compData   = buf.slice(dataStart, dataStart + compSize);

    let content: Buffer;
    if (compression === 0) {
      content = compData; // stored
    } else if (compression === 8) {
      content = await inflateRaw(compData) as Buffer; // deflate
    } else {
      continue; // método não suportado — pula
    }

    files.set(name, content);
  }

  return files;
}

// ── XML helpers ─────────────────────────────────────────────────────────────
function extractAll(xml: string, tag: string): string[] {
  const results: string[] = [];
  const re = new RegExp(`<${tag}[\\s>]([\\s\\S]*?)<\\/${tag}>`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) results.push(m[1]);
  return results;
}

function attr(xml: string, name: string): string {
  const m = new RegExp(`${name}="([^"]*)"`, "i").exec(xml);
  return m ? m[1] : "";
}

function innerText(xml: string): string {
  return xml.replace(/<[^>]+>/g, "").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).trim();
}

// ── Parse shared strings ─────────────────────────────────────────────────────
function parseSharedStrings(xml: string): string[] {
  return extractAll(xml, "si").map(si => {
    return extractAll(si, "t").map(innerText).join("");
  });
}

// ── Parse sheet names + rId ─────────────────────────────────────────────────
function parseSheetNames(xml: string): { name: string; rId: string }[] {
  const sheets: { name: string; rId: string }[] = [];
  const re = /<sheet\s([^/]+)\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const name = attr(m[1], "name");
    const rId  = attr(m[1], "r:id") || attr(m[1], "rid");
    if (name && rId) sheets.push({ name, rId });
  }
  return sheets;
}

// ── Parse rels ──────────────────────────────────────────────────────────────
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

// ── Parse sheet rows ─────────────────────────────────────────────────────────
function parseSheetRows(xml: string, shared: string[]): string[][] {
  const rows: string[][] = [];
  for (const rowXml of extractAll(xml, "row")) {
    const cells: string[] = [];
    const cellRe = /<c\s([^>]*)>([\s\S]*?)<\/c>/g;
    let cm: RegExpExecArray | null;
    while ((cm = cellRe.exec(rowXml)) !== null) {
      const attrs  = cm[1];
      const inner  = cm[2];
      const isStr  = /t="s"/.test(attrs);
      const refM   = /r="([A-Z]+)\d+"/.exec(attrs);
      let value    = "";

      if (isStr) {
        const vM = /<v>(\d+)<\/v>/.exec(inner);
        if (vM) value = shared[parseInt(vM[1])] ?? "";
      } else {
        const vM = /<v>([^<]*)<\/v>/.exec(inner);
        if (vM) value = vM[1].trim();
        const tM = /<t[^>]*>([^<]*)<\/t>/.exec(inner);
        if (tM) value = tM[1].trim();
      }

      if (refM) {
        const col = refM[1].split("").reduce((a, c) => a * 26 + c.charCodeAt(0) - 64, 0) - 1;
        while (cells.length <= col) cells.push("");
        cells[col] = value;
      } else {
        cells.push(value);
      }
    }
    rows.push(cells);
  }
  return rows;
}

// ── Converte rows em SubjectInput ────────────────────────────────────────────
function rowsToSubject(name: string, rows: string[][]): SubjectInput | null {
  const first = rows[0] ?? [];
  const hasHeader = first.some(c => /tópico|topico|pdf|aula|conteúdo|material/i.test(c));
  const data  = hasHeader ? rows.slice(1) : rows;
  const hasB  = data.some(r => (r[1] ?? "").trim() !== "");
  const map   = new Map<string, PdfInput[]>();
  let last    = name;

  for (const row of data) {
    const a = (row[0] ?? "").trim();
    const b = (row[1] ?? "").trim();
    if (!a && !b) continue;
    const topic = hasB ? (a || last) : name;
    const pdf   = hasB ? b : a;
    if (a && hasB) last = a;
    if (!pdf) continue;
    if (!map.has(topic)) map.set(topic, []);
    map.get(topic)!.push({ title: pdf });
  }

  if (!map.size) return null;
  return {
    subject: name,
    topics: Array.from(map.entries()).map(([topic, pdfs]) => ({ topic, pdfs })),
    editalWeight: 5, criticality: 5,
  };
}

// ── Handler ──────────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return NextResponse.json({ ok: false, error: "Não autorizado." }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ ok: false, error: "Nenhum arquivo enviado." }, { status: 400 });
    if (!file.name.toLowerCase().endsWith(".xlsx"))
      return NextResponse.json({ ok: false, error: "Envie um arquivo .xlsx." }, { status: 400 });

    const buf   = Buffer.from(await file.arrayBuffer());
    const files = await readZipFiles(buf);

    const ssFile = files.get("xl/sharedStrings.xml");
    const shared = ssFile ? parseSharedStrings(ssFile.toString("utf8")) : [];

    const wbFile  = files.get("xl/workbook.xml");
    const relFile = files.get("xl/_rels/workbook.xml.rels");
    if (!wbFile || !relFile)
      return NextResponse.json({ ok: false, error: "Arquivo xlsx corrompido." }, { status: 400 });

    const sheets = parseSheetNames(wbFile.toString("utf8"));
    const rels   = parseRels(relFile.toString("utf8"));
    const result: SubjectInput[] = [];

    for (const sheet of sheets) {
      const target = rels.get(sheet.rId) ?? "";
      const path   = target.startsWith("xl/") ? target : `xl/${target}`;
      const sf     = files.get(path);
      if (!sf) continue;
      const rows = parseSheetRows(sf.toString("utf8"), shared);
      const sub  = rowsToSubject(sheet.name, rows);
      if (sub) result.push(sub);
    }

    if (!result.length)
      return NextResponse.json({ ok: false, error: "Nenhuma matéria encontrada. Verifique o formato da planilha." });

    return NextResponse.json({ ok: true, subjects: result });
  } catch (e) {
    console.error("[parse xlsx]", e);
    return NextResponse.json({ ok: false, error: "Erro ao processar o arquivo." }, { status: 500 });
  }
}
