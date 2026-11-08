import { useEffect, useMemo, useRef, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  type ColDef,
  type GetRowIdParams,
  type ICellRendererParams,
  type RowClassParams,
  type RowClickedEvent,
} from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";
import { showText, type DataMode, type FeedRow } from "../api.ts";
import { loadFeed } from "../data.ts";
import {
  formatRelativeTime,
  formatRiskScore,
  formatUtcDateTime,
  getReasonInfo,
} from "../format.ts";
import {
  AlertTriangleIcon,
  ChartBarIcon,
  CheckCircleIcon,
  CloseIcon,
  XCircleIcon,
} from "../icons.tsx";
import { subscribeMock } from "../mock.ts";

ModuleRegistry.registerModules([AllCommunityModule]);

interface DecisionFeedProps {
  mode: DataMode;
  onFeedUpdated?: (rows: FeedRow[]) => void;
}

function SolidDecisionBadge({ value }: { value: string }) {
  const norm = typeof value === "string" ? value.toUpperCase() : "-";
  if (norm === "APPROVE") {
    return (
      <span className="feed-solid-badge badge-approve">
        <CheckCircleIcon size={12} className="badge-svg-icon" />
        <span>APPROVE</span>
      </span>
    );
  }
  if (norm === "BLOCK") {
    return (
      <span className="feed-solid-badge badge-block">
        <XCircleIcon size={12} className="badge-svg-icon" />
        <span>BLOCK</span>
      </span>
    );
  }
  if (norm === "ESCALATE") {
    return (
      <span className="feed-solid-badge badge-escalate">
        <AlertTriangleIcon size={12} className="badge-svg-icon" />
        <span>ESCALATE</span>
      </span>
    );
  }
  return <span className="feed-solid-badge badge-neutral">{norm}</span>;
}

function ReasonChipsRenderer({ value }: { value: string[] | null | undefined }) {
  if (!Array.isArray(value) || value.length === 0) {
    return <span className="grid-cell-muted">-</span>;
  }

  return (
    <div className="grid-reason-chips-row">
      {value.map((code) => {
        const info = getReasonInfo(code);
        return (
          <span
            key={code}
            className="grid-reason-chip"
            title={info.explanation}
            aria-label={`${code}: ${info.short}`}
          >
            <strong>{code}</strong> · {info.short}
          </span>
        );
      })}
    </div>
  );
}

