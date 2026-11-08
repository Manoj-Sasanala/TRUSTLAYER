export type DataMode = "mock" | "live";

export type DecisionName = "APPROVE" | "BLOCK" | "ESCALATE";

export interface Mandate {
  id: string;
  total_budget: string;
  per_txn_cap: string;
  allowed_merchants: string[];
  allowed_categories: string[];
  currency: "USD";
  expires_at: string;
  approval_threshold: string;
}

export interface Decision {
  decision: string;
  reason_codes: string[];
  risk?: number;
  explanation?: string;
  quote?: {
    quote_id?: string;
    amount?: string;
    currency?: string;
  };
}

export interface FeedRow {
  id: string;
  time: string;
  item: string;
  amount: string;
  decision: string;
  reason_codes: string[];
  risk: number | null;
}

export interface AttackResult {
  purchase_id: string;
  decision: Decision;
}

export interface AuditResult {
  ok: boolean;
  checked: number | null;
  first_bad_seq: number | null;
}

export type AttackType = "over_cap" | "over_budget" | "payee_switch" | "injection";

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function apiBase(): string {
  const configured = import.meta.env.VITE_API_URL;
  if (typeof configured === "string" && configured.trim() !== "") {
    return configured.trim().replace(/\/$/, "");
  }
  return "/api";
}

export function describeError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Something went wrong.";
}

export function isMoney(value: string): boolean {
  return /^\d+\.\d{2}$/.test(value);
}

export function moneyCents(value: string): bigint | null {
  const match = /^(\d+)\.(\d{2})$/.exec(value);
  if (!match) return null;
  return BigInt(match[1]) * 100n + BigInt(match[2]);
}

export function compareMoney(left: string, right: string): number {
  const a = moneyCents(left);
  const b = moneyCents(right);
  if (a === null || b === null) return left.localeCompare(right);
  if (a === b) return 0;
  return a > b ? 1 : -1;
}

export function showText(value: unknown): string {
  if (typeof value === "string") return value.trim() === "" ? "-" : value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return "-";
}

export function formatStamp(value: string): string {
  if (!value || value === "-") return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const formatted = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZone: "UTC",
  }).format(date);
  return `${formatted} UTC`;
}

export function showRisk(value: number | null): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return value.toFixed(2);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function errorMessage(response: Response): Promise<string> {
  const fallback = `Request failed (${response.status}).`;
  try {
    const body: unknown = await response.json();
    if (!isRecord(body)) return fallback;
    const detail = body.detail;
    if (typeof detail === "string" && detail.trim()) return detail;
    if (Array.isArray(detail)) {
      const parts = detail
        .map((item) => {
          if (typeof item === "string") return item;
          if (!isRecord(item) || typeof item.msg !== "string") return "";
          const loc = Array.isArray(item.loc)
            ? item.loc.filter((part): part is string => typeof part === "string").join(".")
            : "";
          return loc ? `${loc}: ${item.msg}` : item.msg;
        })
        .filter((part) => part !== "");
      if (parts.length > 0) return parts.join(" ");
    }
    return fallback;
  } catch {
    return fallback;
  }
}

async function request(path: string, init?: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${apiBase()}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(
      `Cannot reach the API at ${apiBase()}. Start the backend, or stay on mock data.`,
      0,
    );
  }

  if (!response.ok) {
    throw new ApiError(await errorMessage(response), response.status);
  }

  if (response.status === 204) return null;
  const text = await response.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiError("The API returned a response that is not JSON.", response.status);
  }
}

export function checkHealth(): Promise<unknown> {
  return request("/health");
}

export function createMandate(mandate: Mandate): Promise<unknown> {
  return request("/mandates", { method: "POST", body: JSON.stringify(mandate) });
}

export function fetchPurchases(): Promise<unknown> {
  return request("/purchases");
}

export async function fetchCatalogNames(): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  try {
    const payload = await request("/catalog");
    if (!Array.isArray(payload)) return names;
    for (const item of payload) {
      if (!isRecord(item)) continue;
      if (typeof item.item_id !== "string" || typeof item.name !== "string") continue;
      if (item.item_id.trim() && item.name.trim()) names.set(item.item_id, item.name);
    }
  } catch {
    return names;
  }
  return names;
}

export function postAttack(type: AttackType): Promise<unknown> {
  return request(`/demo/attack/${type}`, { method: "POST" });
}

