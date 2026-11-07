from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.money import parse_amount


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class PurchaseIntent(StrictModel):
    """What the agent proposes. It may not carry a payee, a merchant email, or an amount it invented."""

    id: str
    mandate_id: str
    merchant_id: str
    item_id: str
    quantity: int = Field(gt=0)
    amount: str
    currency: Literal["USD"] = "USD"
    quote_id: str
    agent_note: str = ""

    @field_validator("amount")
    @classmethod
    def _money(cls, value: str) -> str:
        parse_amount(value)
        return value


class Mandate(StrictModel):
    """The user's spending rules. Every limit is money as a 2-decimal string."""

    id: str
    total_budget: str
    per_txn_cap: str
    allowed_merchants: list[str]
    allowed_categories: list[str] = []
    currency: Literal["USD"] = "USD"
    expires_at: datetime
    approval_threshold: str

    @field_validator("total_budget", "per_txn_cap", "approval_threshold")
    @classmethod
    def _money(cls, value: str) -> str:
        parse_amount(value)
        return value


class Quote(StrictModel):
    quote_id: str
    item_id: str
    merchant_id: str
    amount: str
    currency: Literal["USD"] = "USD"

    @field_validator("amount")
    @classmethod
    def _money(cls, value: str) -> str:
        parse_amount(value)
        return value


class Decision(StrictModel):
    decision: Literal["APPROVE", "BLOCK", "ESCALATE"]
    reason_codes: list[str]
    risk: float = Field(ge=0.0, le=1.0)
    quote: dict
    explanation: str


class PurchaseCreate(StrictModel):
    intent: PurchaseIntent
    idempotency_key: str | None = None


class AgentRequest(StrictModel):
    user_request: str = Field(min_length=1)
    mandate_id: str
