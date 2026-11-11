import {
  createMandate,
  fetchCatalogNames,
  fetchPurchases,
  postAttack,
  postAuditVerify,
  readAttack,
  readAudit,
  readFeed,
  readMandate,
  type AttackResult,
  type AttackType,
  type AuditResult,
  type DataMode,
  type FeedRow,
  type Mandate,
} from "./api.ts";
import { listMockDecisions, mockAttack, mockSaveMandate, mockVerify } from "./mock.ts";

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
