import { GoogleGenAI } from "@google/genai";
import { UploadedFile, Message, ChartData } from "../types";

// Helper to sanitize parsing
const cleanJsonString = (str: string) => {
  // Remove markdown code blocks
  let cleaned = str.replace(/```json\s*/g, "").replace(/```\s*/g, "");
  return cleaned;
};

export const generateResponse = async (
  history: Message[],
  files: UploadedFile[],
  userPrompt: string
): Promise<{ text: string; chartData?: ChartData }> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing. Please set it in the environment.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // RAG Context Construction with Metadata
  const context = files.map(f => `
--- INÍCIO DO ARQUIVO: ${f.name} ---
METADADOS:
- Categoria/Setor: ${f.category}
- Descrição do Arquivo: ${f.description || "Não informada"}
- Fonte dos Dados: ${f.source || "Não informada"}
- Período dos Dados: ${f.period || "Não informado"}
- Tipo/Nome dos Casos: ${f.caseName || "Não informado"}
- Tipo de Arquivo: ${f.type}

CONTEÚDO:
${f.content.slice(0, 150000)} 
--- FIM DO ARQUIVO: ${f.name} ---
`).join("\n");

  const systemInstruction = `Você é o Gonçalinho, um analista de dados especialista em cidades brasileiras e indicadores de saúde e sociais.

DADOS RELEVANTES ENCONTRADOS NOS ARQUIVOS DO USUÁRIO:
${context || "Nenhum arquivo carregado ainda."}

INSTRUÇÕES CRÍTICAS PARA ANÁLISE:
1. Os dados acima contêm as informações REAIS. Leia com atenção cada linha e cruze informações entre diferentes arquivos se necessário (ex: pegar população de um arquivo e casos de outro).
2. FORMATO DOS DADOS: Geralmente, cada linha representa um município/entidade. As colunas podem ser meses ou anos.
3. PROBLEMAS DE CODIFICAÇÃO: "So" = "São", "Gonalo" = "Gonçalo", "MUNICÖPIO" = "MUNICÍPIO". Corrija mentalmente.
4. Para perguntas sobre um ANO ESPECÍFICO (ex: 2022):
   - Identifique as colunas do ano.
   - SOME TODOS os valores dessas colunas se a pergunta for sobre totais.
   - Mostre o raciocínio brevemente: "jan: X + fev: Y... = Total".
5. Para taxas (ex: incidência): (Total de Casos / População) * 1000 (ou 100.000, conforme padrão do indicador).
6. Se não encontrar o município exato, procure por nomes similares.
7. ATENÇÃO: Os valores numéricos podem estar formatados de formas variadas.
8. NUNCA invente números. Use apenas os dados fornecidos acima.

FORMATO DE RESPOSTA - SEJA CONCISO:
❌ NÃO liste todos os meses ou valores intermediários a menos que seja explicitamente solicitado.
✅ Vá direto ao ponto: responda a pergunta de forma objetiva.
✅ Exemplo bom: "O mês com mais ocorrências foi dezembro de 2022, com 3 casos."

GERAÇÃO DE GRÁFICOS - IMPORTANTE:
Quando o usuário pedir "faça um gráfico", "mostre em gráfico", "visualize", "gráfico", ou similar, você DEVE retornar APENAS um objeto JSON válido.
NÃO escreva introduções como "Aqui está o gráfico". Apenas o JSON.

FORMATO EXATO ESPERADO (JSON):
{
  "message": "Texto explicando o gráfico...",
  "chart": {
    "type": "bar", // Opções: "bar", "line", "pie", "area"
    "title": "Título do Gráfico",
    "description": "Breve descrição (opcional)",
    "data": [
      {"label": "Jan/25", "Série A": 2, "Série B": 5}
    ]
  }
}

REGRAS PARA GRÁFICOS:
- Use "label" para o eixo X (categorias).
- Para os valores, use nomes descritivos nas chaves (ex: "São Gonçalo", "Bahia") se houver comparação, ou "value" se for série única.
- NUNCA use markdown ou code blocks ao retornar JSON.
- Retorne JSON puro começando com { e terminando com }.

FORMATO DE RESPOSTA NORMAL (sem gráfico):
Se NÃO for pedido um gráfico, responda em texto markdown normal explicando os dados e cálculos de forma CONCISA E DIRETA. Não retorne JSON se não for gráfico.
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        ...history.filter(m => m.role !== 'model' || !m.isLoading).map(m => ({
           role: m.role,
           parts: [{ text: m.text }]
        })),
        { role: 'user', parts: [{ text: userPrompt }] }
      ],
      config: {
        systemInstruction: systemInstruction,
      }
    });

    const rawText = response.text || "";
    
    // Attempt to extract JSON object using regex if strict parsing fails initially
    // This finds the first outermost {} block
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      try {
        const jsonStr = cleanJsonString(jsonMatch[0]);
        const parsed = JSON.parse(jsonStr);
        
        // Validate minimal structure to ensure it's our chart schema and not just random JSON
        if (parsed.chart || parsed.message) {
          return {
            text: parsed.message || parsed.answer || "Análise realizada:",
            chartData: parsed.chart
          };
        }
      } catch (e) {
        console.warn("Found JSON-like block but failed to parse:", e);
        // Fallback to raw text if parsing fails
      }
    }

    // Default text response
    return {
      text: rawText
    };

  } catch (error) {
    console.error("Gemini Error:", error);
    return {
      text: "Ocorreu um erro ao processar sua solicitação. Verifique seus arquivos."
    };
  }
};