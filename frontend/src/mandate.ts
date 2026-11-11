import { isMoney, moneyCents, type Mandate } from "./api.ts";

export const PRODUCT_CATEGORIES = ["electronics", "books", "home"] as const;

export interface MandateInput {
  id: string;
  total_budget: string;
  per_txn_cap: string;
  approval_threshold: string;
  expires_at: string;
  allowed_merchants: string[];
  extra_merchants: string[];
}

export type FieldErrors = Partial<Record<keyof MandateInput | "general", string>>;

export const MERCHANT_ID_PATTERN = /^m_[A-Za-z0-9_-]+$/;
const ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export function formatUtcInput(iso: string): string {
  if (!iso || !iso.trim()) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function formatUtcToLocalHelper(iso: string): string {
  if (!iso || !iso.trim()) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Invalid date";
  try {
    const local = new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return `${local} (${tz})`;
  } catch {
    return date.toLocaleString();
  }
}

export function buildMandate(input: MandateInput): { mandate: Mandate | null; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const id = input.id.trim();
  const totalBudget = input.total_budget.trim();
  const perTxnCap = input.per_txn_cap.trim();
  const approvalThreshold = input.approval_threshold.trim();
  const expiresAt = input.expires_at.trim();

  if (!ID_PATTERN.test(id)) {
    errors.id = "Use letters, numbers, underscores, or hyphens.";
  }
  if (!isMoney(totalBudget)) {
    errors.total_budget = "Enter dollars with two decimals, such as 200.00.";
  }
  if (!isMoney(perTxnCap)) {
    errors.per_txn_cap = "Enter dollars with two decimals, such as 50.00.";
  }
  if (!isMoney(approvalThreshold)) {
    errors.approval_threshold = "Enter dollars with two decimals, such as 40.00.";
  }

  // String-safe / BigInt cents comparison
  const budgetCents = moneyCents(totalBudget);
  const capCents = moneyCents(perTxnCap);
  const thresholdCents = moneyCents(approvalThreshold);

  if (budgetCents !== null && capCents !== null) {
    if (capCents > budgetCents) {
      errors.per_txn_cap = `Per-purchase cap ($${perTxnCap}) cannot exceed total budget ($${totalBudget}).`;
    }
  }

  if (capCents !== null && thresholdCents !== null) {
    if (thresholdCents > capCents) {
      errors.approval_threshold = `Approval threshold ($${approvalThreshold}) cannot exceed cap ($${perTxnCap}).`;
    }
  }

  // Expiry in UTC
  const parsedDate = new Date(expiresAt);
  if (!expiresAt || Number.isNaN(parsedDate.getTime())) {
    errors.expires_at = "Enter a valid UTC timestamp (e.g., 2026-11-30T00:00:00Z).";
  }

  // Allowed merchants
  const validExtras = input.extra_merchants.filter((m) => MERCHANT_ID_PATTERN.test(m));
  const allowed = [...new Set([...input.allowed_merchants, ...validExtras])];
  if (allowed.length === 0) {
    errors.allowed_merchants = "Choose at least one merchant or add an extra merchant ID.";
  }

  if (Object.keys(errors).length > 0 || Number.isNaN(parsedDate.getTime())) {
    return { mandate: null, errors };
  }

  const normalizedUtc = parsedDate.toISOString().replace(/\.\d{3}Z$/, "Z");

  return {
    mandate: {
      id,
      total_budget: totalBudget,
      per_txn_cap: perTxnCap,
      approval_threshold: approvalThreshold,
      expires_at: normalizedUtc,
      allowed_merchants: allowed,
      allowed_categories: [...PRODUCT_CATEGORIES],
      currency: "USD",
    },
    errors,
  };
}
