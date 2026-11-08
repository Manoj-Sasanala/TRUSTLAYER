import { useRef, useState, type ReactNode } from "react";
import { describeError, type AttackResult, type AttackType, type DataMode } from "../api.ts";
import { launchAttack } from "../data.ts";
import {
  ArrowUpIcon,
  CodeTerminalIcon,
  PlayAllIcon,
  SpinnerIcon,
  SwordsIcon,
  TerminalIcon,
  UserSwapIcon,
  WalletIcon,
} from "../icons.tsx";

interface AttackLabProps {
  mode: DataMode;
  onAttackFired?: (result: AttackResult) => void;
  onToast?: (toast: { type: "success" | "error"; text: string }) => void;
}

interface AttackItem {
  type: AttackType;
  label: string;
  icon: ReactNode;
  expectedRule: string;
}

interface TerminalLogEntry {
  id: string;
  timestamp: string;
  type: AttackType;
  decision: string;
  reasonCodes: string[];
  risk?: number;
  latencyMs: number;
}

const ATTACK_ITEMS: AttackItem[] = [
  {
    type: "over_cap",
    label: "Over Cap",
    icon: <ArrowUpIcon size={16} />,
    expectedRule: "Expects R1",
  },
  {
    type: "over_budget",
    label: "Over Budget",
    icon: <WalletIcon size={16} />,
    expectedRule: "Expects R2",
  },
  {
    type: "payee_switch",
    label: "Wrong Payee",
    icon: <UserSwapIcon size={16} />,
    expectedRule: "Expects R7",
  },
  {
    type: "injection",
    label: "Injection",
    icon: <CodeTerminalIcon size={16} />,
    expectedRule: "Expects R9",
  },
];

export function AttackLab({ mode, onAttackFired, onToast }: AttackLabProps) {
  const [runningType, setRunningType] = useState<AttackType | null>(null);
  const [isRunningAll, setIsRunningAll] = useState(false);
  const logCounterRef = useRef(3);
  const [terminalLogs, setTerminalLogs] = useState<TerminalLogEntry[]>([
    {
      id: "log_1",
      timestamp: "13:20:01",
      type: "injection",
      decision: "BLOCK",
      reasonCodes: ["R1", "R2", "R5", "R9"],
      risk: 0.92,
      latencyMs: 14,
    },
    {
      id: "log_2",
      timestamp: "13:20:04",
      type: "over_cap",
      decision: "BLOCK",
      reasonCodes: ["R1"],
      risk: 0.86,
      latencyMs: 11,
    },
  ]);

  async function fireSingleAttack(type: AttackType): Promise<AttackResult> {
    const t0 = performance.now();
    try {
      const res = await launchAttack(mode, type);
      const latencyMs = Math.max(1, Math.round(performance.now() - t0));
      const dec = res.decision;

      logCounterRef.current += 1;
      const nowStr = new Date().toTimeString().slice(0, 8);
      const newEntry: TerminalLogEntry = {
        id: `log_${logCounterRef.current}`,
        timestamp: nowStr,
        type,
        decision: dec.decision || "BLOCK",
        reasonCodes: dec.reason_codes,
        risk: dec.risk,
        latencyMs,
      };

      setTerminalLogs((prev) => [newEntry, ...prev.slice(0, 19)]);
      onAttackFired?.(res);

      const codesStr = dec.reason_codes.length > 0 ? ` [${dec.reason_codes.join(", ")}]` : "";
      onToast?.({
        type: "success",
        text: `${type} → ${dec.decision || "BLOCK"}${codesStr}`,
      });

      return res;
    } catch (err) {
      const errStr = describeError(err);
      onToast?.({
        type: "error",
        text: `Attack ${type} failed: ${errStr}`,
      });
      throw err;
    }
  }

  async function handleLaunch(type: AttackType) {
    if (runningType !== null || isRunningAll) return;
    setRunningType(type);
    try {
      await fireSingleAttack(type);
    } finally {
      setRunningType(null);
    }
  }

  async function handleRunAll() {
    if (runningType !== null || isRunningAll) return;
    setIsRunningAll(true);
    try {
      for (let i = 0; i < ATTACK_ITEMS.length; i++) {
        const item = ATTACK_ITEMS[i];
        setRunningType(item.type);
        try {
          await fireSingleAttack(item.type);
        } catch {
          // continue sequence
        }
        if (i < ATTACK_ITEMS.length - 1) {
          await new Promise((r) => setTimeout(r, 400));
        }
      }
    } finally {
      setRunningType(null);
      setIsRunningAll(false);
    }
  }

  return (
    <section className="panel attack-console-panel" aria-labelledby="attack-panel-title">
      <div className="panel-header">
        <div className="panel-title-group">
          <span className="panel-icon-wrap icon-purple" aria-hidden="true">
            <SwordsIcon size={18} />
          </span>
          <div>
            <h2 id="attack-panel-title" className="panel-title">Attack Lab</h2>
            <p className="panel-subtitle">Adversarial red-team test suite</p>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-secondary-subtle btn-run-all"
          disabled={runningType !== null || isRunningAll}
          onClick={handleRunAll}
          aria-label="Run all 4 attacks sequentially"
        >
          {isRunningAll ? (
            <>
              <SpinnerIcon size={13} />
              <span>Running...</span>
            </>
          ) : (
            <>
              <PlayAllIcon size={13} />
              <span>Run all 4</span>
            </>
          )}
        </button>
      </div>

      {/* 4 Attack Buttons Grid */}
      <div className="attack-buttons-quad">
        {ATTACK_ITEMS.map((item) => {
          const isActive = runningType === item.type;
          return (
            <button
              key={item.type}
              type="button"
              className={`attack-tile ${isActive ? "tile-active" : ""}`}
              disabled={runningType !== null || isRunningAll}
              onClick={() => handleLaunch(item.type)}
            >
              <div className="tile-top-row">
                <span className="tile-icon-frame">{item.icon}</span>
                <span className="tile-expect-tag">{item.expectedRule}</span>
              </div>
              <div className="tile-name-row">
                <span className="tile-name">{item.label}</span>
                {isActive && <SpinnerIcon size={14} className="tile-spinner" />}
              </div>
            </button>
          );
        })}
      </div>

      {/* Terminal Style Execution Console */}
      <div className="console-terminal-wrapper" role="region" aria-label="Attack execution log">
        <div className="console-terminal-header">
          <span className="console-dot-indicator" />
          <span className="console-title">
            <TerminalIcon size={12} /> execution_log.sh
          </span>
          <span className="console-records-count">{terminalLogs.length} events</span>
        </div>

        <div className="console-terminal-body">
          {terminalLogs.map((log) => {
            const isBlock = log.decision === "BLOCK";
            const isEscalate = log.decision === "ESCALATE";
            const decisionClass = isBlock
              ? "term-block"
              : isEscalate
                ? "term-escalate"
                : "term-approve";

            return (
              <div key={log.id} className="console-log-line">
                <span className="term-prompt">&gt;</span>
                <span className="term-type">{log.type}</span>
                <span className={`term-decision ${decisionClass}`}>{log.decision}</span>
                <span className="term-codes">
                  {log.reasonCodes.length > 0 ? `[${log.reasonCodes.join(", ")}]` : "[-]"}
                </span>
                <span className="term-risk">
                  risk {log.risk !== undefined ? log.risk.toFixed(2) : "-"}
                </span>
                <span className="term-latency">{log.latencyMs}ms</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
