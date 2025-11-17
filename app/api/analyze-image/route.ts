import { generateObject } from "ai"
import { z } from "zod"
import { TRACKS } from "@/lib/redis"

const imageAnalysisSchema = z.object({
  description: z.string().max(300).describe("description in English (max. 300 characters)"),
  tags: z
    .array(z.enum(TRACKS as [string, ...string[]]))
    .max(2)
    .describe("detected categories (maximum 2, prioritize the most preponderant)"),
  image_quality: z.number().min(0).max(1).describe("value 0–1"),
  is_ai_generated: z.boolean().describe("True if it appears to be AI-generated"),
  metadata: z.record(z.any()).optional().describe("optional info (dimensions, average color, etc.)"),
})

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get("image") as File

    if (!file) {
      return Response.json({ error: "No image provided" }, { status: 400 })
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64 = buffer.toString("base64")

    const prompt = `
Analyze this image and generate a JSON with the following structure:

1. **description**: A sentence describing what is seen in the image, in neutral English. Maximum 300 characters.
   Example: "Group of friends drinking mate at the waterfront with a view of the river."

2. **tags**: Array of detected categories. You must use EXACTLY one of these values (respecting capitalization and spaces):
   - "Steak" → steak, asado, grilled meat, Argentine barbecue, parrilla, bife de chorizo, entraña, asado argentino, beef cuts, meat grilling
   - "food" → foods, typical drinks, barbecue, mate, empanadas, dulce de leche
   - "traditions" → gestures, mates, hugs, gatherings, after-dinner conversations, asados, customs
   - "Cultural shocks" → funny situations, contrasts or rare customs
   - "Touristic locations" → well-known places (Obelisco, Caminito, Cataratas, Perito Moreno, etc.)
   - "Sports" → soccer, jerseys, stadiums, balls, fans
   - "Famous people" → recognizable figures (Messi, Maradona, Evita, etc.)
   - "Crypto" → Ethereum logos, Vitalik, crypto-related content
   - "Easter eggs" → hidden references, special details, cultural nods, logos of Crecimiento, ZKZync, GenLayer, Ethereum

3. **image_quality**: Number between 0 and 1 representing the photo quality (lighting, sharpness, focus).

4. **is_ai_generated**: true if the image appears to be AI-generated (unnatural textures, impossible shadows, deformed letters, digital art, render style).

5. **metadata**: Optional object with additional information such as dimensions, dominant color, etc.

IMPORTANT: 
- The description should be short but natural, without value judgments.
- You can assign a MAXIMUM of 2 tags. Prioritize the most preponderant category first. If multiple categories are present, select only the 2 most relevant ones, ordered by importance.
- If you cannot determine categories, leave the tags array empty.
- This analysis does NOT evaluate the degree of Argentineness, it only describes the image.
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

    // Reject AI-generated images
    if (object.is_ai_generated) {
      return Response.json(
        { error: "AI-generated images are not allowed to participate in the game" },
        { status: 400 }
      )
    }

    return Response.json(object)
  } catch (error: any) {
    console.error("[v0] Error analyzing image:", error)
    return Response.json({ error: error.message || "Error analyzing the image" }, { status: 500 })
  }
}
