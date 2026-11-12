import { isMoney, type AttackResult, type AttackType, type AuditResult, type FeedRow, type Mandate, type SpendResult, type CaptureResult } from "./api.ts";

export const MERCHANTS = [
  { id: "m_101", name: "Volt & Wire" },
  { id: "m_102", name: "Page & Ink" },
  { id: "m_103", name: "Hearth Goods" },
] as const;

function relativeIso(secondsAgo: number): string {
  return new Date(Date.now() - secondsAgo * 1000).toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function openingMandate(): Mandate {
  return {
    id: "m_1",
    total_budget: "200.00",
    per_txn_cap: "50.00",
    allowed_merchants: ["m_101", "m_102", "m_103"],
    allowed_categories: ["electronics", "books", "home"],
    currency: "USD",
    expires_at: "2026-12-31T00:00:00Z",
    approval_threshold: "40.00",
  };
}

function buildSeedFeed(): FeedRow[] {
  return [
    {
      id: "p_demo_5",
      time: relativeIso(2),
      item: "Wireless Earbuds",
      amount: "24.99",
      decision: "APPROVE",
      reason_codes: [],
      risk: 0.12,
    },
    {
      id: "p_demo_4",
      time: relativeIso(4),
      item: "Laptop Sleeve",
      amount: "49.99",
      decision: "BLOCK",
      reason_codes: ["R1", "R2"],
      risk: 0.96,
    },
    {
      id: "p_demo_3",
      time: relativeIso(6),
      item: "Gift Card",
      amount: "10.00",
      decision: "ESCALATE",
      reason_codes: ["R5"],
      risk: 0.67,
    },
    {
      id: "p_demo_2",
      time: relativeIso(8),
      item: "Smart Watch",
      amount: "79.99",
      decision: "APPROVE",
      reason_codes: [],
      risk: 0.18,
    },
    {
      id: "p_demo_1",
      time: relativeIso(10),
      item: "Bluetooth Speaker",
      amount: "59.99",
      decision: "BLOCK",
      reason_codes: ["R7"],
      risk: 0.94,
    },
  ];
}

const ATTACKS: Record<AttackType, Omit<FeedRow, "id" | "time"> & { explanation: string }> = {
  over_cap: {
    item: "Studio Monitor Speaker",
    amount: "180.00",
    decision: "BLOCK",
    reason_codes: ["R1"],
    risk: 0.86,
    explanation: "180.00 is above the 50.00 per-purchase cap.",
  },
  over_budget: {
    item: "Bluetooth Speaker",
    amount: "45.00",
    decision: "BLOCK",
    reason_codes: ["R2"],
    risk: 0.71,
    explanation: "Spent 180.00 plus 45.00 is above the 200.00 budget.",
  },
  payee_switch: {
    item: "Over-Ear Headphones",
    amount: "39.99",
    decision: "BLOCK",
    reason_codes: ["R7"],
    risk: 0.64,
    explanation: "The locked quote payee does not match the merchant registry.",
  },
  injection: {
    item: "Studio Monitor Speaker",
    amount: "500.00",
    decision: "BLOCK",
    reason_codes: ["R1", "R2", "R5", "R9"],
    risk: 0.92,
    explanation: "Injection detected in request.",
  },
};

let feed: FeedRow[] = buildSeedFeed();
let savedMandate = openingMandate();
let auditChecked = 12;
let attackCount = 0;
const listeners = new Set<() => void>();

function assertDemoData(): void {
  for (const row of feed) {
    if (!isMoney(row.amount)) {
      throw new Error(`Mock amount must stay a two-decimal string: ${row.amount}`);
    }
  }
  for (const attack of Object.values(ATTACKS)) {
    if (!isMoney(attack.amount)) {
      throw new Error(`Mock attack amount must stay a two-decimal string: ${attack.amount}`);
    }
  }
}

assertDemoData();

function cloneFeed(): FeedRow[] {
  return feed.map((row) => ({ ...row, reason_codes: [...row.reason_codes] }));
}

export function listMockDecisions(): FeedRow[] {
  return cloneFeed();
}

export function subscribeMock(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(): void {
  for (const listener of listeners) listener();
}

export function mockSaveMandate(mandate: Mandate): Mandate {
  savedMandate = {
    ...mandate,
    allowed_merchants: [...mandate.allowed_merchants],
    allowed_categories: [...mandate.allowed_categories],
  };
  return {
    ...savedMandate,
    allowed_merchants: [...savedMandate.allowed_merchants],
    allowed_categories: [...savedMandate.allowed_categories],
  };
}

export function mockAttack(type: AttackType): AttackResult {
  const plan = ATTACKS[type];
  attackCount += 1;
  auditChecked += 1;
  const id = `atk_${type}_${attackCount}`;
  const row: FeedRow = {
    id,
    time: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    item: plan.item,
    amount: plan.amount,
    decision: plan.decision,
    reason_codes: [...plan.reason_codes],
    risk: plan.risk,
  };
  feed = [row, ...feed];
  notify();
  return {
    purchase_id: id,
    decision: {
      decision: plan.decision,
      reason_codes: [...plan.reason_codes],
      risk: plan.risk ?? undefined,
      explanation: plan.explanation,
      quote: { amount: plan.amount, currency: "USD" },
    },
  };
}

export function mockVerify(): AuditResult {
  return { ok: true, checked: auditChecked, first_bad_seq: null };
}

export function mockRequest(text: string): SpendResult {
  const words = text.toLowerCase();
  const pick = words.includes("watch")
    ? { item: "Smart Watch", amount: "79.99" }
    : { item: "Wireless Earbuds", amount: "24.99" };
  attackCount += 1;
  auditChecked += 1;
  const id = `spend_mock_${attackCount}`;
  const row: FeedRow = {
    id,
    time: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    item: pick.item,
    amount: pick.amount,
    decision: "APPROVE",
    reason_codes: [],
    risk: 0.12,
  };
  feed = [row, ...feed];
  notify();
  return {
    purchase_id: id,
    decision: "APPROVE",
    amount: pick.amount,
    note: `matched ${pick.item} at $${pick.amount}`,
    reason_codes: [],
    approval_url: null,
  };
}

export function mockApprove(_purchaseId: string): void {}

export function mockCapture(_purchaseId: string): CaptureResult {
  return { status: "CAPTURED", capture_id: "CAP-MOCK", violations: [] };
}
