import { useState } from "react";
import { describeError, type CaptureResult, type DataMode, type SpendResult } from "../api.ts";
import { approveSpend, captureSpend, requestSpend } from "../data.ts";
import { SpinnerIcon } from "../icons.tsx";

interface SpendPanelProps {
  mode: DataMode;
  onToast?: (toast: { type: "success" | "error"; text: string }) => void;
}

export function SpendPanel({ mode, onToast }: SpendPanelProps) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  // Survive a full page reload (e.g. PayPal returning to this same tab):
  // the last request is restored instead of dropping back to "No request yet".
  const [result, setResult] = useState<SpendResult | null>(() => {
    try {
      const raw = localStorage.getItem("warrant_spend_last");
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed === "object" && parsed !== null && "purchase_id" in parsed) {
        return parsed as SpendResult;
      }
      return null;
    } catch {
      return null;
    }
  });
  const [approved, setApproved] = useState(false);
  const [capture, setCapture] = useState<CaptureResult | null>(null);

  async function handleAsk() {
    if (busy || !text.trim()) return;
    setBusy(true);
    setApproved(false);
    setCapture(null);
    try {
      const res = await requestSpend(mode, text.trim());
      setResult(res);
      try {
        localStorage.setItem("warrant_spend_last", JSON.stringify(res));
      } catch {
        // storage unavailable — panel still works for this session
      }
      onToast?.({ type: "success", text: `${res.decision} $${res.amount}` });
    } catch (err) {
      onToast?.({ type: "error", text: `Request failed: ${describeError(err)}` });
    } finally {
      setBusy(false);
    }
  }

  async function handleApprove() {
    if (!result || busy) return;
    setBusy(true);
    try {
      await approveSpend(mode, result.purchase_id);
      setApproved(true);
      onToast?.({ type: "success", text: "Approved. Now capture it." });
    } catch (err) {
      onToast?.({ type: "error", text: `Approve failed: ${describeError(err)}` });
    } finally {
      setBusy(false);
    }
  }

  async function handleCapture() {
    if (!result || busy) return;
    setBusy(true);
    try {
      const res = await captureSpend(mode, result.purchase_id);
      setCapture(res);
      onToast?.({
        type: res.status === "CAPTURED" ? "success" : "error",
        text: res.status === "CAPTURED" ? "Captured." : `Capture ${res.status}.`,
      });
    } catch (err) {
      onToast?.({ type: "error", text: `Capture failed: ${describeError(err)}` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card spend-card" aria-labelledby="spend-title">
      <div className="card-header">
        <div className="card-title-group">
          <div>
            <h2 id="spend-title" className="card-title">Spend it</h2>
            <p className="card-subtitle">Ask the agent, then approve and capture real money</p>
          </div>
        </div>
      </div>

      <div className="spend-row">
        <input
          id="spend-request"
          type="text"
          className="mandate-input spend-input"
          placeholder="cheap headphones"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleAsk();
          }}
        />
        <button
          type="button"
          className="btn-save-rules"
          disabled={busy || !text.trim()}
          onClick={() => void handleAsk()}
        >
          {busy ? (
            <>
              <SpinnerIcon size={16} /> Working...
            </>
          ) : (
            "Ask the agent"
          )}
        </button>
      </div>

      <div className="spend-outcome" role="status">
        {!result ? (
          <div className="spend-meta-line">No request yet</div>
        ) : (
          <>
            <div className="spend-decision">Decision: {result.decision}</div>
            <div className="spend-amount">${result.amount}</div>
            {result.note ? <div className="spend-meta-line">{result.note}</div> : null}
            {result.reason_codes.length > 0 ? (
              <div className="spend-meta-line">Rules: {result.reason_codes.join(", ")}</div>
            ) : null}
            {result.approval_url ? (
              <div className="spend-links">
                <a href={result.approval_url} target="_blank" rel="noreferrer">
                  Open PayPal approval
                </a>
              </div>
            ) : (
              <div className="spend-meta-line">No PayPal order for this request.</div>
            )}
            {(result.decision === "ESCALATE" || result.decision === "APPROVE") && !approved ? (
              <button
                type="button"
                className="btn-outline-verify"
                disabled={busy}
                onClick={() => void handleApprove()}
              >
                Mark approved
              </button>
            ) : null}
            {approved && !capture ? (
              <button
                type="button"
                className="btn-outline-verify"
                disabled={busy}
                onClick={() => void handleCapture()}
              >
                Capture
              </button>
            ) : null}
            {capture ? (
              <div className="spend-meta-line">
                Capture: {capture.status}
                {capture.capture_id ? ` (${capture.capture_id})` : ""}
                {capture.violations.length > 0 ? ` — ${capture.violations.join(", ")}` : ""}
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
