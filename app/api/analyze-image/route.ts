import { generateObject } from "ai"
import { z } from "zod"

const imageAnalysisSchema = z.object({
  description: z.string().max(300).describe("descripción en español (máx. 300 caracteres)"),
  tags: z
    .array(z.enum(["food", "sports", "customs", "touristic", "famous_people", "cultural_shocks", "devconnect_crypto"]))
    .describe("categorías detectadas"),
  image_quality: z.number().min(0).max(1).describe("valor 0–1"),
  is_ai_generated: z.boolean().describe("True si parece generada por IA"),
  metadata: z.record(z.any()).optional().describe("info opcional (dimensiones, color promedio, etc.)"),
})

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get("image") as File

    if (!file) {
      return Response.json({ error: "No se proporcionó ninguna imagen" }, { status: 400 })
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64 = buffer.toString("base64")

    const prompt = `
Analiza esta imagen y genera un JSON con la siguiente estructura:

1. **description**: Una oración que describe lo que se ve en la imagen, en español neutro. Máximo 300 caracteres.
   Ejemplo: "Grupo de amigos tomando mate en la costanera con vista al río."

2. **tags**: Array de categorías detectadas. Opciones:
   - "food" → comidas, bebidas típicas, parrilla, mate, empanadas, dulce de leche
   - "sports" → fútbol, camisetas, estadios, pelotas, hinchadas
   - "customs" → gestos, mates, abrazos, reuniones, sobremesa, asados
   - "touristic" → lugares conocidos (Obelisco, Caminito, Cataratas, Perito Moreno, etc.)
   - "famous_people" → personajes reconocibles (Messi, Maradona, Evita, etc.)
   - "cultural_shocks" → situaciones graciosas, contrastes o costumbres raras
   - "devconnect_crypto" → personas con laptops, conferencias, logos Ethereum, Vitalik, etc.

3. **image_quality**: Número entre 0 y 1 que representa la calidad de la foto (iluminación, nitidez, enfoque).

4. **is_ai_generated**: true si la imagen parece generada por IA (texturas no naturales, sombras imposibles, letras deformadas, arte digital, estilo render).

5. **metadata**: Objeto opcional con información adicional como dimensiones, color dominante, etc.

IMPORTANTE: 
- La descripción debe ser corta pero natural, sin juicios de valor.
- Si no puedes determinar categorías, deja el array de tags vacío.
- Este análisis NO evalúa el grado de argentinidad, solo describe la imagen.
`

    const { object } = await generateObject({
      model: "anthropic/claude-sonnet-4.5",
      schema: imageAnalysisSchema,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image",
              image: base64,
              mimeType: file.type,
            },
          ],
        },
      ],
      maxOutputTokens: 2000,
    })

    return Response.json(object)
  } catch (error: any) {
    console.error("[v0] Error analyzing image:", error)
    return Response.json({ error: error.message || "Error al analizar la imagen" }, { status: 500 })
  }
}
