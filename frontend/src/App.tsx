import { useCallback, useEffect, useState } from "react";
import { checkHealth, type DataMode } from "./api.ts";
import { AttackLab } from "./components/AttackLab.tsx";
import { AuditPanel } from "./components/AuditPanel.tsx";
import { DecisionFeed } from "./components/DecisionFeed.tsx";
import { MandateEditor } from "./components/MandateEditor.tsx";
import { BrandShieldLogo } from "./icons.tsx";
import "./App.css";

interface ToastMsg {
  id: string;
  type: "success" | "error";
  text: string;
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

  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  const addToast = useCallback((toast: { type: "success" | "error"; text: string }) => {
    const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  // Sync mode state and test backend health if live
  useEffect(() => {
    try {
      localStorage.setItem("trustlayer_mode", mode);
    } catch {
      // storage unavailable
    }

    if (mode === "live") {
      let isMounted = true;
      checkHealth()
        .then(() => {
          if (isMounted) {
            addToast({ type: "success", text: "Connected to Live PayPal Sandbox API" });
          }
        })
        .catch(() => {
          if (isMounted) {
            setMode("mock");
            addToast({
              type: "error",
              text: "Backend API unavailable at /api. Switched to Mock Data.",
            });
          }
        });
      return () => {
        isMounted = false;
      };
    }
  }, [mode, addToast]);

  return (
    <div className="trustlayer-app-root">
      {/* Top Navigation Bar */}
      <header className="topbar">
        <div className="topbar-left">
          <div className="brand-logo-slot">
            <BrandShieldLogo size={30} />
          </div>
          <span className="brand-name">TRUSTLAYER</span>
          <span className="brand-divider" aria-hidden="true">|</span>
          <span className="brand-tagline">AI can decide. TRUSTLAYER decides whether it can spend.</span>
        </div>

        <div className="topbar-right">
          <div className="mode-toggle-pill" role="group" aria-label="Data mode selector">
            <button
              type="button"
              className={`mode-btn ${mode === "mock" ? "mode-btn-active" : ""}`}
              onClick={() => setMode("mock")}
              aria-pressed={mode === "mock"}
            >
              Mock Data
            </button>
            <button
              type="button"
              className={`mode-btn ${mode === "live" ? "mode-btn-active" : ""}`}
              onClick={() => setMode("live")}
              aria-pressed={mode === "live"}
            >
              Live API
            </button>
          </div>
        </div>
      </header>

      {/* Main Single-Screen Dashboard */}
      <main className="dashboard-main">
        {/* Top Row: 3 Cards Side-by-Side */}
        <section className="top-cards-row" aria-label="Controls and test suites">
          <MandateEditor mode={mode} onToast={addToast} />
          <AttackLab mode={mode} onToast={addToast} />
          <AuditPanel mode={mode} onToast={addToast} />
        </section>

        {/* Bottom Row: Full-Width Decision Feed */}
        <section className="bottom-feed-row" aria-label="Transaction Decision Feed">
          <DecisionFeed mode={mode} />
        </section>
      </main>

      {/* Toast Notifications */}
      <div className="toasts-container" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast-pill ${t.type === "success" ? "toast-pill-success" : "toast-pill-error"}`}
          >
            <span className="toast-symbol">{t.type === "success" ? "✔" : "⚠️"}</span>
            <span className="toast-text">{t.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
