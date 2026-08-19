import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "GEMINI_API_KEY não configurada." }, { status: 500 });

  const { topics } = await req.json();
  if (!topics || !topics.length) return NextResponse.json({ error: "Nenhum tópico enviado." }, { status: 400 });

  // Monta prompt para o Gemini
  const topicsList = topics.slice(0, 5).map((t: any, i: number) =>
    `${i + 1}. ${t.subjectName} — ${t.topicName} (retenção estimada: ${t.retentionPct}%, ${t.daysSinceStudy} dias sem estudar, ${t.accuracy}% de acerto histórico, peso no edital: ${t.subjectWeight}/10)`
  ).join("\n");

  const prompt = `Você é um coach especializado em preparação para concursos públicos brasileiros, especificamente para o cargo de Auditor-Fiscal da Receita Federal do Brasil (AFRFB).

O candidato tem os seguintes tópicos que precisam de revisão urgente, ordenados por prioridade (baseado na curva de esquecimento de Ebbinghaus e peso no edital):

${topicsList}

Para cada tópico, crie uma bateria de revisão específica e objetiva. Para cada um:

1. **Estratégia de revisão** (2-3 frases explicando por que este tópico precisa de atenção agora e o que focar)
2. **5 perguntas de fixação** no estilo de concursos (múltipla escolha ou verdadeiro/falso), com gabarito ao final
3. **Pontos críticos para memorizar** (3-5 bullets com os conceitos mais cobrados em provas)

Seja direto, técnico e focado no que cai em prova. Use linguagem de concursos.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("[Gemini API error]", data);
      return NextResponse.json({ error: "Erro na API do Gemini.", detail: data?.error?.message }, { status: 500 });
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    if (!text) return NextResponse.json({ error: "Gemini não retornou resposta." }, { status: 500 });

    return NextResponse.json({ suggestion: text });
  } catch (e) {
    console.error("[Gemini route error]", e);
    return NextResponse.json({ error: "Erro ao conectar com o Gemini." }, { status: 500 });
  }
}
