import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
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
  
  // OTIMIZAÇÃO: Reduzimos o limite de caracteres por arquivo para evitar Payload Too Large ou Timeouts.
  // 30.000 chars ~= 7-8 mil tokens por arquivo, o que é um bom equilíbrio.
  const context = files.map(f => `
--- INÍCIO DO ARQUIVO: ${f.name} ---
METADADOS:
- Categoria: ${f.category}
- Descrição: ${f.description || "N/A"}
- Fonte: ${f.source || "N/A"}
- Período: ${f.period || "N/A"}
- Indicador: ${f.caseName || "N/A"}

CONTEÚDO (Trecho):
${f.content.slice(0, 30000)} 
--- FIM DO ARQUIVO: ${f.name} ---
`).join("\n");

  const systemInstruction = `Você é o Gonçalinho, um analista de dados da cidade de São Gonçalo dos Campos - Bahia.
  
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
5. Para taxas (ex: incidência): (Total de Casos / População) * 1000.
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
        // Configurações de segurança para evitar bloqueio falso em dados médicos/saúde
        safetySettings: [
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' }
        ]
      }
    });

    const rawText = response.text || "";
    
    // Attempt to extract JSON
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      try {
        const jsonStr = cleanJsonString(jsonMatch[0]);
        const parsed = JSON.parse(jsonStr);
        if (parsed.chart || parsed.message) {
          return {
            text: parsed.message || parsed.answer || "Análise realizada:",
            chartData: parsed.chart
          };
        }
      } catch (e) {
        console.warn("JSON parse failed, falling back to text.");
      }
    }

    return { text: rawText };

  } catch (error: any) {
    console.error("Gemini Error Full:", error);
    
    // Tenta extrair mensagem de erro legível
    let errorMessage = "Ocorreu um erro ao processar sua solicitação.";
    
    if (error.message) {
      if (error.message.includes("400")) errorMessage = "Erro nos dados enviados (400). O arquivo pode ser muito grande.";
      else if (error.message.includes("429")) errorMessage = "Muitas requisições. Tente novamente em alguns segundos.";
      else if (error.message.includes("500")) errorMessage = "Erro interno no Google Gemini. Tente novamente.";
      else if (error.message.includes("SAFETY")) errorMessage = "A resposta foi bloqueada pelos filtros de segurança da IA.";
      else errorMessage = `Erro na IA: ${error.message}`;
    }

    return {
      text: `⚠️ **${errorMessage}**\n\nTente enviar arquivos menores ou fazer perguntas mais específicas.`
    };
  }
};
