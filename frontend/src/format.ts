// Unified UTC time formatting: "08 Nov 09:12:34"
export function formatUtcDateTime(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value === "-") return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZone: "UTC",
  }).formatToParts(date);

  const day = parts.find((p) => p.type === "day")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const hour = parts.find((p) => p.type === "hour")?.value ?? "";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "";
  const second = parts.find((p) => p.type === "second")?.value ?? "";

  return `${day} ${month} ${hour}:${minute}:${second}`;
}

export function formatStamp(value: unknown): string {
  return formatUtcDateTime(value);
}

export function formatTimeOnly(value: unknown): string {
  return formatUtcDateTime(value);
}

export function formatAuditStamp(value: unknown): string {
  const formatted = formatUtcDateTime(value);
  return formatted === "-" ? "-" : `${formatted} UTC`;
}

export function formatRelativeTime(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value === "-") return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 0) return "just now";
  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

// Raw 0.00-1.00 risk formatter, no percent conversion
export function formatRiskScore(value: number | null | undefined): string {
  if (value === null || value === undefined || typeof value !== "number" || !Number.isFinite(value)) {
    return "-";
  }
  return value.toFixed(2);
}

export interface ReasonInfo {
  short: string;
  explanation: string;
}

// Contract-exact reason code explanations from docs/CONTRACT.md
export const REASON_CODE_LABELS: Record<string, ReasonInfo> = {
  R1: { short: "Over cap", explanation: "Amount exceeds per_txn_cap (R1)." },
  R2: { short: "Over budget", explanation: "Cumulative spent_so_far + amount exceeds total_budget (R2)." },
  R3: { short: "Unapproved merchant", explanation: "Merchant not in allowed_merchants or not approved (R3)." },
  R4: { short: "Mandate expired", explanation: "Current time exceeds expires_at UTC (R4)." },
  R5: { short: "Quote mismatch", explanation: "Intent amount deviates from locked quote amount (R5)." },
  R6: { short: "Catalog mismatch", explanation: "Quote amount deviates from signed catalog price (R6)." },
  R7: { short: "Payee mismatch", explanation: "Quote payee deviates from merchant registry payee (R7)." },
  R8: { short: "Threshold alert", explanation: "Amount exceeds approval_threshold (ESCALATE) (R8)." },
  R9: { short: "Prompt injection", explanation: "Injection phrase in agent_note and payment field deviated (R9)." },
  R10: { short: "Replayed intent", explanation: "Intent ID already seen; returning first decision (R10)." },
  R11: { short: "Awaiting approval", explanation: "ESCALATE status requires human approval before capture (R11)." },
  R12: { short: "Capture mismatch", explanation: "Captured amount, currency or order ID deviates from quote (R12)." },
};

export function getReasonInfo(code: string): ReasonInfo {
  return (
    REASON_CODE_LABELS[code] ?? {
      short: code,
      explanation: `Rule ${code} triggered.`,
    }
  );
}
