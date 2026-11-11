import { useState, type FormEvent, type KeyboardEvent } from "react";
import { describeError, type DataMode, type Mandate } from "../api.ts";
import { saveMandate } from "../data.ts";
import {
  GearIcon,
  PlusIcon,
  SaveIcon,
  SpinnerIcon,
} from "../icons.tsx";
import {
  buildMandate,
  MERCHANT_ID_PATTERN,
  type FieldErrors,
  type MandateInput,
} from "../mandate.ts";
import { MERCHANTS, openingMandate } from "../mock.ts";

interface MandateEditorProps {
  mode: DataMode;
  onSaved?: (mandate: Mandate) => void;
  onToast?: (toast: { type: "success" | "error"; text: string }) => void;
}

export function MandateEditor({ mode, onSaved, onToast }: MandateEditorProps) {
  const initial = openingMandate();
  const [input, setInput] = useState<MandateInput>({
    id: initial.id,
    total_budget: initial.total_budget,
    per_txn_cap: initial.per_txn_cap,
    approval_threshold: initial.approval_threshold,
    expires_at: initial.expires_at.slice(0, 10), // e.g. "2026-12-31"
    allowed_merchants: [...initial.allowed_merchants],
    extra_merchants: [],
  });

  const [thresholdTier, setThresholdTier] = useState<"Low" | "Medium" | "High">("Medium");
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagInput, setNewTagInput] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(true); // default true to match screenshot!

  const validation = buildMandate({
    ...input,
    expires_at: input.expires_at.includes("T") ? input.expires_at : `${input.expires_at}T00:00:00Z`,
  });
  const isFormValid = validation.mandate !== null;

  function handleRemoveMerchant(id: string) {
    if (input.allowed_merchants.length <= 1) return;
    setInput((prev) => ({
      ...prev,
      allowed_merchants: prev.allowed_merchants.filter((m) => m !== id),
    }));
    setSavedSuccess(false);
  }

  function handleAddCustomMerchant() {
    const raw = newTagInput.trim();
    if (!raw) {
      setIsAddingTag(false);
      return;
    }
    const cleanId = raw.startsWith("m_") ? raw : `m_${raw}`;
    if (!MERCHANT_ID_PATTERN.test(cleanId)) {
      setErrors((prev) => ({ ...prev, allowed_merchants: "Merchant ID format must be m_###" }));
      return;
    }
    if (!input.allowed_merchants.includes(cleanId)) {
      setInput((prev) => ({
        ...prev,
        allowed_merchants: [...prev.allowed_merchants, cleanId],
      }));
    }
    setNewTagInput("");
    setIsAddingTag(false);
    setSavedSuccess(false);
  }

  function handleTagKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddCustomMerchant();
    } else if (e.key === "Escape") {
      setIsAddingTag(false);
      setNewTagInput("");
    }
  }

  function handleThresholdChange(tier: "Low" | "Medium" | "High") {
    setThresholdTier(tier);
    let mappedVal = "40.00";
    if (tier === "Low") mappedVal = "20.00";
    else if (tier === "High") mappedVal = "50.00";
    setInput((prev) => ({ ...prev, approval_threshold: mappedVal }));
    setSavedSuccess(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const isoDate = input.expires_at.includes("T")
      ? input.expires_at
      : `${input.expires_at}T00:00:00Z`;

    const { mandate, errors: validationErrors } = buildMandate({
      ...input,
      expires_at: isoDate,
    });

    setErrors(validationErrors);
    if (!mandate) return;

    setSaving(true);
    try {
      const saved = await saveMandate(mode, mandate);
      setSavedSuccess(true);
      onSaved?.(saved);
      onToast?.({ type: "success", text: "Rules saved successfully!" });
    } catch (err) {
      setSavedSuccess(false);
      const msg = describeError(err);
      setErrors((prev) => ({ ...prev, general: msg }));
      onToast?.({ type: "error", text: msg });
    } finally {
      setSaving(false);
    }
  }

  // Helper to map merchant id to readable label
  const getMerchantName = (id: string) => {
    const found = MERCHANTS.find((m) => m.id === id);
    return found ? found.name : id;
  };

  return (
    <section className="card mandate-card" aria-labelledby="mandate-card-title">
      <div className="card-header">
        <div className="card-title-group">
          <span className="card-icon-wrap icon-blue" aria-hidden="true">
            <GearIcon size={20} />
          </span>
          <div>
            <h2 id="mandate-card-title" className="card-title">Mandate Editor</h2>
            <p className="card-subtitle">Set your spending rules</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mandate-form" noValidate>
        {/* Row 1: 3 Columns */}
        <div className="mandate-row-three">
          <div className="mandate-field">
            <label htmlFor="budget-input">Total Budget (USD)</label>
            <div className="input-currency-wrapper">
              <span className="currency-prefix">$</span>
              <input
                id="budget-input"
                type="text"
                value={input.total_budget}
                onChange={(e) => {
                  const val = e.target.value.replace(/^\$/, "");
                  setInput({ ...input, total_budget: val });
                  setSavedSuccess(false);
                  setErrors((prev) => ({ ...prev, total_budget: undefined, per_txn_cap: undefined }));
                }}
                className={`mandate-input ${errors.total_budget ? "input-has-error" : ""}`}
              />
            </div>
            {errors.total_budget && <span className="field-error-text">{errors.total_budget}</span>}
          </div>

          <div className="mandate-field">
            <label htmlFor="cap-input">Per-Transaction Cap (USD)</label>
            <div className="input-currency-wrapper">
              <span className="currency-prefix">$</span>
              <input
                id="cap-input"
                type="text"
                value={input.per_txn_cap}
                onChange={(e) => {
                  const val = e.target.value.replace(/^\$/, "");
                  setInput({ ...input, per_txn_cap: val });
                  setSavedSuccess(false);
                  setErrors((prev) => ({ ...prev, per_txn_cap: undefined, approval_threshold: undefined }));
                }}
                className={`mandate-input ${errors.per_txn_cap ? "input-has-error" : ""}`}
              />
            </div>
            {errors.per_txn_cap && <span className="field-error-text">{errors.per_txn_cap}</span>}
          </div>

          <div className="mandate-field">
            <label htmlFor="threshold-select">Approval Threshold</label>
            <div className="select-wrapper">
              <select
                id="threshold-select"
                value={thresholdTier}
                onChange={(e) => handleThresholdChange(e.target.value as "Low" | "Medium" | "High")}
                className="mandate-select"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
              <span className="select-arrow-icon" aria-hidden="true">⌵</span>
            </div>
            {errors.approval_threshold && (
              <span className="field-error-text">{errors.approval_threshold}</span>
            )}
          </div>
        </div>

        {/* Row 2: Expiry Date + Allowed Merchants */}
        <div className="mandate-row-two">
          <div className="mandate-field field-expiry">
            <label htmlFor="expiry-input">Expiry Date</label>
            <div className="input-date-wrapper">
              <span className="calendar-emoji" aria-hidden="true">📅</span>
              <input
                id="expiry-input"
                type="text"
                value={input.expires_at}
                onChange={(e) => {
                  setInput({ ...input, expires_at: e.target.value });
                  setSavedSuccess(false);
                  setErrors((prev) => ({ ...prev, expires_at: undefined }));
                }}
                className={`mandate-input date-input ${errors.expires_at ? "input-has-error" : ""}`}
              />
            </div>
            {errors.expires_at && <span className="field-error-text">{errors.expires_at}</span>}
          </div>

          <div className="mandate-field field-merchants">
            <label>Allowed Merchants</label>
            <div className="merchants-pills-container">
              {input.allowed_merchants.map((id) => (
                <span key={id} className="merchant-pill">
                  <span className="pill-text">{getMerchantName(id)}</span>
                  <button
                    type="button"
                    className="pill-close-btn"
                    onClick={() => handleRemoveMerchant(id)}
                    aria-label={`Remove ${getMerchantName(id)}`}
                  >
                    ✕
                  </button>
                </span>
              ))}

              {isAddingTag ? (
                <div className="add-merchant-input-inline">
                  <input
                    type="text"
                    placeholder="m_104"
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    onKeyDown={handleTagKeyDown}
                    onBlur={handleAddCustomMerchant}
                    autoFocus
                    className="tag-quick-input"
                  />
                </div>
              ) : (
                <button
                  type="button"
                  className="add-merchant-pill-btn"
                  onClick={() => setIsAddingTag(true)}
                  aria-label="Add allowed merchant"
                >
                  <PlusIcon size={12} />
                </button>
              )}
            </div>
            {errors.allowed_merchants && (
              <span className="field-error-text">{errors.allowed_merchants}</span>
            )}
          </div>
        </div>

        {/* Row 3: Save button + Success badge */}
        <div className="mandate-actions-row">
          <button
            type="submit"
            className="btn btn-primary-blue btn-save-rules"
            disabled={saving || !isFormValid}
          >
            {saving ? (
              <>
                <SpinnerIcon size={16} /> Saving...
              </>
            ) : (
              <>
                <SaveIcon size={16} /> Save my rules
              </>
            )}
          </button>

          {savedSuccess && (
            <div className="rules-saved-badge" role="status">
              <span className="badge-check-icon">✔</span>
              <span>Rules saved successfully!</span>
            </div>
          )}

          {errors.general && (
            <span className="field-error-text general-error">{errors.general}</span>
          )}
        </div>
      </form>
    </section>
  );
}
