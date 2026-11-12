import pytest
from fastapi.testclient import TestClient

import app.main as main
from app.config import settings

MANDATE = {
    "id": "m_1",
    "total_budget": "200.00",
    "per_txn_cap": "50.00",
    "allowed_merchants": ["m_101"],
    "allowed_categories": ["electronics"],
    "currency": "USD",
    "expires_at": "2099-01-01T00:00:00Z",
    "approval_threshold": "40.00",
}

INTENT = {
    "id": "p_1",
    "mandate_id": "m_1",
    "merchant_id": "m_101",
    "item_id": "p_204",
    "quantity": 1,
    "amount": "39.99",
    "currency": "USD",
    "quote_id": "",
    "agent_note": "",
}


def decision(kind="APPROVE", codes=None):
    return {
        "decision": kind,
        "reason_codes": codes or [],
        "risk": 0.1,
        "quote": {},
        "explanation": "test",
    }


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "database_path", str(tmp_path / "routes.db"))
    with TestClient(main.app) as test_client:
        yield test_client


@pytest.fixture
def approve(monkeypatch):
    monkeypatch.setattr(main, "evaluate", lambda *_: decision("APPROVE"))
    calls = []

    async def fake_create_order(amount, currency, reference_id, request_id):
        calls.append(amount)
        return {
            "id": "ORDER1",
            "links": [{"rel": "approve", "href": "https://paypal.test/approve"}],
        }

    async def fake_capture_order(order_id):
        return {
            "id": order_id,
            "purchase_units": [
                {
                    "payments": {
                        "captures": [
                            {
                                "id": "CAP1",
                                "amount": {"value": "39.99", "currency_code": "USD"},
                            }
                        ]
                    }
                }
            ],
        }

    monkeypatch.setattr(main.paypal, "create_order", fake_create_order)
    monkeypatch.setattr(main.paypal, "capture_order", fake_capture_order)
    return calls


def test_mandate_roundtrip(client):
    assert client.post("/mandates", json=MANDATE).status_code == 201
    body = client.get("/mandates/m_1").json()
    assert body["total_budget"] == "200.00"
    assert client.get("/mandates/missing").status_code == 404


def test_saving_the_same_mandate_twice_updates_it(client):
    assert client.post("/mandates", json=MANDATE).status_code == 201
    changed = {**MANDATE, "total_budget": "150.00"}
    assert client.post("/mandates", json=changed).status_code == 201
    assert client.get("/mandates/m_1").json()["total_budget"] == "150.00"


def test_catalog_is_seeded(client):
    items = client.get("/catalog").json()
    assert len(items) == 12
    assert any(item["item_id"] == "p_205" for item in items)


def test_approve_creates_order_and_capture_settles(client, approve):
    client.post("/mandates", json=MANDATE)
    body = client.post("/purchases", json={"intent": INTENT}).json()
    assert body["decision"]["decision"] == "APPROVE"
    assert body["approval_url"] == "https://paypal.test/approve"
    assert approve == ["39.99"]

    captured = client.post("/purchases/p_1/capture").json()
    assert captured["status"] == "CAPTURED"
    assert captured["violations"] == []


def test_block_stores_nothing_to_capture(client, monkeypatch):
    monkeypatch.setattr(main, "evaluate", lambda *_: decision("BLOCK", ["R1"]))
    client.post("/mandates", json=MANDATE)
    body = client.post("/purchases", json={"intent": INTENT}).json()
    assert body["decision"]["decision"] == "BLOCK"
    assert body["approval_url"] is None
    assert client.post("/purchases/p_1/capture").status_code == 409


def test_escalate_waits_for_a_human(client, approve, monkeypatch):
    monkeypatch.setattr(main, "evaluate", lambda *_: decision("ESCALATE", ["R8"]))
    client.post("/mandates", json=MANDATE)
    body = client.post("/purchases", json={"intent": INTENT}).json()
    assert body["decision"]["decision"] == "ESCALATE"

    assert client.post("/purchases/p_1/reject").json() == {"status": "REJECTED"}
    assert client.post("/purchases/p_1/approve").status_code == 409


def test_capture_needs_approval(client, approve, monkeypatch):
    client.post("/mandates", json=MANDATE)
    monkeypatch.setattr(main, "evaluate", lambda *_: decision("ESCALATE", ["R8"]))
    client.post("/purchases", json={"intent": INTENT})
    assert client.post("/purchases/p_1/capture").status_code == 409


def test_idempotency_key_returns_first_result(client, approve):
    client.post("/mandates", json=MANDATE)
    first = client.post(
        "/purchases", json={"intent": INTENT, "idempotency_key": "key-1"}
    ).json()
    second = client.post(
        "/purchases", json={"intent": INTENT, "idempotency_key": "key-1"}
    ).json()
    assert first["purchase_id"] == second["purchase_id"]
    assert len(client.get("/purchases").json()) == 1


def test_float_money_is_rejected(client):
    client.post("/mandates", json=MANDATE)
    bad = {**INTENT, "amount": 39.99}
    assert client.post("/purchases", json={"intent": bad}).status_code == 422


def test_unknown_mandate_is_404(client):
    assert client.post("/purchases", json={"intent": INTENT}).status_code == 404


def test_cors_allows_the_dashboard(client):
    response = client.options(
        "/catalog",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "*"


def test_audit_chain_verifies_after_decisions(client, approve):
    client.post("/mandates", json=MANDATE)
    client.post("/purchases", json={"intent": INTENT})
    body = client.post("/audit/verify").json()
    assert body["ok"] is True
    assert body["checked"] == 1


def test_demo_attacks_pass_the_state_rules_need(client, monkeypatch):
    seen = {}

    def capture(intent, mandate, state):
        seen[intent["id"]] = (intent, state)
        return decision("BLOCK", ["R1"])

    monkeypatch.setattr(main, "evaluate", capture)

    for attack in ("over_cap", "over_budget", "payee_switch", "injection"):
        body = client.post(f"/demo/attack/{attack}").json()
        intent, state = seen[body["purchase_id"]]
        if attack == "over_budget":
            assert state["spent_so_far"] == "180.00"
        if attack == "payee_switch":
            assert state["quote"]["payee"] == "attacker@evil.test"
        if attack == "injection":
            assert "IGNORE PREVIOUS INSTRUCTIONS" in intent["agent_note"]
            assert intent["amount"] == "500.00"
        if attack == "over_cap":
            assert intent["item_id"] == "p_205"
            assert intent["amount"] == "180.00"

    assert client.post("/demo/attack/nope").status_code == 404


def test_over_cap_names_the_blocking_rule_and_carries_a_risk_score(client):
    body = client.post("/demo/attack/over_cap").json()
    assert body["decision"]["decision"] == "BLOCK"
    assert body["decision"]["reason_codes"] == ["R1"]
    assert 0.0 <= body["decision"]["risk"] <= 1.0
