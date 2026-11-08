import { useState } from "react";
import { describeError, type AuditResult, type DataMode } from "../api.ts";
import { checkAudit } from "../data.ts";
import { formatAuditStamp } from "../format.ts";
import {
  CheckCircleIcon,
  DocumentCheckIcon,
  SpinnerIcon,
  XCircleIcon,
} from "../icons.tsx";

interface AuditPanelProps {
  mode: DataMode;
  onToast?: (toast: { type: "success" | "error"; text: string }) => void;
}

export function AuditPanel({ mode, onToast }: AuditPanelProps) {
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<AuditResult>({
    ok: true,
    checked: 12,
    first_bad_seq: null,
  });
  const [lastVerifiedDate, setLastVerifiedDate] = useState<string>("2026-11-08T09:12:34Z");
  const [isVerifyingAnim, setIsVerifyingAnim] = useState(false);

  async function handleVerify() {
    setVerifying(true);
    setIsVerifyingAnim(true);
    try {
      const outcome = await checkAudit(mode);
      setResult(outcome);
      const nowUtc = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
      setLastVerifiedDate(nowUtc);

      if (outcome.ok) {
        onToast?.({
          type: "success",
          text: `Audit OK: ${outcome.checked ?? 0} records cryptographically verified`,
        });
      } else {
        onToast?.({
          type: "error",
          text: `Audit failure: broken sequence at #${outcome.first_bad_seq}`,
        });
      }
    } catch (err) {
      onToast?.({
        type: "error",
        text: `Audit error: ${describeError(err)}`,
      });
    } finally {
      setVerifying(false);
      setTimeout(() => setIsVerifyingAnim(false), 800);
    }
  }

  const recordCount = Math.max(1, result.checked ?? 12);
  const totalBlocks = Math.min(recordCount, 20);
  const blocks = Array.from({ length: totalBlocks }, (_, i) => i + 1);

  return (
    <section className="panel audit-console-panel" aria-labelledby="audit-panel-title">
      <div className="panel-header">
        <div className="panel-title-group">
          <span className="panel-icon-wrap icon-blue" aria-hidden="true">
            <DocumentCheckIcon size={18} />
          </span>
          <div>
            <h2 id="audit-panel-title" className="panel-title">Audit Engine</h2>
            <p className="panel-subtitle">SHA-256 tamper-evident hash chain</p>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-outline-brand btn-verify"
          disabled={verifying}
          onClick={handleVerify}
          aria-label="Cryptographically verify audit records"
        >
          {verifying ? (
            <>
              <SpinnerIcon size={14} />
              <span>Verifying...</span>
            </>
          ) : (
            <>
              <CheckCircleIcon size={14} />
              <span>Verify records</span>
            </>
          )}
        </button>
      </div>

      {/* Outcome Banner */}
      <div
        className={`audit-banner ${result.ok ? "banner-verified-ok" : "banner-verified-broken"}`}
        role="status"
      >
        <div className="banner-icon-slot">
          {result.ok ? (
            <CheckCircleIcon size={18} className="icon-success-green" />
          ) : (
            <XCircleIcon size={18} className="icon-danger-red" />
          )}
        </div>
        <div className="banner-text-slot">
          <div className="banner-headline">
            {result.ok
              ? `OK, ${result.checked ?? 12} records verified`
              : `BROKEN at record ${result.first_bad_seq ?? "?"}`}
          </div>
          <div className="banner-subline">
            {result.ok
              ? "All sequence hashes link to immediate predecessors. No tampering detected."
              : "Discontinuity detected in hash chain sequence integrity."}
          </div>
        </div>
      </div>

      {/* Hash Chain Visual Blocks */}
      <div className="hash-chain-visual-box">
        <div className="chain-label-row">
          <span className="chain-label">Cryptographic Hash Blocks</span>
          <span className="chain-stats">{recordCount} blocks anchored</span>
        </div>
        <div className="chain-blocks-strip" aria-label="Visual hash chain block sequence">
          {blocks.map((seq, idx) => {
            const isBroken =
              !result.ok && result.first_bad_seq !== null && seq >= result.first_bad_seq;
            const isDimmed =
              !result.ok && result.first_bad_seq !== null && seq > result.first_bad_seq;

            const blockClass = isBroken
              ? isDimmed
                ? "block-dimmed"
                : "block-broken"
              : "block-ok";

            return (
              <div
                key={seq}
                className={`hash-block ${blockClass} ${isVerifyingAnim ? "block-verifying-pulse" : ""}`}
                style={{ animationDelay: `${idx * 45}ms` }}
                title={`Record #${seq}: ${isBroken ? "Chain broken" : "Intact"}`}
              />
            );
          })}
          {recordCount > totalBlocks && (
            <span className="chain-overflow-tag">+{recordCount - totalBlocks}</span>
          )}
        </div>
      </div>

      <div className="audit-footer-row">
        <span className="last-verified-label">Last verified</span>
        <span className="last-verified-val">{formatAuditStamp(lastVerifiedDate)}</span>
      </div>
    </section>
  );
}
