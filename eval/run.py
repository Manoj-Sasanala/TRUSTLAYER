"""Adversarial evaluation runner for TRUSTLAYER.

Owner: Tejas. Branch: rules/engine.
Evaluates the 40 adversarial attack scenarios from eval/attacks.json against the
deterministic rules engine (app.rules.evaluate).
"""

import json
import sys
import time
from pathlib import Path

# Add backend/ to sys.path so app modules import cleanly from root
ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT_DIR / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

try:
    from app.rules import evaluate
except ImportError as err:
    print(f"Error importing app.rules: {err}", file=sys.stderr)
    sys.exit(1)


def run_evaluation(attacks_path: Path | None = None) -> int:
    if attacks_path is None:
        attacks_path = Path(__file__).resolve().parent / "attacks.json"

    if not attacks_path.is_file():
        print(
            f"[-] eval/attacks.json not found at {attacks_path}.\n"
            "    Notice: eval/attacks.json is owned by Adarsh (docs/proof).\n"
            "    The evaluation runner depends on Adarsh's file to run the 40 attack corpus.",
            file=sys.stderr,
        )
        return 1

    try:
        with open(attacks_path, "r", encoding="utf-8") as f:
            cases = json.load(f)
    except Exception as err:
        print(f"Error reading {attacks_path}: {err}", file=sys.stderr)
        return 1

    total = len(cases)
    if total == 0:
        print("No test cases found in attacks.json.", file=sys.stderr)
        return 1

    print(f"\nEvaluating {total} attack cases against app.rules.evaluate...\n")
    print(
        f"| {'ID':<6} | {'Type':<22} | {'Expected':<8} | {'Actual':<8} | {'Pass':<6} | {'Reason Codes':<18} | {'Latency':<8} |"
    )
    print(
        f"|{'-' * 8}|{'-' * 24}|{'-' * 10}|{'-' * 10}|{'-' * 8}|{'-' * 20}|{'-' * 10}|"
    )

    passed_count = 0
    blocked_count = 0

    for case in cases:
        case_id = case.get("id", "-")
        attack_type = case.get("type", "-")
        expected_decision = case.get("expected", "BLOCK")

        t0 = time.perf_counter()
        try:
            res = evaluate(case["intent"], case["mandate"], case["state"])
            actual_decision = res.get("decision", "ERROR")
            reasons = ",".join(res.get("reason_codes", []))
        except Exception as ex:
            actual_decision = "ERROR"
            reasons = f"ERR: {type(ex).__name__}"

        latency_ms = (time.perf_counter() - t0) * 1000

        is_blocked = actual_decision in ("BLOCK", "ESCALATE")
        if is_blocked:
            blocked_count += 1

        is_passed = (actual_decision == expected_decision)
        if is_passed:
            passed_count += 1
            pass_str = "PASS"
        else:
            pass_str = "FAIL"

        print(
            f"| {case_id:<6} | {attack_type:<22} | {expected_decision:<8} | {actual_decision:<8} | {pass_str:<6} | {reasons:<18} | {latency_ms:>6.2f}ms |"
        )

    percent = (blocked_count / total) * 100 if total > 0 else 0
    print(f"\nBlock rate: {blocked_count}/{total} ({percent:.0f}%)\n")

    # Exits with 1 if any attack was missed (not blocked/escalated or did not match expected)
    if blocked_count < total or passed_count < total:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(run_evaluation())
