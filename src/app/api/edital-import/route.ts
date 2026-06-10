// src/app/api/edital-import/route.ts
// Importa edital do TEC Concursos via scraping do HTML público
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Extrai texto limpo removendo HTML e decodificando entidades HTML
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    // Entidades nomeadas comuns
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Caracteres especiais do português
    .replace(/&aacute;/g, "á").replace(/&Aacute;/g, "Á")
    .replace(/&agrave;/g, "à").replace(/&Agrave;/g, "À")
    .replace(/&acirc;/g, "â").replace(/&Acirc;/g, "Â")
    .replace(/&atilde;/g, "ã").replace(/&Atilde;/g, "Ã")
    .replace(/&auml;/g, "ä").replace(/&Auml;/g, "Ä")
    .replace(/&eacute;/g, "é").replace(/&Eacute;/g, "É")
    .replace(/&egrave;/g, "è").replace(/&Egrave;/g, "È")
    .replace(/&ecirc;/g, "ê").replace(/&Ecirc;/g, "Ê")
    .replace(/&euml;/g, "ë").replace(/&Euml;/g, "Ë")
    .replace(/&iacute;/g, "í").replace(/&Iacute;/g, "Í")
    .replace(/&igrave;/g, "ì").replace(/&Igrave;/g, "Ì")
    .replace(/&icirc;/g, "î").replace(/&Icirc;/g, "Î")
    .replace(/&iuml;/g, "ï").replace(/&Iuml;/g, "Ï")
    .replace(/&oacute;/g, "ó").replace(/&Oacute;/g, "Ó")
    .replace(/&ograve;/g, "ò").replace(/&Ograve;/g, "Ò")
    .replace(/&ocirc;/g, "ô").replace(/&Ocirc;/g, "Ô")
    .replace(/&otilde;/g, "õ").replace(/&Otilde;/g, "Õ")
    .replace(/&ouml;/g, "ö").replace(/&Ouml;/g, "Ö")
    .replace(/&uacute;/g, "ú").replace(/&Uacute;/g, "Ú")
    .replace(/&ugrave;/g, "ù").replace(/&Ugrave;/g, "Ù")
    .replace(/&ucirc;/g, "û").replace(/&Ucirc;/g, "Û")
    .replace(/&uuml;/g, "ü").replace(/&Uuml;/g, "Ü")
    .replace(/&ccedil;/g, "ç").replace(/&Ccedil;/g, "Ç")
    .replace(/&ntilde;/g, "ñ").replace(/&Ntilde;/g, "Ñ")
    // Entidades numéricas decimais e hexadecimais
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .trim();
}

// Transforma URL do guia para URL do edital verticalizado
function toVerticalizedUrl(url: string): string {
  const clean = url.trim().replace(/\/$/, "");
  if (clean.endsWith("/edital-verticalizado")) return clean;
  return clean + "/edital-verticalizado";
}

interface ParsedEdital {
  title:       string;
  modulos:     { nome: string; disciplinas: { nome: string; topicos: string[] }[] }[];
}

