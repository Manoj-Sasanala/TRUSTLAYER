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
  formatRiskPercent,
  formatTimeHms,
  getReasonInfo,
} from "../format.ts";
import {
  ChartBarIcon,
  CloseIcon,
} from "../icons.tsx";
import { subscribeMock } from "../mock.ts";

ModuleRegistry.registerModules([AllCommunityModule]);

interface DecisionFeedProps {
  mode: DataMode;
  onFeedUpdated?: (rows: FeedRow[]) => void;
}

function DecisionBadgeRenderer({ value }: { value: string }) {
  const norm = typeof value === "string" ? value.toUpperCase() : "-";
  if (norm === "APPROVE") {
    return (
      <span className="feed-pill-badge badge-approve">
        <span className="badge-icon">✔</span>
        <span>APPROVE</span>
      </span>
    );
  }
  if (norm === "BLOCK") {
    return (
      <span className="feed-pill-badge badge-block">
        <span className="badge-icon">✖</span>
        <span>BLOCK</span>
      </span>
    );
  }
  if (norm === "ESCALATE") {
    return (
      <span className="feed-pill-badge badge-escalate">
        <span className="badge-icon">!</span>
        <span>ESCALATE</span>
      </span>
    );
  }
  return <span className="feed-pill-badge badge-neutral">{norm}</span>;
}

function ReasonCodesRenderer({ value }: { value: string[] | null | undefined }) {
  if (!Array.isArray(value) || value.length === 0) {
    return <span className="grid-cell-muted">-</span>;
  }

  const tooltipText = value
    .map((code) => `${code}: ${getReasonInfo(code).explanation}`)
    .join("\n");

  return (
    <span className="reason-codes-display" title={tooltipText}>
      {value.join(", ")}
    </span>
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
        // Polling retry
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
        width: 140,
        cellRenderer: (p: ICellRendererParams<FeedRow, string>) => {
          const val = p.value;
          if (!val || val === "-") return <span className="grid-cell-muted">-</span>;
          const hms = formatTimeHms(val);
          const relative = formatRelativeTime(val);
          return (
            <span className="grid-time-cell mono-font" title={`${relative} (${val})`}>
              {hms}
            </span>
          );
        },
      },
      {
        field: "item",
        headerName: "Item",
        flex: 1.5,
        minWidth: 160,
        valueFormatter: (p) => showText(p.value),
        cellClass: "item-cell-text",
      },
      {
        field: "amount",
        headerName: "Amount",
        width: 130,
        cellClass: "amount-cell-right",
        cellRenderer: (p: ICellRendererParams<FeedRow, string>) => {
          const val = p.value;
          if (!val || val === "-") return <span className="grid-cell-muted">-</span>;
          return <span className="grid-amount-mono mono-font">${val}</span>;
        },
      },
      {
        field: "decision",
        headerName: "Decision",
        width: 160,
        cellRenderer: (p: ICellRendererParams<FeedRow, string>) => (
          <DecisionBadgeRenderer value={p.value ?? "-"} />
        ),
      },
      {
        field: "reason_codes",
        headerName: "Reason Codes",
        width: 170,
        cellRenderer: (p: ICellRendererParams<FeedRow, string[] | null | undefined>) => (
          <ReasonCodesRenderer value={p.value} />
        ),
      },
      {
        field: "risk",
        headerName: "Risk Score",
        width: 130,
        cellRenderer: (p: ICellRendererParams<FeedRow, number | null>) => {
          const val = p.value;
          if (val === null || val === undefined || typeof val !== "number" || !Number.isFinite(val)) {
            return <span className="grid-cell-muted">-</span>;
          }
          return <span className="grid-risk-pct mono-font">{formatRiskPercent(val)}</span>;
        },
      },
    ],
    [],
  );

  const getRowId = useMemo(() => {
    return (params: GetRowIdParams<FeedRow>) => params.data.id;
  }, []);

  const getRowClass = (params: RowClassParams<FeedRow>): string => {
    const classes: string[] = ["light-row-item"];
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
    <section className="card feed-card" aria-labelledby="feed-card-title">
      <div className="card-header feed-header">
        <div className="card-title-group">
          <span className="card-icon-wrap icon-blue" aria-hidden="true">
            <ChartBarIcon size={20} />
          </span>
          <div>
            <h2 id="feed-card-title" className="card-title">Decision Feed</h2>
            <p className="card-subtitle">Live view of transactions (auto-refreshes every 2s)</p>
          </div>
        </div>

        <div className="feed-header-right">
          <div className="live-status-indicator">
            <span className="live-green-dot" aria-hidden="true" />
            <span className="live-text-label">Live</span>
          </div>
        </div>
      </div>

      <div className="ag-theme-quartz feed-ag-grid-wrapper">
        <AgGridReact<FeedRow>
          rowData={rowData}
          columnDefs={columnDefs}
          getRowId={getRowId}
          getRowClass={getRowClass}
          headerHeight={44}
          rowHeight={46}
          onRowClicked={handleRowClicked}
          domLayout="autoHeight"
          animateRows={false}
          suppressCellFocus={false}
        />
      </div>

      {/* Decision Receipt Modal */}
      {selectedReceipt && (
        <div
          className="receipt-modal-backdrop"
          onClick={() => setSelectedReceipt(null)}
          role="presentation"
        >
          <div
            className="receipt-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="receipt-title"
          >
            <div className="receipt-header">
              <h3 id="receipt-title" className="receipt-title">Transaction Receipt</h3>
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
              <div className="receipt-row">
                <span className="receipt-key">Purchase ID</span>
                <span className="receipt-val mono-font">{selectedReceipt.id}</span>
              </div>
              <div className="receipt-row">
                <span className="receipt-key">Item</span>
                <span className="receipt-val font-semibold">{selectedReceipt.item}</span>
              </div>
              <div className="receipt-row">
                <span className="receipt-key">Amount</span>
                <span className="receipt-val mono-font font-semibold">${selectedReceipt.amount}</span>
              </div>
              <div className="receipt-row">
                <span className="receipt-key">Decision</span>
                <span className="receipt-val">
                  <DecisionBadgeRenderer value={selectedReceipt.decision} />
                </span>
              </div>
              <div className="receipt-row">
                <span className="receipt-key">Risk Score</span>
                <span className="receipt-val mono-font">
                  {formatRiskPercent(selectedReceipt.risk)}
                </span>
              </div>
              <div className="receipt-row">
                <span className="receipt-key">Timestamp</span>
                <span className="receipt-val mono-font">{selectedReceipt.time}</span>
              </div>

              {selectedReceipt.reason_codes.length > 0 && (
                <div className="receipt-reasons-block">
                  <span className="receipt-key">Triggered Rules</span>
                  <div className="receipt-reasons-list">
                    {selectedReceipt.reason_codes.map((code) => {
                      const info = getReasonInfo(code);
                      return (
                        <div key={code} className="receipt-reason-item">
                          <span className="reason-code-badge">{code}</span>
                          <span className="reason-explanation">{info.explanation}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
