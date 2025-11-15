# { "Depends": "py-genlayer:test" }

from genlayer import *


class ProofOfArgentineanExperience(gl.Contract):
    def __init__(self):
        pass

    def _evaluate_experience(
        self, description: str, tags: list[str] = None, image_quality: int = None
    ) -> dict:
        """
        Internal method that performs the evaluation using the LLM.
        image_quality: integer from 0 to 100 representing image quality (0.0 to 1.0 scaled by 100)
        """
        tags_str = ", ".join(tags) if tags else "none"
        num_tags = len(tags) if tags else 0

        # Calculate quality penalty info
        # image_quality is stored as 0-100 (representing 0.0-1.0)
        quality_info = ""
        if image_quality is not None:
            quality_float = image_quality / 100.0  # Convert back to 0.0-1.0 for display
            if quality_float < 0.5:
                penalty_percent = int((0.5 - quality_float) * 100)
                quality_info = f"\nImage Quality: {quality_float:.2f} (LOW QUALITY - will reduce score by approximately {penalty_percent}%)"
            else:
                quality_info = f"\nImage Quality: {quality_float:.2f} (acceptable)"

        task = f"""
Analyze the following description and determine if it represents a culturally Argentine experience.

Description: {description}
Tags: {tags_str}
Number of tags: {num_tags}{quality_info}

Instructions:
1. Analyze the description and determine if it reflects something typical or culturally Argentine.
2. Count how many distinct Argentine cultural elements are mentioned in the description (see list below).
3. Assign a BASE score between 0 and 100:
   - 0–20: not Argentine or generic.
   - 21–50: partially Argentine or ambiguous.
   - 51–80: clearly Argentine (customs, foods, places, expressions).
   - 81–95: national icon or strong cultural symbol with multiple elements.
   - 96–100: EXCEPTIONAL - requires MORE THAN 4 distinct Argentine cultural elements AND must be a national icon or extremely strong cultural symbol.

4. Apply adjustments:
   - If image_quality < 50 (representing 0.5 on a 0-100 scale): Reduce the BASE score proportionally. For example, if quality is 30 (representing 0.3, 20% below 0.5), reduce score by approximately 20%. If quality is 20 (representing 0.2), reduce by approximately 30%.
   - If there are 2 tags: Add +5 points to the adjusted score.
   - IMPORTANT: To reach 100 points, the description MUST mention MORE THAN 4 distinct Argentine cultural elements AND represent a national icon or extremely strong cultural symbol.

5. Write a brief message in English (max. 200 characters), with a friendly tone or local humor.

6. Argentine cultural elements to detect (count distinct mentions):
   - **Food**: asado, mate, empanadas, dulce de leche, alfajores, fernet con coca, yerba mate, choripán, milanesa, facturas, medialunas
   - **Traditions**: gaucho, poncho, folklore (zamba, chacarera, malambo), cumbia argentina, tango, colectivo, "che", "quilombo", abrazo argentino
   - **Touristic locations**: Obelisco, Caminito, Cataratas del Iguazú, Perito Moreno, Casa Rosada, Mar del Plata, Jardín Japonés, Bariloche, Ushuaia, La Boca, San Telmo
   - **Sports**: soccer, Bombonera, Messi, Maradona, pato (deporte nacional), rugby, tenis, camisetas de selección
   - **Famous people**: Messi, Maradona, Evita, Borges, Gardel, Favaloro, Che Guevara, Perón, Diego Armando Maradona
   - **Crypto**: Ethereum logos, Vitalik, devconnect, crypto conferences, blockchain events in Buenos Aires
   - **Easter eggs**: logos de Crecimiento, ZKZync, GenLayer, Ethereum, referencias ocultas culturales

7. If there is no clear local reference, low score and explanatory message.

Respond ONLY with a valid JSON in this exact format:
{{
    "score": int,
    "message": str
}}

IMPORTANT: 
- Do NOT include any text outside the JSON.
- The output must be perfectly parseable by a JSON parser.
- The message must have a maximum of 200 characters.
- The message must be in English.
- The final score must be between 0 and 100 after all adjustments.
- Remember: Score 100 requires MORE THAN 4 distinct cultural elements AND must be exceptional.
        """

        def get_evaluation() -> dict:
            result = gl.nondet.exec_prompt(task, response_format="json")
            return result

        result = gl.eq_principle.strict_eq(get_evaluation)

        # Validate that the result has the correct structure
        if not isinstance(result, dict):
            raise Exception("Invalid response format from LLM")

        if "score" not in result or "message" not in result:
            raise Exception("Missing required fields in response")

        score = int(result["score"])
        message = str(result["message"])

        # Validate ranges
        if score < 0 or score > 100:
            raise Exception(f"Score out of range: {score}")

        if len(message) > 200:
            raise Exception(f"Message too long: {len(message)} characters")

        return {"score": score, "message": message}

    @gl.public.view
    def evaluate(
        self, description: str, tags: list[str] = None, image_quality: int = None
    ) -> dict:
        """
        Evaluates if a description represents a culturally Argentine experience.

        Args:
            description: brief descriptive text of the experience
            tags: optional reference categories (food, sports, devconnect_crypto, etc.)
            image_quality: optional image quality score (0 to 100, representing 0.0 to 1.0)

        Returns:
            dict with fields:
            - score: int (0 to 100)
            - message: str (brief text in English, max. 200 characters)
        """
        return self._evaluate_experience(description, tags, image_quality)
