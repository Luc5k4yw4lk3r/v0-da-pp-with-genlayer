# { "Depends": "py-genlayer:test" }

from genlayer import *


class ProofOfArgentineanExperience(gl.Contract):
    def __init__(self):
        pass

    def _evaluate_experience(self, description: str, tags: list[str] = None) -> dict:
        """
        Internal method that performs the evaluation using the LLM.
        """
        tags_str = ", ".join(tags) if tags else "none"

        task = f"""
Analyze the following description and determine if it represents a culturally Argentine experience.

Description: {description}
Tags: {tags_str}

Instructions:
1. Analyze the description and determine if it reflects something typical or culturally Argentine.
2. Assign a score between 0 and 100:
   - 0–20: not Argentine or generic.
   - 21–50: partially Argentine or ambiguous.
   - 51–80: clearly Argentine (customs, foods, places, expressions).
   - 81–100: national icon or strong cultural symbol.
3. Write a brief message in English (max. 200 characters), with a friendly tone or local humor.
4. If the description mentions:
   - asado, mate, empanadas, dulce de leche → increase the score.
   - soccer, Bombonera, Messi, Maradona → increase the score.
   - tango, obelisco, colectivo, "che", "quilombo" → increase the score.
   - devconnect, crypto, ethereum, Vitalik in Buenos Aires → also positive.
5. If there is no clear local reference, low score and explanatory message.

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
    def evaluate(self, description: str, tags: list[str] = None) -> dict:
        """
        Evaluates if a description represents a culturally Argentine experience.

        Args:
            description: brief descriptive text of the experience
            tags: optional reference categories (food, sports, devconnect_crypto, etc.)

        Returns:
            dict with fields:
            - score: int (0 to 100)
            - message: str (brief text in English, max. 200 characters)
        """
        return self._evaluate_experience(description, tags)
