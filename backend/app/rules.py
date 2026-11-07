"""R1-R12: the deterministic decision engine. Owner: Tejas. Branch: rules/engine.

Pure functions only. No database, no network, no file reads, no clock.
Everything it needs arrives in the three arguments. Contract: docs/CONTRACT.md
"""


def evaluate(intent: dict, mandate: dict, state: dict) -> dict:
    """Decide one purchase.

    Returns {"decision", "reason_codes", "risk", "quote", "explanation"}.

    - decision is exactly "APPROVE", "BLOCK" or "ESCALATE".
    - Return every rule code that fired. BLOCK beats ESCALATE.
    - Use Decimal for every money comparison.
    - Read time only from state["now"].
    - risk is passed through; it never changes the decision.
    """
    raise NotImplementedError("Tejas: implement R1-R12, see docs/CONTRACT.md")
