# { "Depends": "py-genlayer:test" }

from genlayer import *


class ProofOfArgentineanExperience(gl.Contract):
    def __init__(self):
        pass

    def _evaluate_experience(self, description: str, tags: list[str] = None) -> dict:
        """
        Método interno que realiza la evaluación usando el LLM.
        """
        tags_str = ", ".join(tags) if tags else "ninguna"

        task = f"""
Analiza la siguiente descripción y determina si representa una experiencia culturalmente argentina.

Descripción: {description}
Tags: {tags_str}

Instrucciones:
1. Analiza la descripción y determina si refleja algo típico o culturalmente argentino.
2. Asigna un puntaje entre 0 y 100:
   - 0–20: nada argentino o genérico.
   - 21–50: parcialmente argentino o ambiguo.
   - 51–80: claramente argentino (costumbres, comidas, lugares, expresiones).
   - 81–100: ícono nacional o símbolo cultural fuerte.
3. Redacta un mensaje breve en español (máx. 200 caracteres), con tono amable o humor local.
4. Si la descripción menciona:
   - asado, mate, empanadas, dulce de leche → aumenta el score.
   - fútbol, Bombonera, Messi, Maradona → aumenta el score.
   - tango, obelisco, colectivo, "che", "quilombo" → aumenta el score.
   - devconnect, cripto, ethereum, Vitalik en Buenos Aires → también positivo.
5. Si no hay ninguna referencia local clara, score bajo y mensaje aclaratorio.

Responde ÚNICAMENTE con un JSON válido en este formato exacto:
{{
    "score": int,
    "message": str
}}

IMPORTANTE: 
- NO incluyas ningún texto fuera del JSON.
- La salida debe ser perfectamente parseable por un parser JSON.
- El mensaje debe tener máximo 200 caracteres.
- El mensaje debe estar en español.
        """

        def get_evaluation() -> dict:
            result = gl.nondet.exec_prompt(task, response_format="json")
            return result

        result = gl.eq_principle.strict_eq(get_evaluation)

        # Validar que el resultado tenga la estructura correcta
        if not isinstance(result, dict):
            raise Exception("Invalid response format from LLM")

        if "score" not in result or "message" not in result:
            raise Exception("Missing required fields in response")

        score = int(result["score"])
        message = str(result["message"])

        # Validar rangos
        if score < 0 or score > 100:
            raise Exception(f"Score out of range: {score}")

        if len(message) > 200:
            raise Exception(f"Message too long: {len(message)} characters")

        return {"score": score, "message": message}

    @gl.public.view
    def evaluate(self, description: str, tags: list[str] = None) -> dict:
        """
        Evalúa si una descripción representa una experiencia culturalmente argentina.

        Args:
            description: texto breve descriptivo de la experiencia
            tags: categorías de referencia opcionales (food, sports, devconnect_crypto, etc.)

        Returns:
            dict con campos:
            - score: int (0 a 100)
            - message: str (texto breve en español, máx. 200 caracteres)
        """
        return self._evaluate_experience(description, tags)