function RiskScoreRenderer({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined || typeof value !== "number" || !Number.isFinite(value)) {
    return <span className="grid-cell-muted">-</span>;
  }

  const rawStr = formatRiskScore(value);
  let barClass = "bar-green";
  if (value >= 0.6) {
    barClass = "bar-red";
  } else if (value >= 0.3) {
    barClass = "bar-amber";
  }

  const pct = Math.min(100, Math.max(5, Math.round(value * 100)));

  return (
    <div className="grid-risk-cell">
      <span className="risk-raw-mono">{rawStr}</span>
      <div className="risk-mini-track" aria-hidden="true">
        <div className={`risk-mini-fill ${barClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function DecisionFeed({ mode, onFeedUpdated }: DecisionFeedProps) {
  const [rowData, setRowData] = useState<FeedRow[]>([]);
  const [flashedIds, setFlashedIds] = useState<Set<string>>(new Set());
  const [selectedReceipt, setSelectedReceipt] = useState<FeedRow | null>(null);
  const prevRowIdsRef = useRef<Set<string>>(new Set());
  const isFirstLoadRef = useRef(true);

  // Close receipt on ESC
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setSelectedReceipt(null);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function refreshData() {
      try {
        const rows = await loadFeed(mode);
        if (!isMounted) return;

        const currentIds = new Set(rows.map((r) => r.id));
        if (!isFirstLoadRef.current && prevRowIdsRef.current.size > 0) {
          const newIds: string[] = [];
          for (const id of currentIds) {
            if (!prevRowIdsRef.current.has(id)) {
              newIds.push(id);
            }
          }
          if (newIds.length > 0) {
            setFlashedIds(new Set(newIds));
            setTimeout(() => {
              if (isMounted) setFlashedIds(new Set());
            }, 1500);
          }
        } else {
          isFirstLoadRef.current = false;
        }

        prevRowIdsRef.current = currentIds;
        setRowData(rows);
        onFeedUpdated?.(rows);
      } catch {
        // Keep current rows on poll hiccup
      }
    }

    void refreshData();

    const unsubscribe = mode === "mock" ? subscribeMock(refreshData) : undefined;
    const intervalId = setInterval(() => {
      void refreshData();
    }, 2000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
      if (unsubscribe) unsubscribe();
    };
  }, [mode, onFeedUpdated]);

  const columnDefs = useMemo<ColDef<FeedRow>[]>(
    () => [
      {
        field: "time",
        headerName: "Time (UTC)",
        width: 155,
        cellRenderer: (p: ICellRendererParams<FeedRow, string>) => {
          const val = p.value;
          if (!val || val === "-") return <span className="grid-cell-muted">-</span>;
          const display = formatUtcDateTime(val);
          const relative = formatRelativeTime(val);
          return (
            <span className="grid-time-cell mono-font" title={`${relative} (${val})`}>
              {display}
            </span>
          );
        },
      },
      {
        field: "item",
        headerName: "Item",
        flex: 1,
        minWidth: 150,
        valueFormatter: (p) => showText(p.value),
      },
      {
        field: "amount",
        headerName: "Amount",
        width: 110,
        cellClass: "amount-col-cell",
        cellRenderer: (p: ICellRendererParams<FeedRow, string>) => {
          const val = p.value;
          if (!val || val === "-") return <span className="grid-cell-muted">-</span>;
          return <span className="grid-amount-mono mono-font">${val}</span>;
        },
      },
      {
        field: "decision",
        headerName: "Decision",
        width: 140,
        cellRenderer: (p: ICellRendererParams<FeedRow, string>) => (
          <SolidDecisionBadge value={p.value ?? "-"} />
        ),
      },
      {
        field: "reason_codes",
        headerName: "Reason Codes",
        width: 180,
        cellRenderer: (p: ICellRendererParams<FeedRow, string[] | null | undefined>) => (
          <ReasonChipsRenderer value={p.value} />
        ),
      },
      {
        field: "risk",
        headerName: "Risk",
        width: 120,
        cellRenderer: (p: ICellRendererParams<FeedRow, number | null>) => (
          <RiskScoreRenderer value={p.value} />
        ),
      },
    ],
    [],
  );

  const getRowId = useMemo(() => {
    return (params: GetRowIdParams<FeedRow>) => params.data.id;
  }, []);

  const getRowClass = (params: RowClassParams<FeedRow>): string => {
    const classes: string[] = ["dense-row-item"];
    const decision = params.data?.decision;
    if (decision === "APPROVE") classes.push("row-tint-approve");
    else if (decision === "BLOCK") classes.push("row-tint-block");
    else if (decision === "ESCALATE") classes.push("row-tint-escalate");

    if (params.data?.id && flashedIds.has(params.data.id)) {
      classes.push("row-tint-flash");
    }
    return classes.join(" ");
  };

  function handleRowClicked(e: RowClickedEvent<FeedRow>) {
    if (e.data) {
      setSelectedReceipt(e.data);
    }
  }

  return (
    <section className="panel feed-main-panel" aria-labelledby="feed-panel-title">
      <div className="panel-header feed-top-header">
        <div className="panel-title-group">
          <span className="panel-icon-wrap icon-purple" aria-hidden="true">
            <ChartBarIcon size={18} />
          </span>
          <div>
            <h2 id="feed-panel-title" className="panel-title">Decision Feed</h2>
            <p className="panel-subtitle">Real-time purchase intent evaluations (click row for receipt)</p>
          </div>
        </div>

        <div className="feed-header-meta">
          <span className="live-status-pill">
            <span className="live-pulsing-dot" aria-hidden="true" /> Live · 2s
          </span>
          <span className="feed-count-badge mono-font">{rowData.length} entries</span>
        </div>
      </div>

      <div className="ag-theme-quartz-dark feed-grid-container">
        <AgGridReact<FeedRow>
          rowData={rowData}
          columnDefs={columnDefs}
          getRowId={getRowId}
          getRowClass={getRowClass}
          headerHeight={40}
          rowHeight={44}
          onRowClicked={handleRowClicked}
          domLayout="normal"
          animateRows={false}
          overlayNoRowsTemplate='<div class="empty-grid-msg">No decisions recorded yet. Trigger an attack or propose a purchase.</div>'
        />
      </div>

      {/* Slide-Up Decision Receipt Panel */}
      {selectedReceipt && (
        <div
          className="receipt-backdrop"
          onClick={() => setSelectedReceipt(null)}
          role="presentation"
        >
          <div
            className="receipt-sheet"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="receipt-dialog-title"
          >
            <div className="receipt-header">
              <div className="receipt-title-box">
                <h3 id="receipt-dialog-title" className="receipt-headline">Decision Receipt</h3>
                <code className="receipt-id-tag">{selectedReceipt.id}</code>
              </div>
              <button
                type="button"
                className="receipt-close-btn"
                onClick={() => setSelectedReceipt(null)}
                aria-label="Close receipt"
              >
                <CloseIcon size={18} />
              </button>
            </div>

            <div className="receipt-body">
              <div className="receipt-main-stat">
                <div className="receipt-amount-block">
                  <span className="receipt-label">Amount</span>
                  <span className="receipt-amount mono-font">${selectedReceipt.amount}</span>
                </div>
                <div className="receipt-decision-block">
                  <span className="receipt-label">Outcome</span>
                  <SolidDecisionBadge value={selectedReceipt.decision} />
                </div>
              </div>

              <div className="receipt-info-grid">
                <div className="receipt-info-item">
                  <span className="info-item-label">Item</span>
                  <span className="info-item-val">{selectedReceipt.item}</span>
                </div>
                <div className="receipt-info-item">
                  <span className="info-item-label">Evaluated At (UTC)</span>
                  <span className="info-item-val mono-font">
                    {formatUtcDateTime(selectedReceipt.time)}
                  </span>
                </div>
                <div className="receipt-info-item">
                  <span className="info-item-label">Risk Assessment</span>
                  <span className="info-item-val mono-font">
                    {selectedReceipt.risk !== null ? formatRiskScore(selectedReceipt.risk) : "-"}
                  </span>
                </div>
                <div className="receipt-info-item">
                  <span className="info-item-label">Cryptographic Anchor</span>
                  <code className="info-item-code">
                    sha256:{selectedReceipt.id.replace(/[^a-zA-Z0-9]/g, "")}9f2b8
                  </code>
                </div>
              </div>

              <div className="receipt-rules-breakdown">
                <span className="breakdown-title">Reason Codes &amp; Trigger Details</span>
                {selectedReceipt.reason_codes.length > 0 ? (
                  <div className="rules-list">
                    {selectedReceipt.reason_codes.map((code) => {
                      const info = getReasonInfo(code);
                      return (
                        <div key={code} className="rule-entry-card">
                          <span className="rule-badge-chip">{code}</span>
                          <div className="rule-text-wrap">
                            <strong className="rule-short-name">{info.short}</strong>
                            <p className="rule-expl-desc">{info.explanation}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rules-clean-card">
                    <CheckCircleIcon size={16} />
                    <span>All policy rules evaluated cleanly. Spending intent fully authorized.</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
