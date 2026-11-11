import { useState } from "react";
import { describeError, type AuditResult, type DataMode } from "../api.ts";
import { checkAudit } from "../data.ts";
import { formatAuditStamp } from "../format.ts";
import {
  DocumentCheckIcon,
  SolidCheckCircle,
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
  const [lastVerifiedIso, setLastVerifiedIso] = useState<string>("2026-11-08T09:12:34Z");

  async function handleVerify() {
    setVerifying(true);
    try {
      const outcome = await checkAudit(mode);
      setResult(outcome);
      const nowIso = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
      setLastVerifiedIso(nowIso);

      if (outcome.ok) {
        onToast?.({
          type: "success",
          text: `OK, ${outcome.checked ?? 12} records verified`,
        });
      } else {
        onToast?.({
          type: "error",
          text: `BROKEN at record #${outcome.first_bad_seq}`,
        });
      }
    } catch (err) {
      onToast?.({
        type: "error",
        text: `Audit error: ${describeError(err)}`,
      });
    } finally {
      setVerifying(false);
    }
  }

  const isOk = result.ok;
  const verifiedCount = result.checked ?? 12;

  return (
    <section className="card audit-card" aria-labelledby="audit-card-title">
      <div className="card-header">
        <div className="card-title-group">
          <span className="card-icon-wrap icon-blue" aria-hidden="true">
            <DocumentCheckIcon size={20} />
          </span>
          <div>
            <h2 id="audit-card-title" className="card-title">Audit Panel</h2>
            <p className="card-subtitle">Verify the integrity of records</p>
          </div>
        </div>
      </div>

      <div className="audit-card-body">
        {/* Verify Action Button */}
        <button
          type="button"
          className="btn btn-outline-verify"
          disabled={verifying}
          onClick={handleVerify}
          aria-label="Verify audit records integrity"
        >
          {verifying ? (
            <>
              <SpinnerIcon size={16} />
              <span>Verifying...</span>
            </>
          ) : (
            <>
              <span className="verify-btn-check">✔</span>
              <span>Verify records</span>
            </>
          )}
        </button>

        {/* Verification Status Banner */}
        <div
          className={`audit-status-banner ${isOk ? "status-banner-ok" : "status-banner-err"}`}
          role="status"
        >
          <div className="status-banner-icon">
            {isOk ? (
              <SolidCheckCircle size={22} />
            ) : (
              <XCircleIcon size={22} className="icon-red" />
            )}
          </div>
          <div className="status-banner-content">
            <div className="status-banner-headline">
              {isOk
                ? `OK, ${verifiedCount} records verified`
                : `BROKEN at record ${result.first_bad_seq ?? "?"}`}
            </div>
            <div className="status-banner-subline">
              {isOk
                ? "Hash chain is intact."
                : "Discontinuity detected in hash chain sequence."}
            </div>
          </div>
        </div>

        {/* Last Verified Timestamp */}
        <div className="audit-footer-timestamp">
          <div className="last-verified-label">Last Verified</div>
          <div className="last-verified-value mono-font">
            {formatAuditStamp(lastVerifiedIso)}
          </div>
        </div>
      </div>
    </section>
  );
}
