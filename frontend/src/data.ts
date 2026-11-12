import {
  createMandate,
  fetchCatalogNames,
  fetchPurchases,
  postApprove,
  postAttack,
  postAuditVerify,
  postCapture,
  postRequest,
  readAttack,
  readAudit,
  readCapture,
  readFeed,
  readMandate,
  readSpend,
  type AttackResult,
  type AttackType,
  type AuditResult,
  type CaptureResult,
  type DataMode,
  type FeedRow,
  type Mandate,
  type SpendResult,
} from "./api.ts";
import {
  listMockDecisions,
  mockApprove,
  mockAttack,
  mockCapture,
  mockRequest,
  mockSaveMandate,
  mockVerify,
} from "./mock.ts";

export async function loadFeed(mode: DataMode): Promise<FeedRow[]> {
  if (mode === "mock") return listMockDecisions();
  const [payload, names] = await Promise.all([fetchPurchases(), fetchCatalogNames()]);
  return readFeed(payload, names);
}

export async function saveMandate(mode: DataMode, mandate: Mandate): Promise<Mandate> {
  if (mode === "mock") return mockSaveMandate(mandate);
  return readMandate(await createMandate(mandate), mandate);
}

export async function launchAttack(mode: DataMode, type: AttackType): Promise<AttackResult> {
  if (mode === "mock") return mockAttack(type);
  return readAttack(await postAttack(type));
}

export async function checkAudit(mode: DataMode): Promise<AuditResult> {
  if (mode === "mock") return mockVerify();
  return readAudit(await postAuditVerify());
}

export async function requestSpend(mode: DataMode, text: string): Promise<SpendResult> {
  if (mode === "mock") return mockRequest(text);
  return readSpend(await postRequest(text, "m_1"));
}

export async function approveSpend(mode: DataMode, purchaseId: string): Promise<void> {
  if (mode === "mock") {
    mockApprove(purchaseId);
    return;
  }
  await postApprove(purchaseId);
}

export async function captureSpend(mode: DataMode, purchaseId: string): Promise<CaptureResult> {
  if (mode === "mock") return mockCapture(purchaseId);
  return readCapture(await postCapture(purchaseId));
}
