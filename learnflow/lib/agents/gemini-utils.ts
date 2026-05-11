import { GoogleGenerativeAI } from "@google/generative-ai";
import { z, ZodSchema } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

/**
 * Wrapper for calling Gemini Flash with JSON parsing, Zod validation, and retry logic.
 */
export async function callGeminiWithJsonRetry<T>(
  prompt: string,
  schema: z.ZodSchema<T>,
  maxRetries = 3
): Promise<T> {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  let currentPrompt = prompt;
  let retries = 0;

  // Convertim schema Zod într-o reprezentare text (JSON Schema) pe care modelul s-o înțeleagă
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const jsonSchemaStr = JSON.stringify(zodToJsonSchema(schema as any), null, 2);

  while (retries <= maxRetries) {
    try {
      const result = await model.generateContent(currentPrompt);
      const text = result.response.text();

      // Extragem porțiunea JSON în caz că e învelit în block markdown (```json ... ```)
      const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error("Nu s-a putut găsi un obiect sau array JSON în răspuns.");
      }

      const parsedJson = JSON.parse(jsonMatch[0]);

      // Validăm și parsăm datele conform schemei Zod
      const validatedData = schema.parse(parsedJson);
      
      return validatedData;
    } catch (error) {
      retries++;
      console.error(`Eroare la parsare/validare JSON (încercarea ${retries}/${maxRetries}):`, error);

      if (retries > maxRetries) {
        throw new Error(`Eșec după ${maxRetries} încercări. Ultima eroare: ${error instanceof Error ? error.message : String(error)}`);
      }

      // Augmentare prompt pentru reîncercare
      currentPrompt = `
Răspunsul anterior nu a fost JSON valid. Returnează DOAR JSON respectând exact acest format: 
${jsonSchemaStr}

Nu include niciun alt text, explicație sau blocuri Markdown.
Răspunde strict la următorul prompt:
---
${prompt}
      `.trim();
    }
  }

  throw new Error("A apărut o eroare neașteptată în bucla de retry.");
}
