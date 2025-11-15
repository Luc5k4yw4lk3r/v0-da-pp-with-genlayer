# { "Depends": "py-genlayer:test" }

from genlayer import *


class ProofOfArgentineanExperience(gl.Contract):
    def __init__(self):
        pass

    def _evaluate_experience(
        self,
        description: str,
        tags: list[str] = None,
        show_consensus_logs: bool = False,
    ) -> dict:
        """
        Método interno que realiza la evaluación usando el LLM.
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
   - 51–80: clearly Argentine (customs, food, places, expressions).
   - 81–100: national icon or strong cultural symbol.
3. Write a brief message in English (max. 200 characters), with a friendly or local humorous tone.
4. If the description mentions:
   - asado, mate, empanadas, dulce de leche → increase the score.
   - football, Bombonera, Messi, Maradona → increase the score.
   - tango, obelisk, colectivo, "che", "quilombo" → increase the score.
   - devconnect, crypto, ethereum, Vitalik in Buenos Aires → also positive.
5. If there is no clear local reference, low score and explanatory message.

Respond ONLY with a valid JSON in this exact format:
{{
    "score": int,
    "message": str
}}

IMPORTANT: 
- DO NOT include any text outside the JSON.
- The output must be perfectly parseable by a JSON parser.
- The message must have a maximum of 200 characters.
- The message must be in English.
        """

        if show_consensus_logs:
            print("=" * 60)
            print("[CONSENSUS] Starting Argentine experience evaluation")
            print(f"[CONSENSUS] Description: {description[:100]}...")
            print(f"[CONSENSUS] Tags: {tags_str}")
            print("[CONSENSUS] Preparing prompt for LLM...")

        def get_evaluation() -> dict:
            if show_consensus_logs:
                print("[CONSENSUS] Executing evaluation with LLM...")
            result = gl.nondet.exec_prompt(task, response_format="json")
            if show_consensus_logs:
                score_val = (
                    result.get("score", "N/A") if isinstance(result, dict) else "N/A"
                )
                print(f"[CONSENSUS] Result obtained: score={score_val}")
            return result

        if show_consensus_logs:
            print("[CONSENSUS] Applying equivalence principle (strict_eq)...")
            print(
                "[CONSENSUS] The system will execute multiple evaluations until consensus is reached"
            )
            print(
                "[CONSENSUS] This may take several attempts until all executions match"
            )

        result = gl.eq_principle.strict_eq(get_evaluation)

        if show_consensus_logs:
            print("[CONSENSUS] ✓ Consensus reached - all executions match")

        # Validate that the result has the correct structure
        if not isinstance(result, dict):
            if show_consensus_logs:
                print("[CONSENSUS] ERROR: Invalid response format from LLM")
            raise Exception("Invalid response format from LLM")

        if "score" not in result or "message" not in result:
            if show_consensus_logs:
                print("[CONSENSUS] ERROR: Missing required fields (score, message)")
            raise Exception("Missing required fields in response")

        score = int(result["score"])
        message = str(result["message"])

        # Validate ranges
        if score < 0 or score > 100:
            if show_consensus_logs:
                print(f"[CONSENSUS] ERROR: Score out of valid range: {score}")
            raise Exception(f"Score out of range: {score}")

        if len(message) > 200:
            if show_consensus_logs:
                print(
                    f"[CONSENSUS] ERROR: Message too long: {len(message)} characters (max 200)"
                )
            raise Exception(f"Message too long: {len(message)} characters")

        if show_consensus_logs:
            print(f"[CONSENSUS] Validation completed successfully")
            print(f"[CONSENSUS] Final score: {score}/100")
            print(f"[CONSENSUS] Message: {message[:80]}...")
            print("=" * 60)
            print("[CONSENSUS] Consensus process completed successfully")
            print("=" * 60)

        return {"score": score, "message": message}

    @gl.public.view
    def evaluate(self, description: str, tags: list[str] = None) -> dict:
        """
        Evaluates if a description represents a culturally Argentine experience.
        View version (read-only, does not generate a trackable transaction).

        Args:
            description: brief descriptive text of the experience
            tags: optional reference categories (food, sports, devconnect_crypto, etc.)

        Returns:
            dict with fields:
            - score: int (0 to 100)
            - message: str (brief text in English, max. 200 characters)
        """
        return self._evaluate_experience(description, tags, show_consensus_logs=False)

    @gl.public.write
    def evaluate_with_consensus_tracking(
        self, description: str, tags: list[str] = None
    ) -> dict:
        """
        Evaluates and generates a trackable transaction to monitor the consensus process.

        IMPORTANT: This method generates a transaction that can be tracked in the frontend
        to see the states: PENDING, PROPOSING, COMMITTING, REVEALING, ACCEPTED, FINALIZED

        The consensus process logs will be displayed in the contract console using print().

        Args:
            description: brief descriptive text of the experience
            tags: optional reference categories

        Returns:
            dict with fields:
            - score: int (0 to 100)
            - message: str (brief text in English, max. 200 characters)
        """
        return self._evaluate_experience(description, tags, show_consensus_logs=True)
