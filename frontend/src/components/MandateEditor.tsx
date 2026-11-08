import { useState, type FormEvent, type KeyboardEvent } from "react";
import { describeError, type DataMode, type Mandate } from "../api.ts";
import { saveMandate } from "../data.ts";
import {
  CloseIcon,
  GearIcon,
  PlusIcon,
  SaveIcon,
  SpinnerIcon,
} from "../icons.tsx";
import {
  buildMandate,
  formatUtcInput,
  formatUtcToLocalHelper,
  MERCHANT_ID_PATTERN,
  type FieldErrors,
  type MandateInput,
} from "../mandate.ts";
import { MERCHANTS, openingMandate } from "../mock.ts";

interface MandateEditorProps {
  mode: DataMode;
  onSaved?: (mandate: Mandate) => void;
  onClose?: () => void;
}

export function MandateEditor({ mode, onSaved, onClose }: MandateEditorProps) {
  const initial = openingMandate();
  const [input, setInput] = useState<MandateInput>({
    id: initial.id,
    total_budget: initial.total_budget,
    per_txn_cap: initial.per_txn_cap,
    approval_threshold: initial.approval_threshold,
    expires_at: formatUtcInput(initial.expires_at),
    allowed_merchants: [...initial.allowed_merchants],
    extra_merchants: [],
  });

  const [tagInput, setTagInput] = useState("");
  const [tagError, setTagError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Live validation for disable state
  const validation = buildMandate(input);
  const isFormValid = validation.mandate !== null;

  function toggleMerchant(merchantId: string) {
    setInput((prev) => {
      const exists = prev.allowed_merchants.includes(merchantId);
      const next = exists
        ? prev.allowed_merchants.filter((id) => id !== merchantId)
        : [...prev.allowed_merchants, merchantId];
      return { ...prev, allowed_merchants: next };
    });
  }

  function handleAddTag() {
    const raw = tagInput.trim();
    if (!raw) return;
    setTagError(null);
    if (!MERCHANT_ID_PATTERN.test(raw)) {
      setTagError("Merchant ID must match pattern m_### (e.g. m_104)");
      return;
    }
    if (input.extra_merchants.includes(raw) || input.allowed_merchants.includes(raw)) {
      setTagInput("");
      return;
    }
    setInput((prev) => ({
      ...prev,
      extra_merchants: [...prev.extra_merchants, raw],
    }));
    setTagInput("");
  }

  function handleTagKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      handleAddTag();
    }
  }

  function handleRemoveTag(tag: string) {
    setInput((prev) => ({
      ...prev,
      extra_merchants: prev.extra_merchants.filter((m) => m !== tag),
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setToast(null);

    const { mandate, errors: validationErrors } = buildMandate(input);
    setErrors(validationErrors);

    if (!mandate) return;

    setSaving(true);
    try {
      const saved = await saveMandate(mode, mandate);
      setToast({ type: "success", text: "Rules saved successfully!" });
      onSaved?.(saved);
      setTimeout(() => setToast(null), 3500);
    } catch (err) {
      setToast({ type: "error", text: describeError(err) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="drawer-mandate-card" role="region" aria-labelledby="mandate-drawer-title">
      <div className="drawer-mandate-header">
        <div className="drawer-title-lockup">
          <span className="drawer-icon-wrap" aria-hidden="true">
            <GearIcon size={20} />
          </span>
          <div>
            <h2 id="mandate-drawer-title" className="drawer-title">Mandate Editor</h2>
            <p className="drawer-subtitle">Set your spending rules &amp; limits</p>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            className="drawer-close-btn"
            onClick={onClose}
            aria-label="Close mandate editor"
          >
            <CloseIcon size={18} />
          </button>
        )}
      </div>

      {toast && (
        <div
          className={`drawer-toast ${toast.type === "success" ? "drawer-toast-success" : "drawer-toast-error"}`}
          role="alert"
        >
          {toast.type === "success" ? "✓ " : "⚠️ "}
          {toast.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="drawer-form" noValidate>
        <div className="drawer-fields-grid">
          <div className="field-group">
            <label htmlFor="mandate-id">Mandate ID</label>
            <input
              id="mandate-id"
              type="text"
              value={input.id}
              onChange={(e) => {
                setInput({ ...input, id: e.target.value });
                setErrors((prev) => ({ ...prev, id: undefined }));
              }}
              className={errors.id ? "input-err" : ""}
            />
            {errors.id && <span className="field-err-msg">{errors.id}</span>}
          </div>

          <div className="field-group">
            <label htmlFor="mandate-budget">Total Budget (USD)</label>
            <input
              id="mandate-budget"
              type="text"
              value={input.total_budget}
              onChange={(e) => {
                setInput({ ...input, total_budget: e.target.value });
                setErrors((prev) => ({ ...prev, total_budget: undefined, per_txn_cap: undefined }));
              }}
              className={errors.total_budget ? "input-err" : ""}
            />
            {errors.total_budget && <span className="field-err-msg">{errors.total_budget}</span>}
          </div>

          <div className="field-group">
            <label htmlFor="mandate-cap">Per-Purchase Cap (USD)</label>
            <input
              id="mandate-cap"
              type="text"
              value={input.per_txn_cap}
              onChange={(e) => {
                setInput({ ...input, per_txn_cap: e.target.value });
                setErrors((prev) => ({ ...prev, per_txn_cap: undefined, approval_threshold: undefined }));
              }}
              className={errors.per_txn_cap ? "input-err" : ""}
            />
            {errors.per_txn_cap && <span className="field-err-msg">{errors.per_txn_cap}</span>}
          </div>

          <div className="field-group">
            <label htmlFor="mandate-threshold">Approval Threshold (USD)</label>
            <input
              id="mandate-threshold"
              type="text"
              value={input.approval_threshold}
              onChange={(e) => {
                setInput({ ...input, approval_threshold: e.target.value });
                setErrors((prev) => ({ ...prev, approval_threshold: undefined }));
              }}
              className={errors.approval_threshold ? "input-err" : ""}
            />
            {errors.approval_threshold && (
              <span className="field-err-msg">{errors.approval_threshold}</span>
            )}
          </div>

          <div className="field-group full-col">
            <label htmlFor="mandate-expires">Expires at (UTC)</label>
            <input
              id="mandate-expires"
              type="text"
              value={input.expires_at}
              onChange={(e) => {
                setInput({ ...input, expires_at: e.target.value });
                setErrors((prev) => ({ ...prev, expires_at: undefined }));
              }}
              className={errors.expires_at ? "input-err" : ""}
            />
            <span className="field-helper-text">
              Local equivalent: {formatUtcToLocalHelper(input.expires_at)}
            </span>
            {errors.expires_at && <span className="field-err-msg">{errors.expires_at}</span>}
          </div>
        </div>

        <div className="drawer-merchants-box">
          <label className="section-title-label">Allowed Merchants</label>
          <div className="known-merchants-list">
            {MERCHANTS.map((m) => {
              const checked = input.allowed_merchants.includes(m.id);
              return (
                <label key={m.id} className={`merchant-check-item ${checked ? "is-checked" : ""}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleMerchant(m.id)}
                  />
                  <span className="m-name">{m.name}</span>
                  <code className="m-id">{m.id}</code>
                </label>
              );
            })}
          </div>

          <div className="extra-chips-zone">
            <label htmlFor="extra-merchant-input" className="sub-section-label">
              Extra Merchant IDs (chip tags)
            </label>
            <div className="chips-flow-container">
              {input.extra_merchants.map((tag) => (
                <span key={tag} className="extra-tag-chip">
                  <code>{tag}</code>
                  <button
                    type="button"
                    className="tag-close-btn"
                    onClick={() => handleRemoveTag(tag)}
                    aria-label={`Remove merchant ${tag}`}
                  >
                    ×
                  </button>
                </span>
              ))}
              <div className="tag-input-row">
                <input
                  id="extra-merchant-input"
                  type="text"
                  value={tagInput}
                  onChange={(e) => {
                    setTagInput(e.target.value);
                    setTagError(null);
                  }}
                  onKeyDown={handleTagKeyDown}
                  className="tag-text-input"
                />
                <button
                  type="button"
                  className="btn-add-chip"
                  onClick={handleAddTag}
                  aria-label="Add merchant tag"
                >
                  <PlusIcon size={14} /> Add
                </button>
              </div>
            </div>
            {tagError && <span className="field-err-msg">{tagError}</span>}
          </div>

          {errors.allowed_merchants && (
            <span className="field-err-msg">{errors.allowed_merchants}</span>
          )}
        </div>

        <div className="drawer-footer-actions">
          <button
            type="submit"
            className="btn btn-primary-gradient btn-save-full"
            disabled={saving || !isFormValid}
          >
            {saving ? (
              <>
                <SpinnerIcon size={16} /> Saving rules...
              </>
            ) : (
              <>
                <SaveIcon size={16} /> Save my rules
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
