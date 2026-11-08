import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { checkHealth, type DataMode, type FeedRow } from "./api.ts";
import { AttackLab } from "./components/AttackLab.tsx";
import { AuditPanel } from "./components/AuditPanel.tsx";
import { DecisionFeed } from "./components/DecisionFeed.tsx";
import { MandateEditor } from "./components/MandateEditor.tsx";
import { formatUtcDateTime } from "./format.ts";
import {
  ClockIcon,
  GearIcon,
  ShieldIcon,
} from "./icons.tsx";
import "./App.css";

interface ToastMsg {
  id: string;
  type: "success" | "error";
  text: string;
}

function SmoothCounter({ target }: { target: number }) {
  const [current, setCurrent] = useState(target);

  useEffect(() => {
    if (current === target) return;
    const diff = target - current;
    const step = diff > 0 ? Math.ceil(diff / 5) : Math.floor(diff / 5);
    const timeout = setTimeout(() => {
      setCurrent((prev) => {
        const next = prev + step;
        return (step > 0 && next > target) || (step < 0 && next < target) ? target : next;
      });
    }, 35);
    return () => clearTimeout(timeout);
  }, [target, current]);

  return <span>{current}</span>;
}

export function App() {
  const [mode, setMode] = useState<DataMode>(() => {
    try {
      const saved = localStorage.getItem("trustlayer_mode");
      return saved === "live" ? "live" : "mock";
    } catch {
      return "mock";
    }
  });

  const [apiReachable, setApiReachable] = useState<boolean | null>(null);
  const connectionStatus = useMemo<"mock" | "connected" | "unreachable">(() => {
    if (mode !== "live") return "mock";
    if (apiReachable === true) return "connected";
    if (apiReachable === false) return "unreachable";
    return "connected";
  }, [mode, apiReachable]);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [feedRows, setFeedRows] = useState<FeedRow[]>([]);
  const [utcClock, setUtcClock] = useState(() => formatUtcDateTime(new Date().toISOString()));
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  // Blocked tile glow trigger
  const blockedCount = feedRows.filter((r) => r.decision === "BLOCK").length;
  const [hasBlockedGlow, setHasBlockedGlow] = useState(false);
  const prevBlockedRef = useRef(blockedCount);

  useEffect(() => {
    if (blockedCount > prevBlockedRef.current) {
      setHasBlockedGlow(true);
      const timer = setTimeout(() => setHasBlockedGlow(false), 1400);
      return () => clearTimeout(timer);
    }
    prevBlockedRef.current = blockedCount;
  }, [blockedCount]);

  // Live ticking UTC clock
  useEffect(() => {
    const timer = setInterval(() => {
      setUtcClock(formatUtcDateTime(new Date().toISOString()));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const addToast = useCallback((toast: { type: "success" | "error"; text: string }) => {
    const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  // Health-check when switching to live mode
  useEffect(() => {
    try {
      localStorage.setItem("trustlayer_mode", mode);
    } catch {
      // storage unavailable
    }

    if (mode !== "live") {
      setApiReachable(null);
      return;
    }

    let isMounted = true;
    checkHealth()
      .then(() => {
        if (isMounted) setApiReachable(true);
      })
      .catch(() => {
        if (isMounted) {
          setApiReachable(false);
          setMode("mock");
          addToast({
            type: "error",
            text: "Backend API offline at /api. Reverted to Mock Mode.",
          });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [mode, addToast]);

  // ESC to close drawer
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsDrawerOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleFeedUpdated = useCallback((rows: FeedRow[]) => {
    setFeedRows(rows);
  }, []);

  const totalDecisions = feedRows.length;
  const approvedCount = feedRows.filter((r) => r.decision === "APPROVE").length;
  const escalatedCount = feedRows.filter((r) => r.decision === "ESCALATE").length;

  return (
    <div className="trustlayer-app-root">
      {/* Sticky Glass Top Bar */}
      <header className="sticky-glass-topbar">
        <div className="topbar-container">
          <div className="topbar-brand-lockup">
            <div className="brand-logo-pill">
              <ShieldIcon size={20} className="brand-shield-svg" />
            </div>
            <div className="brand-titles">
              <span className="brand-wordmark">TRUSTLAYER</span>
              <span className="brand-sep" aria-hidden="true">|</span>
              <span className="brand-tagline">AI can decide. TRUSTLAYER decides whether it can spend.</span>
            </div>
          </div>

          <div className="topbar-actions-cluster">
            {/* Live UTC Clock */}
            <div className="live-utc-clock" title="Current UTC clock">
              <ClockIcon size={14} className="clock-svg" />
              <span className="clock-val mono-font">{utcClock} UTC</span>
            </div>

            {/* Mandate Drawer Button */}
            <button
              type="button"
              className="btn btn-mandate-drawer-trigger"
              onClick={() => setIsDrawerOpen(true)}
              aria-label="Open Mandate editor drawer"
            >
              <GearIcon size={15} />
              <span>Mandate</span>
            </button>

            {/* Mock / Live Segmented Control */}
            <div className="segmented-mode-picker" role="group" aria-label="Data mode selector">
              <button
                type="button"
                className={`segment-tab ${mode === "mock" ? "tab-active" : ""}`}
                onClick={() => setMode("mock")}
                aria-pressed={mode === "mock"}
              >
                Mock Data
              </button>
              <button
                type="button"
                className={`segment-tab ${mode === "live" ? "tab-active" : ""}`}
                onClick={() => setMode("live")}
                aria-pressed={mode === "live"}
              >
                Live API
              </button>
            </div>

            {/* Status Dot */}
            <div className="status-indicator-pill">
              <span
                className={`status-circle-dot ${
                  connectionStatus === "connected"
                    ? "dot-connected"
                    : connectionStatus === "unreachable"
                      ? "dot-unreachable"
                      : "dot-mock"
                }`}
                aria-hidden="true"
              />
              <span className="status-label-caption">
                {connectionStatus === "connected"
                  ? "Live API"
                  : connectionStatus === "unreachable"
                    ? "Offline"
                    : "Mock Mode"}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Single-Screen Workspace */}
      <div className="dashboard-content-scaffold">
        {/* Row of 4 Stat Tiles */}
        <section className="stat-tiles-row" aria-label="Decision metrics">
          <div className="metric-tile tile-total">
            <span className="metric-label">Total Decisions</span>
            <span className="metric-number mono-font">
              <SmoothCounter target={totalDecisions} />
            </span>
          </div>

          <div className="metric-tile tile-approved">
            <span className="metric-label">Approved</span>
            <span className="metric-number mono-font">
              <SmoothCounter target={approvedCount} />
            </span>
          </div>

          <div className={`metric-tile tile-blocked ${hasBlockedGlow ? "tile-glow-danger" : ""}`}>
            <span className="metric-label">Blocked</span>
            <span className="metric-number mono-font">
              <SmoothCounter target={blockedCount} />
            </span>
          </div>

          <div className="metric-tile tile-escalated">
            <span className="metric-label">Escalated</span>
            <span className="metric-number mono-font">
              <SmoothCounter target={escalatedCount} />
            </span>
          </div>
        </section>

        {/* 2-Column Main Workspace */}
        <main className="workspace-duo-grid">
          {/* Left Column (380px): Attack Lab + Audit Engine */}
          <div className="left-rail-stack">
            <AttackLab mode={mode} onToast={addToast} />
            <AuditPanel mode={mode} onToast={addToast} />
          </div>

          {/* Right Column: Full-Height Decision Feed */}
          <div className="right-feed-frame">
            <DecisionFeed mode={mode} onFeedUpdated={handleFeedUpdated} />
          </div>
        </main>
      </div>

      {/* Slide-In Mandate Drawer (Right) */}
      {isDrawerOpen && (
        <div
          className="drawer-backdrop"
          onClick={() => setIsDrawerOpen(false)}
          role="presentation"
        >
          <div
            className="drawer-surface-panel"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Mandate Editor Drawer"
          >
            <MandateEditor
              mode={mode}
              onClose={() => setIsDrawerOpen(false)}
              onSaved={() => {
                addToast({ type: "success", text: "Mandate policy rules updated successfully" });
              }}
            />
          </div>
        </div>
      )}

      {/* Bottom-Right Toast Stack */}
      <div className="toasts-stack-container" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast-alert-card ${t.type === "success" ? "toast-card-success" : "toast-card-danger"}`}
          >
            <span className="toast-symbol">{t.type === "success" ? "✓" : "⚠️"}</span>
            <span className="toast-text-msg">{t.text}</span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <footer className="dashboard-footer-tag">
        <span>Deterministic Trust &amp; Security Layer for AI Agents · PayPal Orders v2 Sandbox</span>
      </footer>
    </div>
  );
}

export default App;