// Parser do HTML do edital verticalizado do TEC
function parseEditalHtml(html: string, pageTitle: string): ParsedEdital {
  const modulos: ParsedEdital["modulos"] = [];
  let currentModulo = "";
  let currentDisciplina = "";
  let currentTopicos: string[] = [];

  // Remove scripts e estilos
  const clean = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");

  // Extrai o conteúdo entre "Conteúdo Programático" e "Um dos primeiros passos"
  const startIdx = clean.indexOf("Conteúdo Programático");
  const endIdx   = clean.indexOf("Um dos primeiros passos");
  const body     = startIdx > -1 ? clean.slice(startIdx, endIdx > -1 ? endIdx : undefined) : clean;

  // Processa linha a linha
  const lines = body
    .split(/\n|<br\s*\/?>/gi)
    .map(l => stripHtml(l).trim())
    .filter(l => l.length > 0);

  const pushDisciplina = () => {
    if (currentDisciplina && currentTopicos.length > 0) {
      let mod = modulos.find(m => m.nome === currentModulo);
      if (!mod) { mod = { nome: currentModulo, disciplinas: [] }; modulos.push(mod); }
      const existing = mod.disciplinas.find(d => d.nome === currentDisciplina);
      if (existing) { existing.topicos.push(...currentTopicos); }
      else { mod.disciplinas.push({ nome: currentDisciplina, topicos: [...currentTopicos] }); }
      currentTopicos = [];
    }
  };

  for (const line of lines) {
    // Detecta MÓDULO (ex: "MÓDULO I - CONHECIMENTOS BÁSICOS")
    if (/^MÓDULO\s+[IVX]+/i.test(line)) {
      pushDisciplina();
      currentModulo = line.replace(/\*/g, "").trim();
      currentDisciplina = "";
      continue;
    }

    // Detecta disciplina (ex: "Língua Portuguesa:" ou "**Direito Tributário:**")
    const discMatch = line.match(/^\*?\*?([A-ZÀ-Ü][^:]{2,60}):\*?\*?$/);
    if (discMatch && !/^\d+\./.test(line)) {
      pushDisciplina();
      currentDisciplina = discMatch[1].replace(/\*/g, "").trim();
      continue;
    }

    // Tópicos: linhas numeradas ou separadas por ponto e vírgula
    if (currentDisciplina && line.length > 5 && !line.startsWith("MÓDULO")) {
      // Divide por numeração (1. 2. 3.) ou por ponto seguido de espaço e letra maiúscula
      const numbered = line.match(/\d+\.\s+[A-ZÀ-Ü]/);
      if (numbered) {
        // Extrai cada item numerado
        const items = line.split(/(?=\d+\.\s+)/).map(s => s.replace(/^\d+\.\s+/, "").trim()).filter(s => s.length > 3);
        currentTopicos.push(...items);
      } else {
        // Tópico livre — divide por ". " onde o próximo char é maiúscula
        const parts = line.split(/\.\s+(?=[A-ZÀ-Ü])/).map(s => s.trim()).filter(s => s.length > 3);
        if (parts.length > 1) {
          currentTopicos.push(...parts);
        } else if (line.length > 3) {
          currentTopicos.push(line);
        }
      }
    }
  }
  pushDisciplina();

  // Se não detectou módulos, cria um módulo único
  if (modulos.length === 0 && currentDisciplina) {
    modulos.push({ nome: "MÓDULO ÚNICO", disciplinas: [{ nome: currentDisciplina, topicos: currentTopicos }] });
  }

  return { title: pageTitle, modulos };
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const uid = session.user.id as string;

  const { url } = await req.json();
  if (!url?.trim()) return NextResponse.json({ error: "URL obrigatória." }, { status: 400 });

  // Valida que é URL do TEC
  if (!url.includes("tecconcursos.com.br")) {
    return NextResponse.json({ error: "URL deve ser do TEC Concursos (tecconcursos.com.br)." }, { status: 400 });
  }

  const vertUrl = toVerticalizedUrl(url);

  // Faz scraping
  let html = "";
  let pageTitle = "";
  try {
    const res = await fetch(vertUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; EstudaAi/1.0)" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();

    // Extrai título da página
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    pageTitle = titleMatch ? stripHtml(titleMatch[1]).replace(" | Tec Concursos", "").trim() : "Edital importado";
  } catch (e: any) {
    return NextResponse.json({ error: `Erro ao acessar o TEC: ${e.message}` }, { status: 502 });
  }

  // Faz parse
  const parsed = parseEditalHtml(html, pageTitle);

  if (parsed.modulos.length === 0) {
    return NextResponse.json({ error: "Não foi possível extrair o conteúdo programático. Verifique se a URL está correta e aponta para um guia com edital verticalizado." }, { status: 422 });
  }

  // Salva no banco — deleta os custom anteriores e recria
  await prisma.editalTopico.deleteMany({ where: { userId: uid, source: "custom" } });

  let totalTopics = 0;
  const toCreate: any[] = [];

  parsed.modulos.forEach((mod, mi) => {
    mod.disciplinas.forEach((disc, di) => {
      disc.topicos.forEach((topico, ti) => {
        toCreate.push({
          userId:    uid,
          source:    "custom",
          modulo:    mod.nome,
          disciplina: disc.nome,
          topico:    topico.slice(0, 500),
          ordem:     mi * 1000 + di * 100 + ti,
        });
        totalTopics++;
      });
    });
  });

  await prisma.editalTopico.createMany({ data: toCreate, skipDuplicates: true });

  // Salva metadados da importação
  await prisma.userEditalImport.upsert({
    where:  { userId_sourceUrl: { userId: uid, sourceUrl: vertUrl } } as any,
    create: { userId: uid, title: pageTitle, sourceUrl: vertUrl, totalTopics },
    update: { title: pageTitle, importedAt: new Date(), totalTopics },
  });

  return NextResponse.json({
    ok: true,
    title: pageTitle,
    totalTopics,
    modulos: parsed.modulos.length,
    preview: parsed.modulos.map(m => ({
      nome: m.nome,
      disciplinas: m.disciplinas.map(d => ({ nome: d.nome, topicos: d.topicos.length })),
    })),
  });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json([], { status: 401 });
  const uid = session.user.id as string;

  // Retorna edital importado do usuário
  const topicos = await prisma.editalTopico.findMany({
    where:   { userId: uid, source: "custom" },
    orderBy: { ordem: "asc" },
  });

  // Agrupa por módulo e disciplina
  const moduloMap: Record<string, Record<string, any[]>> = {};
  topicos.forEach(t => {
    if (!moduloMap[t.modulo]) moduloMap[t.modulo] = {};
    if (!moduloMap[t.modulo][t.disciplina]) moduloMap[t.modulo][t.disciplina] = [];
    moduloMap[t.modulo][t.disciplina].push(t);
  });

  const modulos = Object.entries(moduloMap).map(([modulo, discs]) => ({
    modulo,
    disciplinas: Object.entries(discs).map(([disciplina, tops]) => ({
      nome: disciplina,
      topicos: tops.map(t => ({
        id:          t.id,
        nome:        t.topico,
        concluido:   t.concluido,
        questoes:    t.questoes,
        acertos:     t.acertos,
        erros:       t.erros,
        ultimoEstudo: t.ultimoEstudo,
      })),
    })),
  }));

  const lastImport = await (prisma as any).userEditalImport?.findFirst({
    where:   { userId: uid },
    orderBy: { importedAt: "desc" },
  }).catch(() => null);

  return NextResponse.json({ modulos, lastImport });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const uid = session.user.id as string;

  const { id, concluido, questoes, acertos, erros } = await req.json();

  const topico = await prisma.editalTopico.findFirst({ where: { id, userId: uid, source: "custom" } });
  if (!topico) return NextResponse.json({ error: "Não encontrado." }, { status: 404 });

  const updated = await prisma.editalTopico.update({
    where: { id },
    data: {
      ...(concluido !== undefined && { concluido }),
      ...(questoes  !== undefined && { questoes  }),
      ...(acertos   !== undefined && { acertos   }),
      ...(erros     !== undefined && { erros     }),
      ultimoEstudo: new Date(),
    },
  });

  return NextResponse.json(updated);
}