export function postAuditVerify(): Promise<unknown> {
  return request("/audit/verify", { method: "POST" });
}

function readCodes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((code): code is string => typeof code === "string" && code.trim() !== "");
}

export function readFeed(payload: unknown, names: ReadonlyMap<string, string>): FeedRow[] {
  if (!Array.isArray(payload)) {
    throw new ApiError("The purchase list was not a list.", 200);
  }
  return payload.map((item, index) => {
    const row = isRecord(item) ? item : {};
    const intent = isRecord(row.intent) ? row.intent : {};
    const decision = isRecord(row.decision) ? row.decision : {};
    const itemId = typeof intent.item_id === "string" ? intent.item_id : "";
    const named = itemId ? names.get(itemId) : undefined;
    const riskSource = typeof decision.risk === "number" ? decision.risk : row.risk;
    const id = typeof row.id === "string" && row.id.trim() ? row.id : `purchase-${index}`;
    return {
      id,
      time: typeof row.created_at === "string" && row.created_at.trim() ? row.created_at : "-",
      item: named && named.trim() ? named : itemId || "-",
      amount: typeof intent.amount === "string" && intent.amount.trim() ? intent.amount : "-",
      decision:
        typeof decision.decision === "string" && decision.decision.trim() ? decision.decision : "-",
      reason_codes: readCodes(decision.reason_codes),
      risk: typeof riskSource === "number" && Number.isFinite(riskSource) ? riskSource : null,
    };
  });
}

export function readAttack(payload: unknown): AttackResult {
  if (!isRecord(payload)) {
    throw new ApiError("The attack response was not an object.", 200);
  }
  const decision = isRecord(payload.decision) ? payload.decision : {};
  const quote = isRecord(decision.quote) ? decision.quote : undefined;
  const risk = decision.risk;
  return {
    purchase_id:
      typeof payload.purchase_id === "string" && payload.purchase_id.trim()
        ? payload.purchase_id
        : "-",
    decision: {
      decision:
        typeof decision.decision === "string" && decision.decision.trim() ? decision.decision : "-",
      reason_codes: readCodes(decision.reason_codes),
      risk: typeof risk === "number" && Number.isFinite(risk) ? risk : undefined,
      explanation: typeof decision.explanation === "string" ? decision.explanation : undefined,
      quote: quote
        ? {
            quote_id: typeof quote.quote_id === "string" ? quote.quote_id : undefined,
            amount: typeof quote.amount === "string" ? quote.amount : undefined,
            currency: typeof quote.currency === "string" ? quote.currency : undefined,
          }
        : undefined,
    },
  };
}

export function readAudit(payload: unknown): AuditResult {
  if (!isRecord(payload) || typeof payload.ok !== "boolean") {
    throw new ApiError("The audit response did not include a result.", 200);
  }
  const checked = payload.checked;
  const first = payload.first_bad_seq;
  return {
    ok: payload.ok,
    checked: typeof checked === "number" && Number.isFinite(checked) ? checked : null,
    first_bad_seq: typeof first === "number" && Number.isFinite(first) ? first : null,
  };
}

export function readMandate(payload: unknown, fallback: Mandate): Mandate {
  if (!isRecord(payload)) return fallback;
  const merchants = Array.isArray(payload.allowed_merchants)
    ? payload.allowed_merchants.filter((id): id is string => typeof id === "string")
    : fallback.allowed_merchants;
  const categories = Array.isArray(payload.allowed_categories)
    ? payload.allowed_categories.filter((id): id is string => typeof id === "string")
    : fallback.allowed_categories;
  return {
    id: typeof payload.id === "string" && payload.id.trim() ? payload.id : fallback.id,
    total_budget:
      typeof payload.total_budget === "string" && payload.total_budget.trim()
        ? payload.total_budget
        : fallback.total_budget,
    per_txn_cap:
      typeof payload.per_txn_cap === "string" && payload.per_txn_cap.trim()
        ? payload.per_txn_cap
        : fallback.per_txn_cap,
    allowed_merchants: merchants,
    allowed_categories: categories,
    currency: "USD",
    expires_at:
      typeof payload.expires_at === "string" && payload.expires_at.trim()
        ? payload.expires_at
        : fallback.expires_at,
    approval_threshold:
      typeof payload.approval_threshold === "string" && payload.approval_threshold.trim()
        ? payload.approval_threshold
        : fallback.approval_threshold,
  };
}
