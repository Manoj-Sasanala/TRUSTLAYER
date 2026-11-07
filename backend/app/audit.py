import hashlib
import json
from datetime import datetime, timezone

from app.canonical import canonical
from app.db import get_db

GENESIS = "0" * 64


def record_hash(body: dict, prev_hash: str) -> str:
    return hashlib.sha256(
        canonical({**body, "prev_hash": prev_hash}).encode()
    ).hexdigest()


def append(kind: str, payload: dict) -> dict:
    """Link one record to the previous one. The chain is append-only."""
    conn = get_db()
    try:
        last = conn.execute(
            "SELECT seq, hash FROM audit_chain ORDER BY seq DESC LIMIT 1"
        ).fetchone()
        seq = last["seq"] + 1 if last else 1
        prev_hash = last["hash"] if last else GENESIS
        body = {
            "seq": seq,
            "ts": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "kind": kind,
            "payload": payload,
        }
        digest = record_hash(body, prev_hash)
        conn.execute(
            "INSERT INTO audit_chain(seq, ts, kind, payload, prev_hash, hash)"
            " VALUES (?, ?, ?, ?, ?, ?)",
            (
                seq,
                body["ts"],
                kind,
                canonical(payload),
                prev_hash,
                digest,
            ),
        )
        conn.commit()
        return {**body, "prev_hash": prev_hash, "hash": digest}
    finally:
        conn.close()


def verify() -> dict:
    """Recompute every link in order. Report the first record that does not match."""
    conn = get_db()
    try:
        rows = conn.execute("SELECT * FROM audit_chain ORDER BY seq").fetchall()
    finally:
        conn.close()

    prev_hash = GENESIS
    for index, row in enumerate(rows, start=1):
        body = {
            "seq": row["seq"],
            "ts": row["ts"],
            "kind": row["kind"],
            "payload": json.loads(row["payload"]),
        }
        if row["prev_hash"] != prev_hash or record_hash(body, prev_hash) != row["hash"]:
            return {"ok": False, "checked": index, "first_bad_seq": row["seq"]}
        prev_hash = row["hash"]

    return {"ok": True, "checked": len(rows), "first_bad_seq": None}
