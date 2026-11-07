import json


def canonical(obj) -> str:
    """Deterministic JSON. Key order and whitespace must never change a signature or a hash."""
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
