import { useState, type ReactNode } from "react";
import { describeError, type AttackResult, type AttackType, type DataMode } from "../api.ts";
import { launchAttack } from "../data.ts";
import { formatRiskPercent } from "../format.ts";
import {
  ArrowUpIcon,
  CodeTerminalIcon,
  ShieldIcon,
  SpinnerIcon,
  SwordsIcon,
  UserSwapIcon,
  WalletIcon,
} from "../icons.tsx";

interface AttackLabProps {
  mode: DataMode;
  onAttackFired?: (result: AttackResult) => void;
  onToast?: (toast: { type: "success" | "error"; text: string }) => void;
}

interface AttackButtonConfig {
  type: AttackType;
  title: string;
  subtitle: string;
  icon: ReactNode;
  iconClass: string;
}

const ATTACK_BUTTONS: AttackButtonConfig[] = [
  {
    type: "over_cap",
    title: "Over Cap",
    subtitle: "$180.00 vs $50.00",
    icon: <ArrowUpIcon size={20} />,
    iconClass: "icon-red",
  },
  {
    type: "over_budget",
    title: "Over Budget",
    subtitle: "$180.00 + $45.00",
    icon: <WalletIcon size={20} />,
    iconClass: "icon-blue",
  },
  {
    type: "payee_switch",
    title: "Wrong Payee",
    subtitle: "Payee mismatch",
    icon: <UserSwapIcon size={20} />,
    iconClass: "icon-purple",
  },
  {
    type: "injection",
    title: "Injection",
    subtitle: "Prompt injection",
    icon: <CodeTerminalIcon size={20} />,
    iconClass: "icon-orange",
  },
];

interface OutcomeState {
  decision: string;
  rules: string[];
  riskPct: string;
  explanation: string;
}

export function AttackLab({ mode, onAttackFired, onToast }: AttackLabProps) {
  const [runningType, setRunningType] = useState<AttackType | null>(null);

  // No fabricated result: the panel stays empty until an attack actually runs.
  const [outcome, setOutcome] = useState<OutcomeState | null>(null);

  async function handleFireAttack(type: AttackType) {
    if (runningType !== null) return;
    setRunningType(type);
    try {
      const res = await launchAttack(mode, type);
      const dec = res.decision;
      const decStr = dec.decision || "BLOCK";
      const rules = dec.reason_codes;
      const riskPct = formatRiskPercent(dec.risk ?? 0.85);
      const expl = dec.explanation || "Adversarial evaluation complete.";

      setOutcome({
        decision: decStr,
        rules,
        riskPct,
        explanation: expl,
      });

      onAttackFired?.(res);
      const rulesLabel = rules.length > 0 ? ` (${rules.join(", ")})` : "";
      onToast?.({
        type: "success",
        text: `${type} → ${decStr}${rulesLabel}`,
      });
    } catch (err) {
      onToast?.({
        type: "error",
        text: `Attack ${type} failed: ${describeError(err)}`,
      });
    } finally {
      setRunningType(null);
    }
  }

  return (
    <section className="card attack-lab-card" aria-labelledby="attack-card-title">
      <div className="card-header">
        <div className="card-title-group">
          <span className="card-icon-wrap icon-blue" aria-hidden="true">
            <SwordsIcon size={20} />
          </span>
          <div>
            <h2 id="attack-card-title" className="card-title">Attack Lab</h2>
            <p className="card-subtitle">Try how the Trust Engine responds</p>
          </div>
        </div>
      </div>

      {/* 2x2 Attack Grid */}
      <div className="attack-grid-two-by-two">
        {ATTACK_BUTTONS.map((btn) => {
          const isCurrentRunning = runningType === btn.type;
          return (
            <button
              key={btn.type}
              type="button"
              className={`attack-card-btn ${isCurrentRunning ? "btn-running" : ""}`}
              disabled={runningType !== null}
              onClick={() => handleFireAttack(btn.type)}
            >
              <div className={`attack-btn-icon ${btn.iconClass}`}>
                {isCurrentRunning ? <SpinnerIcon size={18} /> : btn.icon}
              </div>
              <span className="attack-btn-title">{btn.title}</span>
              <span className="attack-btn-subtitle">{btn.subtitle}</span>
            </button>
          );
        })}
      </div>

      {/* Attack Outcome Banner */}
      <div className="attack-outcome-card" role="status">
        {outcome ? (
          <>
            <div className="outcome-shield-icon">
              <ShieldIcon size={26} className="shield-svg-green" />
            </div>
            <div className="outcome-details">
              <div className="outcome-decision-title">
                Decision: {outcome.decision}
              </div>
              <div className="outcome-meta-line">
                Rules: {outcome.rules.length > 0 ? outcome.rules.join(", ") : "-"} | Risk: {outcome.riskPct}
              </div>
              <div className="outcome-explanation-line">
                {outcome.explanation}
              </div>
            </div>
          </>
        ) : (
          <div className="outcome-details">
            <div className="outcome-decision-title">No attack run yet</div>
            <div className="outcome-meta-line">
              Pick a card above to see the Trust Engine respond.
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
